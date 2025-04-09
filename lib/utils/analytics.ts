import { logger } from '@/lib/logger';

/**
 * CV Processing Analytics System
 * 
 * This module tracks performance metrics for the CV optimization system
 * to help identify bottlenecks and improve overall performance.
 */

// Types for analytics
export type ProcessingEvent = {
  eventType: 'process_start' | 'process_complete' | 'process_error' | 'phase_complete' | 'openai_call' | 'checkpoint_reached';
  cvId: number | string;
  userId?: number | string;
  timestamp: string;
  duration?: number;  // in milliseconds
  phase?: string;
  model?: string;
  status?: string;
  error?: string;
  tokenCount?: number;
  progress?: number;
  metadata?: any;
};

export type PerformanceMetrics = {
  totalProcessed: number;
  successRate: number;
  averageProcessingTime: number;  // in seconds
  averageAnalysisTime: number;    // in seconds
  averageOptimizationTime: number; // in seconds
  errorRate: number;
  stuckRate: number;
  averageAtsScoreImprovement: number;
  modelPerformance: {
    [key: string]: {
      callCount: number;
      averageResponseTime: number;
      errorRate: number;
    }
  }
};

// Document analysis feedback types
export type DocumentFeedback = {
  id: string;
  documentId: string;
  analysisType: string;
  rating: number;
  feedbackText?: string;
  userId: string;
  createdAt: string;
};

export type FeedbackStats = {
  averageRating: number;
  totalFeedbacks: number;
  ratingDistribution: {
    [key: string]: number; // 1, 2, 3, 4, 5 as keys
  };
  feedbackByDocumentType: {
    [key: string]: {
      count: number;
      averageRating: number;
    };
  };
  recentFeedbacks: Array<{
    documentId: string;
    analysisType: string;
    rating: number;
    feedbackText?: string;
    createdAt: string;
  }>;
  monthlyAverageRatings: Array<{
    month: string; 
    averageRating: number;
  }>;
};

// In-memory storage for events (in production this would be a database)
const processingEvents: ProcessingEvent[] = [];
const START_TIMES: Record<string, number> = {};
const PHASE_START_TIMES: Record<string, Record<string, number>> = {};

// In-memory storage for feedbacks - this would be a database in a real application
const documentFeedbacks: DocumentFeedback[] = [];

/**
 * Track a CV processing event
 */
export function trackEvent(event: ProcessingEvent): void {
  // Add event to our collection
  processingEvents.push({
    ...event,
    timestamp: event.timestamp || new Date().toISOString()
  });
  
  // Log the event
  logger.info(`Analytics event: ${event.eventType} for CV ${event.cvId}`, {
    cvId: event.cvId,
    eventType: event.eventType,
    phase: event.phase,
    duration: event.duration,
    error: event.error
  });
  
  // Update start times for tracking durations
  if (event.eventType === 'process_start') {
    START_TIMES[String(event.cvId)] = Date.now();
    PHASE_START_TIMES[String(event.cvId)] = {};
  } 
  else if (event.phase && event.eventType === 'phase_complete') {
    const phaseStart = PHASE_START_TIMES[String(event.cvId)]?.[event.phase];
    if (phaseStart) {
      // Calculate and update duration if not provided
      if (!event.duration) {
        event.duration = Date.now() - phaseStart;
      }
    }
  }
  else if (event.eventType === 'process_complete') {
    const startTime = START_TIMES[String(event.cvId)];
    if (startTime) {
      // Calculate and update duration if not provided
      if (!event.duration) {
        event.duration = Date.now() - startTime;
      }
      
      // Clean up
      delete START_TIMES[String(event.cvId)];
      delete PHASE_START_TIMES[String(event.cvId)];
    }
  }
}

/**
 * Start tracking a CV processing phase
 */
export function startPhase(cvId: number | string, phase: string): void {
  const eventId = String(cvId);
  
  // Initialize phase start times for this CV if they don't exist
  if (!PHASE_START_TIMES[eventId]) {
    PHASE_START_TIMES[eventId] = {};
  }
  
  // Record start time for this phase
  PHASE_START_TIMES[eventId][phase] = Date.now();
  
  // Track the event
  trackEvent({
    eventType: 'checkpoint_reached',
    cvId,
    timestamp: new Date().toISOString(),
    phase,
    status: 'started'
  });
}

