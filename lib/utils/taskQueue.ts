import { logger } from '@/lib/logger';

/**
 * Task queue for managing API calls to prevent rate limiting
 */

// Define a task interface
export interface Task {
  id: string;
  execute: () => Promise<any>;
  priority: number;
  timestamp: number;
  service: 'openai' | 'general';
  isLongRunning?: boolean; // Flag for tasks that might take longer
}

// Queue configuration
let queueConfig = {
  openai: {
    concurrency: 4,             // How many concurrent tasks
    minInterval: 100,           // Minimum interval between tasks in ms
    maxQueueSize: 100,          // Maximum tasks in queue
    taskTimeout: 60000,         // 60 seconds task timeout
    taskTimeoutFetchContent: 120000, // 120 seconds for tasks that involve fetching content
    idleTimeout: 10000,         // Time to wait before shutting down the worker if no tasks
    maxConsecutiveErrors: 5,    // Maximum consecutive errors before backing off
    errorBackoff: 5000,         // Backoff time after consecutive errors
  },
  general: {
    concurrency: 10,
    minInterval: 0,             // No delay for general tasks
    maxQueueSize: 500,          // Larger queue for general tasks
    taskTimeout: 30000,         // 30 seconds task timeout
    taskTimeoutFetchContent: 120000, // 120 seconds for tasks that involve fetching content
    idleTimeout: 10000,         // Time to wait before shutting down the worker
    maxConsecutiveErrors: 10,   // Higher threshold for general tasks
    errorBackoff: 2000,         // Shorter backoff for general tasks
  },
};

// Queue of tasks
const taskQueues: Record<string, Task[]> = {
  openai: [],
  general: [],
};

// Track active tasks
const activeTasks: Record<string, Set<string>> = {
  openai: new Set(),
  general: new Set(),
};

// Track consecutive errors
const consecutiveErrors: Record<string, number> = {
  openai: 0,
  general: 0,
};

// Track if we're currently processing the queue
const processing: Record<string, boolean> = {
  openai: false,
  general: false,
};

// Track last task times for rate limiting
const lastTaskTimes: Record<string, number> = {
  openai: 0,
  general: 0,
};

// Track task durations for monitoring
const taskDurations: Record<string, number[]> = {
  openai: [],
  general: [],
};

// Keep the last 20 task durations for each service
const MAX_TASK_DURATIONS = 20;

// Track task timeouts
const taskTimeouts: Record<string, NodeJS.Timeout> = {};

// Processing loop is already running
const isProcessing: Record<string, boolean> = {
  openai: false,
  general: false,
};

// Idle timer for shutting down the processing loop
const idleTimers: Record<string, NodeJS.Timeout | null> = {
  openai: null,
  general: null,
};

// Reset error tracking every 5 minutes
setInterval(() => {
  Object.keys(consecutiveErrors).forEach(service => {
    consecutiveErrors[service] = 0;
  });
  logger.debug('Reset consecutive errors for all services');
}, 5 * 60 * 1000);

// Generate a unique task ID
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Add a task to the queue and process it when ready
 */
