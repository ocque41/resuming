import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPerformanceDashboard } from "@/lib/utils/analytics";
import { logger } from "@/lib/logger";

/**
 * Get CV processing analytics dashboard
 */
export async function GET(request: Request) {
  try {
    // Get user session and verify admin access
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "You must be logged in to access analytics." },
        { status: 401 }
      );
    }

    // In a real app, you'd check if the user is an admin
    // For now, we'll assume all authenticated users can access analytics
    const isAdmin = true;
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to access analytics." },
        { status: 403 }
      );
    }
    
    // Get analytics data
    const dashboard = getPerformanceDashboard();
    
    // Return the analytics data
    return NextResponse.json({
      success: true,
      data: dashboard
    });
    
  } catch (error) {
    logger.error("Error in analytics API:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: "Failed to retrieve analytics data." },
      { status: 500 }
    );
  }
} 