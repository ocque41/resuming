import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { calculateFeedbackStats, getAnalysisQualityMetrics } from "@/lib/utils/analytics";
import { logger } from "@/lib/logger";

/**
 * Get document analysis analytics
 * Includes feedback statistics and quality metrics
 */
export async function GET(request: Request) {
  try {
    // Get user session and verify authentication
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "You must be logged in to access analytics." },
        { status: 401 }
      );
    }
    
    // In a real app, you might check if user has permission to view analytics
    // For now, we'll keep it simple
    
    // Get analytics data
    const feedbackStats = calculateFeedbackStats();
    const qualityMetrics = getAnalysisQualityMetrics();
    
    // Return the analytics data
    return NextResponse.json({
      success: true,
      data: {
        feedbackStats,
        qualityMetrics
      }
    });
    
  } catch (error) {
    logger.error("Error in document analysis analytics API:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: "Failed to retrieve document analysis analytics data." },
      { status: 500 }
    );
  }
} 