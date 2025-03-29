/**
 * Admin API Endpoint: Optimize CV
 * 
 * This endpoint provides administrative functions for optimizing CV PDFs.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { optimizeCV, batchOptimizeCVs } from "@/lib/utils/optimizeCVBackground";
import { logger } from "@/lib/logger";

// Require admin privileges to access this API
async function checkAdminAccess() {
  const session = await getSession();
  
  if (!session?.user?.id) {
    return { authorized: false, message: "Not authenticated" };
  }
  
  // Check if user has admin role
  const isAdmin = session.user.admin === true;
  
  if (!isAdmin) {
    return { authorized: false, message: "Admin access required" };
  }
  
  return { authorized: true, userId: session.user.id };
}

export async function GET(request: NextRequest) {
  const authCheck = await checkAdminAccess();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.message }, { status: 403 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const cvIdParam = searchParams.get('cvId');
    
    if (!cvIdParam) {
      return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
    }
    
    const cvId = parseInt(cvIdParam);
    if (isNaN(cvId)) {
      return NextResponse.json({ error: "Invalid cvId parameter" }, { status: 400 });
    }
    
    const result = await optimizeCV(cvId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error(`Error in optimize-cv API: ${error}`);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await checkAdminAccess();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.message }, { status: 403 });
  }
  
  try {
    const data = await request.json();
    const { action, cvId, limit } = data;
    
    switch (action) {
      case 'optimize-single':
        if (!cvId) {
          return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
        }
        
        const result = await optimizeCV(parseInt(cvId));
        return NextResponse.json(result);
        
      case 'optimize-batch':
        const batchLimit = limit ? parseInt(limit) : 10;
        const results = await batchOptimizeCVs(batchLimit);
        
        // Calculate success/failure counts
        const succeeded = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        return NextResponse.json({ 
          success: true, 
          stats: { total: results.length, succeeded, failed },
          results 
        });
        
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    logger.error(`Error in optimize-cv API: ${error}`);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
} 