import { logger } from '@/lib/logger';

/**
 * Task queue for managing API calls to prevent rate limiting
 */

// Task interface
interface Task<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
  addedAt: number;
  service: 'mistral' | 'openai';
}

// Queue configuration
interface QueueConfig {
  concurrency: number;
  interval: number;
}

// Default configuration
const DEFAULT_CONFIG: QueueConfig = {
  concurrency: 2, // Number of concurrent tasks
  interval: 1000, // Minimum time between task executions (ms)
};

// Queue state
const queues: {
  mistral: Task<any>[];
  openai: Task<any>[];
} = {
  mistral: [],
  openai: [],
};

// Active tasks count
const activeTasks: {
  mistral: number;
  openai: number;
} = {
  mistral: 0,
  openai: 0,
};

// Queue configuration
const queueConfig: {
  mistral: QueueConfig;
  openai: QueueConfig;
} = {
  mistral: { ...DEFAULT_CONFIG },
  openai: { ...DEFAULT_CONFIG },
};

// Last execution time
const lastExecutionTime: {
  mistral: number;
  openai: number;
} = {
  mistral: 0,
  openai: 0,
};

// Processing flags
let isProcessingMistral = false;
let isProcessingOpenAI = false;

/**
 * Add a task to the queue
 */
export async function queueTask<T>(
  service: 'mistral' | 'openai',
  taskFn: () => Promise<T>,
  options: {
    priority?: number;
    taskId?: string;
  } = {}
): Promise<T> {
  const { priority = 0, taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` } = options;
  
  logger.debug(`Adding task ${taskId} to ${service} queue with priority ${priority}`);
  
  return new Promise<T>((resolve, reject) => {
    // Create the task
    const task: Task<T> = {
      id: taskId,
      execute: taskFn,
      resolve,
      reject,
      priority,
      addedAt: Date.now(),
      service,
    };
    
    // Add to the appropriate queue
    queues[service].push(task);
    
    // Sort the queue by priority (higher first) and then by added time (earlier first)
    queues[service].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.addedAt - b.addedAt;
    });
    
    // Start processing the queue if not already processing
    if (service === 'mistral' && !isProcessingMistral) {
      processMistralQueue();
    } else if (service === 'openai' && !isProcessingOpenAI) {
      processOpenAIQueue();
    }
  });
}

/**
 * Process the Mistral queue
 */
async function processMistralQueue(): Promise<void> {
  if (isProcessingMistral) return;
  
  isProcessingMistral = true;
  
  try {
    while (queues.mistral.length > 0) {
      // Check if we can execute more tasks
      if (activeTasks.mistral >= queueConfig.mistral.concurrency) {
        // Wait for active tasks to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // Check if we need to wait for the interval
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutionTime.mistral;
      
      if (timeSinceLastExecution < queueConfig.mistral.interval) {
        // Wait for the interval
        await new Promise(resolve => setTimeout(resolve, queueConfig.mistral.interval - timeSinceLastExecution));
      }
      
      // Get the next task
      const task = queues.mistral.shift();
      if (!task) continue;
      
      // Update last execution time
      lastExecutionTime.mistral = Date.now();
      
      // Increment active tasks
      activeTasks.mistral++;
      
      // Execute the task
      logger.debug(`Executing Mistral task ${task.id}`);
      
      task.execute()
        .then(result => {
          task.resolve(result);
          logger.debug(`Completed Mistral task ${task.id}`);
        })
        .catch(error => {
          task.reject(error);
          logger.error(`Failed Mistral task ${task.id}:`, error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          // Decrement active tasks
          activeTasks.mistral--;
        });
    }
  } finally {
    isProcessingMistral = false;
    
    // If new tasks were added while processing, start processing again
    if (queues.mistral.length > 0) {
      processMistralQueue();
    }
  }
}

/**
 * Process the OpenAI queue
 */
async function processOpenAIQueue(): Promise<void> {
  if (isProcessingOpenAI) return;
  
  isProcessingOpenAI = true;
  
  try {
    while (queues.openai.length > 0) {
      // Check if we can execute more tasks
      if (activeTasks.openai >= queueConfig.openai.concurrency) {
        // Wait for active tasks to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // Check if we need to wait for the interval
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutionTime.openai;
      
      if (timeSinceLastExecution < queueConfig.openai.interval) {
        // Wait for the interval
        await new Promise(resolve => setTimeout(resolve, queueConfig.openai.interval - timeSinceLastExecution));
      }
      
      // Get the next task
      const task = queues.openai.shift();
      if (!task) continue;
      
      // Update last execution time
      lastExecutionTime.openai = Date.now();
      
      // Increment active tasks
      activeTasks.openai++;
      
      // Execute the task
      logger.debug(`Executing OpenAI task ${task.id}`);
      
      task.execute()
        .then(result => {
          task.resolve(result);
          logger.debug(`Completed OpenAI task ${task.id}`);
        })
        .catch(error => {
          task.reject(error);
          logger.error(`Failed OpenAI task ${task.id}:`, error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          // Decrement active tasks
          activeTasks.openai--;
        });
    }
  } finally {
    isProcessingOpenAI = false;
    
    // If new tasks were added while processing, start processing again
    if (queues.openai.length > 0) {
      processOpenAIQueue();
    }
  }
}

/**
 * Configure the queue
 */
export function configureQueue(
  service: 'mistral' | 'openai',
  config: Partial<QueueConfig>
): void {
  queueConfig[service] = {
    ...queueConfig[service],
    ...config,
  };
  
  logger.info(`Configured ${service} queue:`, queueConfig[service]);
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  mistral: { queued: number; active: number };
  openai: { queued: number; active: number };
} {
  return {
    mistral: {
      queued: queues.mistral.length,
      active: activeTasks.mistral,
    },
    openai: {
      queued: queues.openai.length,
      active: activeTasks.openai,
    },
  };
}

// Configure queues based on environment
if (process.env.MISTRAL_QUEUE_CONCURRENCY) {
  configureQueue('mistral', {
    concurrency: parseInt(process.env.MISTRAL_QUEUE_CONCURRENCY, 10),
  });
}

if (process.env.MISTRAL_QUEUE_INTERVAL) {
  configureQueue('mistral', {
    interval: parseInt(process.env.MISTRAL_QUEUE_INTERVAL, 10),
  });
}

if (process.env.OPENAI_QUEUE_CONCURRENCY) {
  configureQueue('openai', {
    concurrency: parseInt(process.env.OPENAI_QUEUE_CONCURRENCY, 10),
  });
}

if (process.env.OPENAI_QUEUE_INTERVAL) {
  configureQueue('openai', {
    interval: parseInt(process.env.OPENAI_QUEUE_INTERVAL, 10),
  });
} 