/**
 * Complete tracking a CV processing phase
 */
export function completePhase(cvId: number | string, phase: string, metadata?: any): void {
  const eventId = String(cvId);
  let duration: number | undefined;
  
  // Calculate duration if we have a start time
  if (PHASE_START_TIMES[eventId]?.[phase]) {
    duration = Date.now() - PHASE_START_TIMES[eventId][phase];
  }
  
  // Track the completed phase
  trackEvent({
    eventType: 'phase_complete',
    cvId,
    timestamp: new Date().toISOString(),
    phase,
    duration,
    status: 'completed',
    metadata
  });
}

/**
 * Track an OpenAI API call
 */
export function trackOpenAICall(cvId: number | string, model: string, tokenCount: number, duration: number, error?: string): void {
  trackEvent({
    eventType: 'openai_call',
    cvId,
    timestamp: new Date().toISOString(),
    model,
    tokenCount,
    duration,
    error,
    status: error ? 'error' : 'success'
  });
}

/**
 * Calculate performance metrics based on collected events
 */
export function calculateMetrics(timeframeHours: number = 24): PerformanceMetrics {
  // Determine the cutoff time for the requested timeframe
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - timeframeHours);
  
  // Filter events within the timeframe
  const recentEvents = processingEvents.filter(event => 
    new Date(event.timestamp) >= cutoffTime
  );
  
  // Find all unique CV IDs that had processing started
  const startedCVs = new Set(
    recentEvents
      .filter(e => e.eventType === 'process_start')
      .map(e => String(e.cvId))
  );
  
  // Find all CVs that completed processing
  const completedCVs = new Set(
    recentEvents
      .filter(e => e.eventType === 'process_complete')
      .map(e => String(e.cvId))
  );
  
  // Find all CVs that had errors
  const errorCVs = new Set(
    recentEvents
      .filter(e => e.eventType === 'process_error')
      .map(e => String(e.cvId))
  );
  
  // Find stuck CVs (started but never completed and no error)
  const stuckCVs = new Set(
    [...startedCVs].filter(id => 
      !completedCVs.has(id) && !errorCVs.has(id)
    )
  );
  
  // Calculate success rate
  const totalProcessed = startedCVs.size;
  const successRate = totalProcessed > 0 ? completedCVs.size / totalProcessed : 0;
  const errorRate = totalProcessed > 0 ? errorCVs.size / totalProcessed : 0;
  const stuckRate = totalProcessed > 0 ? stuckCVs.size / totalProcessed : 0;
  
  // Calculate average processing times
  const processingTimes = recentEvents
    .filter(e => e.eventType === 'process_complete' && e.duration !== undefined)
    .map(e => e.duration as number);
  
  const averageProcessingTime = processingTimes.length > 0
    ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length / 1000 // convert to seconds
    : 0;
  
  // Calculate phase times
  const analysisTimes = recentEvents
    .filter(e => e.eventType === 'phase_complete' && e.phase === 'analysis' && e.duration !== undefined)
    .map(e => e.duration as number);
  
  const optimizationTimes = recentEvents
    .filter(e => e.eventType === 'phase_complete' && e.phase === 'optimization' && e.duration !== undefined)
    .map(e => e.duration as number);
  
  const averageAnalysisTime = analysisTimes.length > 0
    ? analysisTimes.reduce((sum, time) => sum + time, 0) / analysisTimes.length / 1000 // convert to seconds
    : 0;
  
  const averageOptimizationTime = optimizationTimes.length > 0
    ? optimizationTimes.reduce((sum, time) => sum + time, 0) / optimizationTimes.length / 1000 // convert to seconds
    : 0;
  
  // Calculate ATS score improvements
  const atsImprovements = recentEvents
    .filter(e => e.eventType === 'process_complete' && e.metadata?.atsScore !== undefined && e.metadata?.improvedAtsScore !== undefined)
    .map(e => (e.metadata.improvedAtsScore - e.metadata.atsScore) as number);
  
  const averageAtsScoreImprovement = atsImprovements.length > 0
    ? atsImprovements.reduce((sum, score) => sum + score, 0) / atsImprovements.length
    : 0;
  
  // Calculate model performance metrics
  const modelPerformance: Record<string, {
    callCount: number;
    averageResponseTime: number;
    errorRate: number;
  }> = {};
  
  // Group OpenAI calls by model
  const openAICalls = recentEvents.filter(e => e.eventType === 'openai_call');
  
  // Get unique models
  const models = [...new Set(openAICalls.map(e => e.model))].filter(Boolean) as string[];
  
  // Calculate metrics for each model
  models.forEach(model => {
    const modelCalls = openAICalls.filter(e => e.model === model);
    const errorCalls = modelCalls.filter(e => e.error !== undefined);
    
    const callTimes = modelCalls
      .filter(e => e.duration !== undefined)
      .map(e => e.duration as number);
    
    modelPerformance[model] = {
      callCount: modelCalls.length,
      averageResponseTime: callTimes.length > 0
        ? callTimes.reduce((sum, time) => sum + time, 0) / callTimes.length / 1000 // convert to seconds
        : 0,
      errorRate: modelCalls.length > 0
        ? errorCalls.length / modelCalls.length
        : 0
    };
  });
  
  // Return the calculated metrics
  return {
    totalProcessed,
    successRate,
    averageProcessingTime,
    averageAnalysisTime,
    averageOptimizationTime,
    errorRate,
    stuckRate,
    averageAtsScoreImprovement,
    modelPerformance
  };
}

