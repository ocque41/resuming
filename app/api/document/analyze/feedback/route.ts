import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/db/queries.server";
import { 
  submitAnalysisFeedback, 
  getFeedbackStats, 
  AnalysisFeedback 
} from "@/lib/ai/enhanced-document-analysis";

// Force dynamic to prevent caching
export const dynamic = "force-dynamic";

/**
 * POST handler to submit feedback on document analysis 
 */
export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const feedback: AnalysisFeedback = await req.json();
    
    // Add user ID to feedback
    feedback.userId = String(user.id);
    
    // Validate required fields
    if (!feedback.documentId || !feedback.analysisType || feedback.rating < 1 || feedback.rating > 5) {
      return NextResponse.json({ 
        error: "Invalid feedback data. Required fields: documentId, analysisType, rating (1-5)" 
      }, { status: 400 });
    }
    
    // Submit feedback
    const success = await submitAnalysisFeedback(feedback);
    
    if (success) {
      return NextResponse.json({ 
        message: "Feedback submitted successfully",
        status: "success"
      });
    } else {
      return NextResponse.json({ 
        error: "Failed to submit feedback" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json({ 
      error: "An error occurred while submitting feedback" 
    }, { status: 500 });
  }
}

/**
 * GET handler to retrieve feedback statistics
 */
export async function GET(req: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get feedback stats
    const stats = getFeedbackStats();
    
    return NextResponse.json({
      stats,
      documentTypes: Object.keys(stats),
      totalFeedbackCount: Object.values(stats).reduce((sum, stat) => sum + stat.count, 0)
    });
  } catch (error) {
    console.error("Error retrieving feedback stats:", error);
    return NextResponse.json({ 
      error: "An error occurred while retrieving feedback statistics" 
    }, { status: 500 });
  }
} 