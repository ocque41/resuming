import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { 
  getWarmupStatus, 
  forceWarmupModel, 
  warmupAllModels 
} from "@/lib/utils/warmupCache";

/**
 * Get the status of the warm-up cache
 */
export async function GET(request: Request) {
  try {
    // Get user session and verify admin access
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "You must be logged in to access the warm-up status." },
        { status: 401 }
      );
    }

    // In a real app, you'd check if the user is an admin
    // For now, we'll assume all authenticated users can access this
    const isAdmin = true;
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to access the warm-up status." },
        { status: 403 }
      );
    }
    
    // Get warm-up status
    const status = getWarmupStatus();
    
    // Return the status
    return NextResponse.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    logger.error("Error getting warm-up status:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: "Failed to get warm-up status." },
      { status: 500 }
    );
  }
}

/**
 * Trigger a warm-up for one or all models
 */
export async function POST(request: Request) {
  try {
    // Get user session and verify admin access
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { success: false, error: "You must be logged in to trigger a warm-up." },
        { status: 401 }
      );
    }

    // In a real app, you'd check if the user is an admin
    // For now, we'll assume all authenticated users can trigger warm-ups
    const isAdmin = true;
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "You don't have permission to trigger warm-ups." },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { model } = body;
    
    let result;
    
    if (model) {
      // Warm up a specific model
      logger.info(`Admin user ${session.user.id} triggered warm-up for model: ${model}`);
      result = await forceWarmupModel(model);
      
      return NextResponse.json({
        success: true,
        message: result ? `Successfully warmed up model: ${model}` : `Failed to warm up model: ${model}`,
        model,
        status: result ? 'success' : 'error'
      });
    } else {
      // Warm up all models
      logger.info(`Admin user ${session.user.id} triggered warm-up for all models`);
      await warmupAllModels();
      
      // Get updated status
      const status = getWarmupStatus();
      
      return NextResponse.json({
        success: true,
        message: 'Warm-up triggered for all models',
        data: status
      });
    }
  } catch (error) {
    logger.error("Error triggering warm-up:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: "Failed to trigger warm-up." },
      { status: 500 }
    );
  }
} 