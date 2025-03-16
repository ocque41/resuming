import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/auth";
import { logger } from "@/lib/logger";
import { getQueueStatus } from "@/lib/utils/taskQueue";
import { getCircuitStatus } from "@/lib/utils/apiRateLimiter";
import { getCacheStats } from '@/lib/services/cache.service';

/**
 * API endpoint to get system status
 * This includes queue status, circuit breaker status, and cache stats
 */
export async function GET() {
  try {
    // Get user session and verify access
    const user = await getUser();
    if (!user) {
      logger.warn("Unauthorized attempt to access status endpoint");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Get queue status
    const queueStatus = getQueueStatus();
    
    // Get circuit breaker status
    const circuitStatus = getCircuitStatus('openai');
    
    // Get cache stats
    const cacheStats = getCacheStats();
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    // Calculate uptime
    const uptime = process.uptime();
    
    // Return system status
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      queues: queueStatus,
      circuitBreaker: circuitStatus,
      cache: cacheStats,
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      },
      uptime: {
        seconds: Math.round(uptime),
        minutes: Math.round(uptime / 60),
        hours: Math.round(uptime / 60 / 60),
      }
    });
  } catch (error) {
    logger.error("Error getting system status:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: "Failed to get system status" },
      { status: 500 }
    );
  }
} 