import { OpenAI } from "openai";
import { logger } from "@/lib/logger";

/**
 * Warm-up Cache System for CV Optimizer
 * 
 * This module provides functionality to "warm up" AI models by sending
 * preliminary requests before actual processing begins. This reduces cold
 * start latency and improves overall processing time.
 */

type CachedModel = {
  model: string;
  lastWarmedUp: number;
  inProgress: boolean;
};

// Track which models have been warmed up recently
const warmupCache: Record<string, CachedModel> = {
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    lastWarmedUp: 0,
    inProgress: false
  },
  'gpt-4o': {
    model: 'gpt-4o',
    lastWarmedUp: 0,
    inProgress: false
  }
};

// Config
const WARMUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const WARMUP_TIMEOUT_MS = 30 * 1000; // 30 seconds

/**
 * Sends a simple warm-up request to an AI model
 * 
 * @param model The model identifier to warm up
 * @returns Promise resolving to true if successful, false otherwise
 */
async function warmupModel(model: string): Promise<boolean> {
  try {
    logger.info(`Starting warm-up for model: ${model}`);
    
    // Set the warm-up in progress
    warmupCache[model].inProgress = true;
    
    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Very simple message to just warm up the connection
    const warmupPrompt = "Warm up request. Respond with OK.";
    
    // Create timeout promise
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error(`Warm-up timed out for model ${model}`)), WARMUP_TIMEOUT_MS);
    });
    
    // Create API call promise
    const apiPromise = openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are a warm-up system. Respond briefly to initialize the connection."
        },
        {
          role: "user",
          content: warmupPrompt
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    });
    
    // Race the API call against the timeout
    const response = await Promise.race([apiPromise, timeoutPromise]);
    
    if (response) {
      // Update the warm-up timestamp
      warmupCache[model].lastWarmedUp = Date.now();
      warmupCache[model].inProgress = false;
      
      logger.info(`Warm-up completed successfully for model: ${model}`);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Error warming up model ${model}:`, error instanceof Error ? error.message : String(error));
    
    // Reset the in-progress flag
    warmupCache[model].inProgress = false;
    return false;
  }
}

/**
 * Check if a model needs warming up and do so if needed
 * 
 * @param model The model identifier to check
 * @returns Promise resolving to true if model is ready (already warm or successfully warmed up), false otherwise
 */
export async function ensureModelWarmedUp(model: string): Promise<boolean> {
  // If the model isn't in our cache, add it
  if (!warmupCache[model]) {
    warmupCache[model] = {
      model,
      lastWarmedUp: 0,
      inProgress: false
    };
  }
  
  const cachedModel = warmupCache[model];
  const now = Date.now();
  
  // If the model is already warmed up recently, it's ready
  if (now - cachedModel.lastWarmedUp < WARMUP_INTERVAL_MS) {
    return true;
  }
  
  // If a warm-up is already in progress, wait briefly and then consider it ready anyway
  if (cachedModel.inProgress) {
    logger.info(`Warm-up already in progress for model: ${model}`);
    
    // Wait for a short time then continue
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
  
  // Perform the warm-up
  return await warmupModel(model);
}

/**
 * Warm up all registered models
 * 
 * @returns Promise resolving when all warm-ups are complete (successful or not)
 */
export async function warmupAllModels(): Promise<void> {
  const models = Object.keys(warmupCache);
  logger.info(`Starting warm-up for all ${models.length} registered models`);
  
  // Warm up all models concurrently
  await Promise.all(models.map(model => ensureModelWarmedUp(model)));
  
  logger.info('All model warm-ups completed');
}

/**
 * Force a warm-up of a specific model regardless of its current status
 * 
 * @param model The model identifier to force warm-up
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function forceWarmupModel(model: string): Promise<boolean> {
  // If the model isn't in our cache, add it
  if (!warmupCache[model]) {
    warmupCache[model] = {
      model,
      lastWarmedUp: 0,
      inProgress: false
    };
  }
  
  // Reset the last warmed up timestamp to force a warm-up
  warmupCache[model].lastWarmedUp = 0;
  
  // Perform the warm-up
  return await warmupModel(model);
}

/**
 * Set up a warm-up interval to keep models ready
 * 
 * @param intervalMinutes How often to warm up the models (in minutes)
 * @returns The interval ID for later clearing if needed
 */
export function setupWarmupInterval(intervalMinutes: number = 15): NodeJS.Timeout {
  logger.info(`Setting up warm-up interval for every ${intervalMinutes} minutes`);
  
  // Run an initial warm-up
  warmupAllModels().catch(err => {
    logger.error('Error during initial warm-up:', err instanceof Error ? err.message : String(err));
  });
  
  // Set up the interval
  return setInterval(() => {
    warmupAllModels().catch(err => {
      logger.error('Error during scheduled warm-up:', err instanceof Error ? err.message : String(err));
    });
  }, intervalMinutes * 60 * 1000);
}

/**
 * Get the status of the warm-up cache
 * 
 * @returns Information about the current warm-up cache state
 */
export function getWarmupStatus(): {
  models: {
    model: string;
    isWarmedUp: boolean;
    lastWarmedUpTimestamp: number;
    timeSinceWarmup: number;
    inProgress: boolean;
  }[];
} {
  const now = Date.now();
  
  const models = Object.values(warmupCache).map(cachedModel => ({
    model: cachedModel.model,
    isWarmedUp: now - cachedModel.lastWarmedUp < WARMUP_INTERVAL_MS,
    lastWarmedUpTimestamp: cachedModel.lastWarmedUp,
    timeSinceWarmup: now - cachedModel.lastWarmedUp,
    inProgress: cachedModel.inProgress
  }));
  
  return { models };
} 