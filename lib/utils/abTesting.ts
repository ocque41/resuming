import { logger } from '@/lib/logger';
import { trackEvent } from './analytics';

/**
 * A/B Testing Framework for CV Optimizer
 * 
 * This system allows testing different variations of prompts and processing
 * strategies to determine which combinations yield the best results.
 */

// Define test variant types
export type PromptVariant = {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  systemPrompt: string;
  model: string;
  parameters: {
    temperature: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  }
};

export type ExperimentConfig = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  variants: PromptVariant[];
  trafficAllocation: number; // 0-100, percentage of traffic to include in test
};

export type ExperimentResult = {
  experimentId: string;
  variantId: string;
  cvId: number | string;
  userId?: number | string;
  timestamp: string;
  metrics: {
    processingTime: number; // milliseconds
    tokenCount: number;
    responseLength: number;
    atsScoreImprovement: number;
    errorOccurred: boolean;
  };
};

// Store active experiments
const activeExperiments: ExperimentConfig[] = [];
const experimentResults: ExperimentResult[] = [];

// Store assigned variants for consistent user experience
const userAssignments: Record<string, Record<string, string>> = {}; // userId -> { experimentId -> variantId }

/**
 * Register a new A/B test experiment
 */
export function registerExperiment(experiment: ExperimentConfig): void {
  // Validate experiment
  if (!experiment.id || !experiment.variants || experiment.variants.length < 2) {
    logger.error('Invalid experiment configuration', JSON.stringify(experiment));
    throw new Error('Invalid experiment configuration: Experiments require at least 2 variants');
  }
  
  // Check if experiment already exists
  const existingIndex = activeExperiments.findIndex(e => e.id === experiment.id);
  if (existingIndex >= 0) {
    // Update existing experiment
    activeExperiments[existingIndex] = experiment;
    logger.info(`Updated experiment: ${experiment.id}`);
  } else {
    // Add new experiment
    activeExperiments.push(experiment);
    logger.info(`Registered new experiment: ${experiment.id}`);
  }
}

/**
 * Deactivate an experiment
 */
export function deactivateExperiment(experimentId: string): void {
  const experimentIndex = activeExperiments.findIndex(e => e.id === experimentId);
  if (experimentIndex >= 0) {
    activeExperiments[experimentIndex].isActive = false;
    activeExperiments[experimentIndex].endDate = new Date().toISOString();
    logger.info(`Deactivated experiment: ${experimentId}`);
  }
}

/**
 * Get variant for a specific user and experiment
 */
export function getVariantForUser(
  userId: string | number,
  experimentId: string,
  cvId?: string | number
): PromptVariant | null {
  // Get experiment
  const experiment = activeExperiments.find(e => e.id === experimentId && e.isActive);
  if (!experiment) {
    return null;
  }
  
  // Check if we should include this user in the experiment based on traffic allocation
  const userIdString = String(userId);
  const hashValue = simpleHash(`${userIdString}-${experimentId}`);
  const normalizedHash = hashValue % 100; // 0-99
  
  if (normalizedHash >= experiment.trafficAllocation) {
    // User not allocated to this experiment
    return null;
  }
  
  // Check if user already has an assignment
  if (!userAssignments[userIdString]) {
    userAssignments[userIdString] = {};
  }
  
  if (!userAssignments[userIdString][experimentId]) {
    // Assign a variant
    const variantIndex = hashValue % experiment.variants.length;
    userAssignments[userIdString][experimentId] = experiment.variants[variantIndex].id;
    
    // Track assignment
    trackEvent({
      eventType: 'checkpoint_reached',
      cvId: cvId || 'unknown',
      userId,
      timestamp: new Date().toISOString(),
      phase: 'ab_testing',
      metadata: {
        experimentId,
        variantId: experiment.variants[variantIndex].id,
        variantName: experiment.variants[variantIndex].name
      }
    });
  }
  
  // Get assigned variant
  const variantId = userAssignments[userIdString][experimentId];
  return experiment.variants.find(v => v.id === variantId) || null;
}