/**
 * Get performance dashboard data
 */
export function getPerformanceDashboard(): {
  last24Hours: PerformanceMetrics;
  last7Days: PerformanceMetrics;
  last30Days: PerformanceMetrics;
} {
  return {
    last24Hours: calculateMetrics(24),
    last7Days: calculateMetrics(24 * 7),
    last30Days: calculateMetrics(24 * 30)
  };
}

/**
 * Clear analytics data (for testing or privacy purposes)
 */
export function clearAnalytics(): void {
  processingEvents.length = 0;
  Object.keys(START_TIMES).forEach(key => delete START_TIMES[key]);
  Object.keys(PHASE_START_TIMES).forEach(key => delete PHASE_START_TIMES[key]);
}

/**
 * Add document feedback to the storage
 */
export function addDocumentFeedback(feedback: Omit<DocumentFeedback, 'id' | 'createdAt'>): DocumentFeedback {
  const newFeedback: DocumentFeedback = {
    ...feedback,
    id: `feedback_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString()
  };
  
  documentFeedbacks.push(newFeedback);
  return newFeedback;
}

/**
 * Get all document feedbacks for a specific user or all users
 */
export function getDocumentFeedbacks(userId?: string): DocumentFeedback[] {
  if (userId) {
    return documentFeedbacks.filter(feedback => feedback.userId === userId);
  }
  return [...documentFeedbacks];
}

/**
 * Calculate feedback statistics
 */
export function calculateFeedbackStats(): FeedbackStats {
  if (documentFeedbacks.length === 0) {
    return {
      averageRating: 0,
      totalFeedbacks: 0,
      ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      feedbackByDocumentType: {},
      recentFeedbacks: [],
      monthlyAverageRatings: []
    };
  }
  
  // Calculate average rating
  const totalRating = documentFeedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
  const averageRating = totalRating / documentFeedbacks.length;
  
  // Calculate rating distribution
  const ratingDistribution = documentFeedbacks.reduce((dist, feedback) => {
    const rating = feedback.rating.toString();
    dist[rating] = (dist[rating] || 0) + 1;
    return dist;
  }, {} as Record<string, number>);
  
  // Ensure all rating keys exist
  ['1', '2', '3', '4', '5'].forEach(rating => {
    if (!ratingDistribution[rating]) {
      ratingDistribution[rating] = 0;
    }
  });
  
  // Calculate feedback by document type
  const feedbackByDocumentType = documentFeedbacks.reduce((types, feedback) => {
    if (!types[feedback.analysisType]) {
      types[feedback.analysisType] = {
        count: 0,
        totalRating: 0
      };
    }
    types[feedback.analysisType].count += 1;
    types[feedback.analysisType].totalRating += feedback.rating;
    return types;
  }, {} as Record<string, { count: number; totalRating: number }>);
  
  // Convert to average ratings with proper typing
  const typedFeedbackByDocumentType: Record<string, { count: number; averageRating: number }> = {};
  Object.keys(feedbackByDocumentType).forEach(type => {
    const current = feedbackByDocumentType[type];
    typedFeedbackByDocumentType[type] = {
      count: current.count,
      averageRating: current.totalRating / current.count
    };
  });
  
  // Get 10 most recent feedbacks
  const recentFeedbacks = [...documentFeedbacks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
    .map(feedback => ({
      documentId: feedback.documentId,
      analysisType: feedback.analysisType,
      rating: feedback.rating,
      feedbackText: feedback.feedbackText,
      createdAt: feedback.createdAt
    }));
  
  // Calculate monthly average ratings for the last 6 months
  const now = new Date();
  const monthlyData: Record<string, { sum: number; count: number }> = {};
  
  // Initialize last 6 months
  for (let i = 0; i < 6; i++) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[monthKey] = { sum: 0, count: 0 };
  }
  
  // Populate monthly data
  documentFeedbacks.forEach(feedback => {
    const date = new Date(feedback.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].sum += feedback.rating;
      monthlyData[monthKey].count += 1;
    }
  });
  
  // Calculate averages and format for chart
  const monthlyAverageRatings = Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      averageRating: data.count > 0 ? data.sum / data.count : 0
    }))
    .sort((a, b) => a.month.localeCompare(b.month)); // Sort chronologically
  
  return {
    averageRating,
    totalFeedbacks: documentFeedbacks.length,
    ratingDistribution,
    feedbackByDocumentType: typedFeedbackByDocumentType,
    recentFeedbacks,
    monthlyAverageRatings
  };
}

// Document analysis quality metrics types
export type AnalysisQualityMetrics = {
  overallAccuracy: number; // Based on user feedback and manual reviews
  typeSpecificAccuracy: {
    [documentType: string]: number;
  };
  averageAnalysisTime: number; // in seconds
  successRate: number; // Percentage of successful analyses
  errorRate: number; // Percentage of analyses with errors
  modelPerformance: {
    [modelName: string]: {
      accuracy: number;
      averageResponseTime: number;
      costPerAnalysis: number; // Approximated cost in cents
    }
  };
};

/**
 * Get document analysis quality metrics
 * This combines feedback data with processing metrics for a complete picture
 */
export function getAnalysisQualityMetrics(): AnalysisQualityMetrics {
  // Use feedback data to estimate accuracy
  const feedbackStats = calculateFeedbackStats();
  
  // Convert 5-star rating to percentage accuracy (simplistic approach)
  // 5 stars = 100%, 1 star = 20%
  const overallAccuracy = (feedbackStats.averageRating / 5) * 100;
  
  // Calculate type-specific accuracy from feedback
  const typeSpecificAccuracy: Record<string, number> = {};
  Object.entries(feedbackStats.feedbackByDocumentType).forEach(([type, data]) => {
    typeSpecificAccuracy[type] = (data.averageRating / 5) * 100;
  });
  
  // Get processing metrics for the last 30 days
  const metrics = calculateMetrics(30 * 24);
  
  // Model performance (simulated with fixed data for now)
  const modelPerformance = {
    'gpt-4o': {
      accuracy: 94.5,
      averageResponseTime: 4.2,
      costPerAnalysis: 6.3 // cents
    },
    'mistral-large': {
      accuracy: 91.2,
      averageResponseTime: 2.8,
      costPerAnalysis: 3.7
    },
    'claude-3-opus': {
      accuracy: 93.8,
      averageResponseTime: 3.5,
      costPerAnalysis: 5.9
    }
  };
  
  return {
    overallAccuracy,
    typeSpecificAccuracy,
    averageAnalysisTime: metrics.averageAnalysisTime,
    successRate: metrics.successRate * 100,
    errorRate: metrics.errorRate * 100,
    modelPerformance
  };
} 