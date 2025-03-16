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
}

// Queue configuration
const queueConfig = {
  openai: {
    concurrency: 4, // Allow 4 concurrent OpenAI tasks
    minInterval: 800, // Minimum time between requests in ms
    maxQueueSize: 100, // Maximum queue size
    timeout: 60000, // Timeout for tasks in ms
  },
  general: {
    concurrency: 10, // Allow 10 concurrent general tasks
    minInterval: 0, // No minimum interval for general tasks
    maxQueueSize: 100, // Maximum queue size
    timeout: 60000, // Timeout for tasks in ms
  }
};

// Task queues
const taskQueues: {
  openai: Task[];
  general: Task[];
} = {
  openai: [],
  general: [],
};

// Active tasks counter
const activeTasks: {
  openai: number;
  general: number;
} = {
  openai: 0,
  general: 0,
};

// Last execution time
const lastExecutionTime: {
  openai: number;
  general: number;
} = {
  openai: 0,
  general: 0,
};

// Track error rates to dynamically adjust queue parameters
const errorTracking = {
  openai: {
    recentErrors: 0,
    totalCalls: 0,
    lastReset: Date.now(),
  },
  general: {
    recentErrors: 0,
    totalCalls: 0,
    lastReset: Date.now(),
  },
};

// Reset error tracking every 5 minutes
setInterval(() => {
  Object.keys(errorTracking).forEach(service => {
    const tracker = errorTracking[service as keyof typeof errorTracking];
    tracker.recentErrors = 0;
    tracker.totalCalls = 0;
    tracker.lastReset = Date.now();
  });
  logger.debug('Reset error tracking for all services');
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
  } = {}
): Promise<T> {
  const { priority = 0, taskId = generateTaskId() } = options;
  
  // Create a promise that will be resolved when the task completes
  let resolveTask!: (value: T) => void;
  let rejectTask!: (reason: any) => void;
  
  const taskPromise = new Promise<T>((resolve, reject) => {
    resolveTask = resolve;
    rejectTask = reject;
  });
  
  // Create the task
  const task: Task = {
    id: taskId,
    execute: async () => {
      try {
        const result = await execute();
        resolveTask(result);
        return result;
      } catch (error) {
        rejectTask(error);
        throw error;
      }
    },
    priority,
    timestamp: Date.now(),
    service,
  };
  
  // Check if queue is full
  if (taskQueues[service].length >= queueConfig[service].maxQueueSize) {
    // If queue is full, reject low priority tasks or wait for high priority tasks
    if (priority < 5) {
      const error = new Error(`Task queue for ${service} is full (${taskQueues[service].length} tasks)`);
      rejectTask(error);
      throw error;
    } else {
      // For high priority tasks, wait until there's space
      logger.warn(`High priority task waiting for queue space in ${service} queue`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Add task to queue
  taskQueues[service].push(task);
  
  // Log queue status for monitoring
  logger.debug(`Added task to ${service} queue. Queue size: ${taskQueues[service].length}, Active: ${activeTasks[service]}/${queueConfig[service].concurrency}`);
  
  // Process queue
  processQueue(service);
  
  // Return the promise that will be resolved when the task completes
  return taskPromise;
}

/**
 * Process the queue for a specific service
 */
function processQueue(service: 'openai' | 'general'): void {
  // If we're already at max concurrency, don't process more tasks
  if (activeTasks[service] >= queueConfig[service].concurrency) {
    return;
  }
  
  // Check if we need to wait before processing the next task
  const now = Date.now();
  const timeSinceLastExecution = now - lastExecutionTime[service];
  
  if (timeSinceLastExecution < queueConfig[service].minInterval) {
    // Schedule processing after the minimum interval
    setTimeout(() => processQueue(service), queueConfig[service].minInterval - timeSinceLastExecution);
    return;
  }
  
  // If there are no tasks in the queue, nothing to do
  if (taskQueues[service].length === 0) {
    return;
  }
  
  // Sort tasks by priority (higher first) and then by timestamp (older first)
  taskQueues[service].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    return a.timestamp - b.timestamp; // Older tasks first
  });
  
  // Get the next task
  const task = taskQueues[service].shift();
  if (!task) return;
  
  // Update active tasks count
  activeTasks[service]++;
  
  // Update last execution time
  lastExecutionTime[service] = now;
  
  // Execute the task
  logger.debug(`Executing task ${task.id} from ${service} queue`);
  
  // Track this call
  errorTracking[service].totalCalls++;

  task.execute()
    .catch(error => {
      logger.error(`Error executing task ${task.id} from ${service} queue:`, error);
      // Track error for dynamic queue adjustment
      errorTracking[service].recentErrors++;
      
      // If error rate is too high, adjust queue parameters
      const errorRate = errorTracking[service].recentErrors / Math.max(errorTracking[service].totalCalls, 1);
      if (errorRate > 0.3 && errorTracking[service].totalCalls > 5) {
        // If more than 30% of calls are failing, reduce concurrency and increase interval
        const currentConcurrency = queueConfig[service].concurrency;
        const currentInterval = queueConfig[service].minInterval;
        
        if (currentConcurrency > 1) {
          queueConfig[service].concurrency = Math.max(1, currentConcurrency - 1);
        }
        
        queueConfig[service].minInterval = Math.min(10000, currentInterval * 1.5);
        
        logger.warn(
          `High error rate (${(errorRate * 100).toFixed(1)}%) for ${service} API. ` +
          `Reducing concurrency to ${queueConfig[service].concurrency} and ` +
          `increasing interval to ${queueConfig[service].minInterval}ms`
        );
      }
    })
    .finally(() => {
      // Decrease active tasks count
      activeTasks[service]--;
      
      // Process the next task
      // Add a small delay to prevent tight loops
      setTimeout(() => processQueue(service), 50);
    });
}

/**
 * Get the current queue status
 */
export function getQueueStatus(): Record<string, { queued: number; active: number; maxConcurrency: number }> {
  return {
    openai: {
      queued: taskQueues.openai.length,
      active: activeTasks.openai,
      maxConcurrency: queueConfig.openai.concurrency,
    },
    general: {
      queued: taskQueues.general.length,
      active: activeTasks.general,
      maxConcurrency: queueConfig.general.concurrency,
    },
  };
}

/**
 * Clear all tasks from a specific queue
 */
export function clearQueue(service: 'openai' | 'general'): void {
  const queueSize = taskQueues[service].length;
  taskQueues[service] = [];
  logger.info(`Cleared ${queueSize} tasks from ${service} queue`);
}

/**
 * Configure a specific queue's settings
 */
export function configureQueue(
  service: 'openai' | 'general',
  config: Partial<typeof queueConfig.openai>
): void {
  if (!queueConfig[service]) {
    logger.warn(`Invalid service: ${service}`);
    return;
  }
  
  // Update configuration
  queueConfig[service] = {
    ...queueConfig[service],
    ...config,
  };
  
  // Log configuration
  logger.info(`Configured ${service} queue: concurrency=${queueConfig[service].concurrency}, minInterval=${queueConfig[service].minInterval}ms`);
}

// Initialize the queue
export function initializeQueue(): void {
  // Configure OpenAI queue
  configureQueue('openai', {
    concurrency: 4,
    minInterval: 800,
  });
  
  // Configure general queue
  configureQueue('general', {
    concurrency: 10,
    minInterval: 0,
  });
  
  // Log configuration
  logger.info(`Configured openai queue: concurrency=${queueConfig.openai.concurrency}, minInterval=${queueConfig.openai.minInterval}ms`);
  logger.info(`Configured general queue: concurrency=${queueConfig.general.concurrency}, minInterval=${queueConfig.general.minInterval}ms`);
}

// Initialize the queue
initializeQueue();

// Export the queue configuration for testing
export const __queueConfig = queueConfig;
export const __taskQueues = taskQueues;
export const __activeTasks = activeTasks;
export const __lastExecutionTime = lastExecutionTime; 