/**
 * Record experiment result
 */
export function recordExperimentResult(result: ExperimentResult): void {
  experimentResults.push(result);
  
  // Log result
  logger.info(`Recorded experiment result for experiment ${result.experimentId}, variant ${result.variantId}`, {
    experimentId: result.experimentId,
    variantId: result.variantId,
    metrics: result.metrics
  });
  
  // Track in analytics
  trackEvent({
    eventType: 'checkpoint_reached',
    cvId: result.cvId,
    userId: result.userId,
    timestamp: result.timestamp,
    phase: 'ab_testing_result',
    metadata: {
      experimentId: result.experimentId,
      variantId: result.variantId,
      metrics: result.metrics
    }
  });
}

/**
 * Get experiment results
 */
export function getExperimentResults(experimentId: string): {
  experimentName: string;
  variantResults: {
    variantId: string;
    variantName: string;
    count: number;
    avgProcessingTime: number;
    avgTokenCount: number;
    avgResponseLength: number;
    avgAtsScoreImprovement: number;
    errorRate: number;
  }[];
} {
  // Get experiment
  const experiment = activeExperiments.find(e => e.id === experimentId);
  if (!experiment) {
    throw new Error(`Experiment ${experimentId} not found`);
  }
  
  // Get results for this experiment
  const results = experimentResults.filter(r => r.experimentId === experimentId);
  
  // Process results by variant
  const variantResults = experiment.variants.map(variant => {
    const variantResults = results.filter(r => r.variantId === variant.id);
    const count = variantResults.length;
    
    if (count === 0) {
      return {
        variantId: variant.id,
        variantName: variant.name,
        count: 0,
        avgProcessingTime: 0,
        avgTokenCount: 0,
        avgResponseLength: 0,
        avgAtsScoreImprovement: 0,
        errorRate: 0
      };
    }
    
    // Calculate averages
    const avgProcessingTime = variantResults.reduce((sum, r) => sum + r.metrics.processingTime, 0) / count;
    const avgTokenCount = variantResults.reduce((sum, r) => sum + r.metrics.tokenCount, 0) / count;
    const avgResponseLength = variantResults.reduce((sum, r) => sum + r.metrics.responseLength, 0) / count;
    const avgAtsScoreImprovement = variantResults.reduce((sum, r) => sum + r.metrics.atsScoreImprovement, 0) / count;
    const errorCount = variantResults.filter(r => r.metrics.errorOccurred).length;
    const errorRate = count > 0 ? errorCount / count : 0;
    
    return {
      variantId: variant.id,
      variantName: variant.name,
      count,
      avgProcessingTime,
      avgTokenCount,
      avgResponseLength,
      avgAtsScoreImprovement,
      errorRate
    };
  });
  
  return {
    experimentName: experiment.name,
    variantResults
  };
}

/**
 * Simple hash function for consistent assignments
 */
function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Clear experiment data (for testing)
 */
export function clearExperimentData(): void {
  activeExperiments.length = 0;
  experimentResults.length = 0;
  Object.keys(userAssignments).forEach(key => delete userAssignments[key]);
}

