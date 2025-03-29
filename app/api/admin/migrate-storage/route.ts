/**
 * Admin API Endpoint: Migrate Storage
 * 
 * This endpoint provides administrative functions for migrating files 
 * from Dropbox to S3 storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { 
  migrateFileToS3, 
  migrateAllFilesToS3, 
  isFileInDropbox, 
  getStorageStats 
} from "@/lib/migrate/dropboxToS3";
import { logger } from "@/lib/logger";

// Require admin privileges to access this API
async function checkAdminAccess() {
  const session = await getSession();
  
  if (!session?.user?.id) {
    return { authorized: false, message: "Not authenticated" };
  }
  
  // Check if user has admin role
  // You should adjust this to match your actual authorization logic
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
  
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'stats';
  
  try {
    switch (action) {
      case 'stats':
        // Get storage statistics
        const stats = await getStorageStats();
        return NextResponse.json({ success: true, stats });
        
      case 'check':
        // Check if a specific file is in Dropbox
        const cvId = searchParams.get('cvId');
        if (!cvId) {
          return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
        }
        
        const isInDropbox = await isFileInDropbox(parseInt(cvId));
        return NextResponse.json({ success: true, isInDropbox });
        
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    logger.error(`Error in migrate-storage API: ${error}`);
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
      case 'migrate-file':
        // Migrate a single file
        if (!cvId) {
          return NextResponse.json({ error: "Missing cvId parameter" }, { status: 400 });
        }
        
        const result = await migrateFileToS3(parseInt(cvId));
        return NextResponse.json({ success: result.success, result });
        
      case 'migrate-all':
        // Migrate all files, with optional limit
        const results = await migrateAllFilesToS3(limit ? parseInt(limit) : undefined);
        
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
    logger.error(`Error in migrate-storage API: ${error}`);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
} 