export async function queueTask<T>(
  service: 'openai' | 'general',
  execute: () => Promise<T>,
  options: {
    priority?: number;
    taskId?: string;
    isLongRunning?: boolean; // Add flag for long-running tasks
  } = {}
): Promise<T> {
  const { priority = 0, taskId = generateTaskId(), isLongRunning = false } = options;
  const queue = taskQueues[service];
  
  // Check if queue is full
  if (queue.length >= queueConfig[service].maxQueueSize) {
    logger.warn(`${service} task queue is full (${queue.length} tasks). Rejecting new task.`);
    throw new Error(`Task queue for ${service} is full`);
  }
  
  // Create a promise that will be resolved when the task completes
  let resolveTask: (value: T) => void;
  let rejectTask: (reason: any) => void;
  
  const taskPromise = new Promise<T>((resolve, reject) => {
    resolveTask = resolve;
    rejectTask = reject;
  });
  
  // Push task to queue
  queue.push({
    id: taskId,
    execute: async () => {
      const startTime = Date.now();
      logger.debug(`Executing task ${taskId} from ${service} queue`);
      
      // Set task timeout
      const timeoutDuration = isLongRunning 
        ? queueConfig[service].taskTimeoutFetchContent 
        : queueConfig[service].taskTimeout;
      
      const timeoutId = setTimeout(() => {
        logger.error(`Task ${taskId} timed out after ${timeoutDuration}ms`);
        rejectTask(new Error(`Task timed out after ${timeoutDuration}ms`));
        
        // Remove from active tasks
        activeTasks[service].delete(taskId);
        
        // Increment consecutive errors
        consecutiveErrors[service]++;
        
        // Log consecutive errors
        if (consecutiveErrors[service] >= queueConfig[service].maxConsecutiveErrors) {
          logger.error(`Too many consecutive errors (${consecutiveErrors[service]}) in ${service} queue. Backing off for ${queueConfig[service].errorBackoff}ms`);
        }
      }, timeoutDuration);
      
      taskTimeouts[taskId] = timeoutId;
      
      try {
        // Execute the task
        const result = await execute();
        
        // Clear the timeout
        clearTimeout(timeoutId);
        delete taskTimeouts[taskId];
        
        // Calculate task duration
        const duration = Date.now() - startTime;
        
        // Store task duration for monitoring
        taskDurations[service].push(duration);
        if (taskDurations[service].length > MAX_TASK_DURATIONS) {
          taskDurations[service].shift();
        }
        
        // Reset consecutive errors on success
        consecutiveErrors[service] = 0;
        
        // Log success
        logger.debug(`Task ${taskId} completed in ${duration}ms`);
        
        // Resolve the promise
        resolveTask(result);
        return result;
      } catch (error) {
        // Clear the timeout
        clearTimeout(timeoutId);
        delete taskTimeouts[taskId];
        
        // Calculate task duration even for errors
        const duration = Date.now() - startTime;
        
        // Increment consecutive errors
        consecutiveErrors[service]++;
        
        // Log error
        logger.error(`Task ${taskId} failed after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`);
        
        // Log consecutive errors
        if (consecutiveErrors[service] >= queueConfig[service].maxConsecutiveErrors) {
          logger.error(`Too many consecutive errors (${consecutiveErrors[service]}) in ${service} queue. Backing off for ${queueConfig[service].errorBackoff}ms`);
        }
        
        // Reject the promise
        rejectTask(error);
        throw error;
      } finally {
        // Remove from active tasks
        activeTasks[service].delete(taskId);
      }
    },
    priority,
    timestamp: Date.now(),
    service,
    isLongRunning
  });
  
  logger.debug(`Added task ${taskId} to ${service} queue. Queue size: ${queue.length}, Active: ${activeTasks[service].size}/${queueConfig[service].concurrency}`);
  
  // Sort queue by priority (higher first) and then by timestamp (oldest first)
  queue.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return a.timestamp - b.timestamp;
  });
  
  // Start processing the queue if it's not already running
  if (!isProcessing[service]) {
    processQueue(service);
  }
  
  return taskPromise;
}

/**
 * Process the queue for a specific service
 */
function processQueue(service: 'openai' | 'general'): void {
  // If already processing, just return
  if (isProcessing[service]) {
    return;
  }
  
  // Set processing flag
  isProcessing[service] = true;
  
  // Clear any existing idle timer
  if (idleTimers[service]) {
    clearTimeout(idleTimers[service]!);
    idleTimers[service] = null;
  }
  
  // Define the processing function
  const processNextTask = async () => {
    try {
      // Check if there are any tasks in the queue
      if (taskQueues[service].length === 0) {
        // No tasks, set idle timer to stop processing after a while
        idleTimers[service] = setTimeout(() => {
          logger.debug(`${service} queue idle for ${queueConfig[service].idleTimeout}ms, stopping processing`);
          isProcessing[service] = false;
          idleTimers[service] = null;
        }, queueConfig[service].idleTimeout);
        
        return;
      }
      
      // Check if we've hit the maximum consecutive errors
      if (consecutiveErrors[service] >= queueConfig[service].maxConsecutiveErrors) {
        logger.warn(`Too many consecutive errors in ${service} queue, backing off for ${queueConfig[service].errorBackoff}ms`);
        
        // Wait for the backoff period
        await new Promise(resolve => setTimeout(resolve, queueConfig[service].errorBackoff));
        
        // Reset consecutive errors
        consecutiveErrors[service] = Math.floor(consecutiveErrors[service] / 2); // Reduce but not eliminate
        
        // Try again
        setImmediate(processNextTask);
        return;
      }
      
      // Check if we can process more tasks
      if (activeTasks[service].size >= queueConfig[service].concurrency) {
        // Wait for a task to complete
        setTimeout(processNextTask, 100);
        return;
      }
      
      // Check if we need to wait for rate limiting
      const now = Date.now();
      const timeSinceLastTask = now - lastTaskTimes[service];
      if (timeSinceLastTask < queueConfig[service].minInterval) {
        // Wait for the minimum interval
        setTimeout(processNextTask, queueConfig[service].minInterval - timeSinceLastTask);
        return;
      }
      
      // Get the next task
      const task = taskQueues[service].shift();
      if (!task) {
        // No task, try again later
        setTimeout(processNextTask, 100);
        return;
      }
      
      // Add to active tasks
      activeTasks[service].add(task.id);
      
      // Update last task time
      lastTaskTimes[service] = now;
      
      // Execute the task
      task.execute()
        .catch(error => {
          // Error already logged in the task execute function
        })
        .finally(() => {
          // Try to process more tasks, but don't block on this
          setImmediate(processNextTask);
        });
      
      // Try to process more tasks immediately if possible
      setImmediate(processNextTask);
    } catch (error) {
      // Log error but don't let the processing loop die
      logger.error(`Error in ${service} queue processing loop: ${error instanceof Error ? error.message : String(error)}`);
      
      // Try again later
      setTimeout(processNextTask, 1000);
    }
  };
  
  // Start processing
  processNextTask();
}