// Register initial example experiments
registerExperiment({
  id: 'analysis-prompt-optimization',
  name: 'CV Analysis Prompt Optimization',
  description: 'Testing different analysis prompt formats to improve accuracy and processing time',
  isActive: true,
  startDate: new Date().toISOString(),
  variants: [
    {
      id: 'control',
      name: 'Current Prompt',
      description: 'Current production prompt for CV analysis',
      promptTemplate: `# CV Analysis - Concise Format
        ...
        ## Key Analysis Points
        - Find top 3 strengths
        - Find top 3 weaknesses 
        - Identify primary industry
        - Calculate ATS compatibility (0-100)
        - Provide 3 recommendations`,
      systemPrompt: 'You are a CV analyzer specialized in ATS compatibility. Be concise and direct. Output ONLY valid JSON.',
      model: 'gpt-4o-mini',
      parameters: {
        temperature: 0.3,
        max_tokens: 800,
      }
    },
    {
      id: 'structured-analysis',
      name: 'Structured Analysis Prompt',
      description: 'More structured approach with specific sections to analyze',
      promptTemplate: `# CV Analysis - Structured Approach
        ...
        ## Structured Analysis Required
        1. CONTACT: Evaluate contact information completeness
        2. SKILLS: Rate skills relevance (0-10)
        3. EXPERIENCE: Score impact statements (0-10)
        4. EDUCATION: Check format and relevance
        5. Overall ATS score (0-100)`,
      systemPrompt: 'You are an ATS scoring system. Follow the structured approach exactly. Respond ONLY with valid JSON.',
      model: 'gpt-4o-mini',
      parameters: {
        temperature: 0.2,
        max_tokens: 800,
      }
    },
    {
      id: 'minimal-analysis',
      name: 'Minimal Analysis Prompt',
      description: 'Ultra-focused minimal prompt for faster processing',
      promptTemplate: `CV Analysis:
        Extract: Industry, ATS Score (0-100), 3 Strengths, 3 Weaknesses, 3 Tips
        Content: {{truncated_content}}
        Output: ONLY valid JSON with these 5 fields`,
      systemPrompt: 'You are an efficient CV analyzer. Be extremely concise. Output ONLY the required JSON fields.',
      model: 'gpt-4o-mini',
      parameters: {
        temperature: 0.3,
        max_tokens: 500,
      }
    }
  ],
  trafficAllocation: 50 // 50% of traffic included in this test
});

registerExperiment({
  id: 'optimization-prompt-test',
  name: 'CV Optimization Strategy Test',
  description: 'Testing different optimization strategies for improved ATS scores',
  isActive: true,
  startDate: new Date().toISOString(),
  variants: [
    {
      id: 'standard-optimization',
      name: 'Current Optimization Approach',
      description: 'Current production optimization process',
      promptTemplate: `# CV Optimization - Fast Response Required
        ...
        ## Optimization Instructions (IMPORTANT)
        1. Maintain SAME structure and sections
        2. Enhance with industry keywords
        3. Add action verbs to achievements
        4. Keep the same information but improve wording`,
      systemPrompt: 'You are a CV optimizer. Provide ONLY the improved CV text with no additional commentary. Be fast and efficient.',
      model: 'gpt-4o-mini',
      parameters: {
        temperature: 0.4,
        max_tokens: 4000,
      }
    },
    {
      id: 'keyword-focused',
      name: 'Keyword Optimization',
      description: 'Focus primarily on keyword optimization for ATS',
      promptTemplate: `# CV Optimization - ATS Keyword Focus
        ...
        ## Target Industry: {{industry}}
        ## Top Keywords to Include:
        {{industry_keywords}}
        
        ## Instructions:
        1. ONLY enhance keywords - maintain everything else
        2. Replace generic terms with industry-specific keywords
        3. Keep same structure and content`,
      systemPrompt: 'You are an ATS keyword optimizer. Your only job is to enhance the CV with relevant keywords while preserving structure. Be subtle and natural.',
      model: 'gpt-4o-mini',
      parameters: {
        temperature: 0.3,
        max_tokens: 4000,
      }
    },
    {
      id: 'achievement-focused',
      name: 'Achievement Enhancement',
      description: 'Focus on enhancing achievement statements and metrics',
      promptTemplate: `# CV Optimization - Achievement Focus
        ...
        ## Instructions:
        1. Identify all achievement statements
        2. Enhance with metrics and results (based on context)
        3. Add powerful action verbs
        4. Quantify impact where possible
        5. Keep everything else the same`,
      systemPrompt: 'You are an achievement optimization specialist. Focus ONLY on improving achievement statements with metrics and impact. Preserve everything else.',
      model: 'gpt-4o-mini',
      parameters: {
        temperature: 0.5,
        max_tokens: 4000,
      }
    }
  ],
  trafficAllocation: 30 // 30% of traffic included in this test
}); 