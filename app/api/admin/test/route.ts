import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { runSystemTest } from "@/lib/utils/testingUtility";

/**
 * Run comprehensive tests for the CV optimization system
 * This endpoint is admin-only and should be protected
 */
export async function GET(request: Request) {
  try {
    // Get user session and verify admin access
    const session = await getSession();
    if (!session?.user) {
      logger.warn("Unauthorized attempt to access testing endpoint");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // In a real app, you'd check if the user is an admin
    // For now, we'll assume all authenticated users can access this endpoint
    const isAdmin = true;
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to run tests." },
        { status: 403 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get("cvId");
    
    // Run the tests
    const testResults = await runSystemTest();
    
    // Return the test results
    return NextResponse.json({
      success: true,
      testResults
    });
    
  } catch (error) {
    logger.error("Error running tests:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: "Failed to run tests." },
      { status: 500 }
    );
  }
} 