/**
 * Get the current queue status
 */
export function getQueueStatus(): Record<string, { 
  queued: number; 
  active: number; 
  maxConcurrency: number;
  consecutiveErrors: number;
  avgTaskDuration: number | null;
  medianTaskDuration: number | null;
  maxTaskDuration: number | null;
  processing: boolean;
  backingOff: boolean;
}> {
  const result: Record<string, any> = {};
  
  for (const service of ['openai', 'general'] as const) {
    // Calculate task duration statistics
    let avgTaskDuration = null;
    let medianTaskDuration = null;
    let maxTaskDuration = null;
    
    if (taskDurations[service].length > 0) {
      // Calculate average
      avgTaskDuration = taskDurations[service].reduce((sum, duration) => sum + duration, 0) / taskDurations[service].length;
      
      // Calculate median
      const sortedDurations = [...taskDurations[service]].sort((a, b) => a - b);
      const middle = Math.floor(sortedDurations.length / 2);
      medianTaskDuration = sortedDurations.length % 2 === 0
        ? (sortedDurations[middle - 1] + sortedDurations[middle]) / 2
        : sortedDurations[middle];
      
      // Calculate max
      maxTaskDuration = Math.max(...taskDurations[service]);
    }
    
    result[service] = {
      queued: taskQueues[service].length,
      active: activeTasks[service].size,
      maxConcurrency: queueConfig[service].concurrency,
      consecutiveErrors: consecutiveErrors[service],
      avgTaskDuration,
      medianTaskDuration,
      maxTaskDuration,
      processing: isProcessing[service],
      backingOff: consecutiveErrors[service] >= queueConfig[service].maxConsecutiveErrors
    };
  }
  
  return result;
}

/**
 * Clear all tasks from a specific queue
 */
export function clearQueue(service: 'openai' | 'general'): void {
  logger.info(`Clearing ${service} queue (${taskQueues[service].length} tasks)`);
  
  // Cancel all active tasks
  for (const taskId of activeTasks[service]) {
    if (taskTimeouts[taskId]) {
      clearTimeout(taskTimeouts[taskId]);
      delete taskTimeouts[taskId];
    }
  }
  
  // Clear the queue
  taskQueues[service] = [];
  activeTasks[service] = new Set();
  
  // Reset consecutive errors
  consecutiveErrors[service] = 0;
}

/**
 * Configure a specific queue's settings
 */
export function configureQueue(
  service: 'openai' | 'general',
  config: Partial<typeof queueConfig.openai>
): void {
  queueConfig[service] = {
    ...queueConfig[service],
    ...config
  };
  
  logger.info(`Configured ${service} queue: concurrency=${queueConfig[service].concurrency}, minInterval=${queueConfig[service].minInterval}ms`);
}

// Initialize the queue
export function initializeQueue(): void {
  // Reset all queues
  taskQueues.openai = [];
  taskQueues.general = [];
  
  activeTasks.openai = new Set();
  activeTasks.general = new Set();
  
  consecutiveErrors.openai = 0;
  consecutiveErrors.general = 0;
  
  // Clear any running timers
  for (const service of ['openai', 'general'] as const) {
    if (idleTimers[service]) {
      clearTimeout(idleTimers[service]!);
      idleTimers[service] = null;
    }
  }
  
  // Clear all task timeouts
  for (const taskId in taskTimeouts) {
    clearTimeout(taskTimeouts[taskId]);
    delete taskTimeouts[taskId];
  }
  
  // Log initialization
  logger.info('Task queue system initialized');
}

// Initialize the queue
initializeQueue();

// Export the queue configuration for testing
export const __queueConfig = queueConfig;
export const __taskQueues = taskQueues;
export const __activeTasks = activeTasks;
export const __consecutiveErrors = consecutiveErrors;
export const __lastTaskTimes = lastTaskTimes;
export const __taskDurations = taskDurations;
export const __taskTimeouts = taskTimeouts;
export const __isProcessing = isProcessing;
export const __idleTimers = idleTimers; 