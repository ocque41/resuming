import { NextRequest, NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";

// Define the metadata interface
interface CVMetadata {
  optimizing?: boolean;
  optimized?: boolean;
  optimizedText?: string;
  selectedTemplate?: string;
  progress?: number;
  startTime?: string; // Track when optimization started
  [key: string]: any; // Allow for additional properties
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  
  if (!fileName) {
    return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
  }

  try {
    const cvRecord = await getCVByFileName(fileName);
    
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    let metadata: CVMetadata = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (error) {
      console.error("Error parsing metadata:", error);
      return NextResponse.json({ error: "Invalid metadata format" }, { status: 500 });
    }

    // Check if optimization was initiated
    if (!metadata.optimizing && !metadata.optimized) {
      return NextResponse.json({ 
        status: "error",
        error: "CV optimization has not been initiated"
      }, { status: 400 });
    }

    // If optimization is complete
    if (metadata.optimized && metadata.optimizedText) {
      return NextResponse.json({
        status: "completed",
        optimizedText: metadata.optimizedText,
        template: metadata.selectedTemplate || "professional"
      });
    }

    // If optimization is still in progress
    if (metadata.optimizing) {
      // Calculate progress based on time elapsed since optimization started
      // This ensures progress always moves forward and never fluctuates
      let progress = metadata.progress || 0;
      
      if (metadata.startTime) {
        const startTime = new Date(metadata.startTime).getTime();
        const currentTime = new Date().getTime();
        const elapsedSeconds = (currentTime - startTime) / 1000;
        
        // Cap at 95% to avoid reaching 100% before completion
        // Estimate that optimization takes about 2 minutes max
        // Reach 50% in 30 seconds, 75% in 60 seconds, 95% in 120 seconds
        if (elapsedSeconds <= 30) {
          // First 30 seconds: 0 to 50%
          progress = Math.min(50, Math.floor((elapsedSeconds / 30) * 50));
        } else if (elapsedSeconds <= 60) {
          // 30-60 seconds: 50 to 75%
          progress = Math.min(75, 50 + Math.floor(((elapsedSeconds - 30) / 30) * 25));
        } else if (elapsedSeconds <= 120) {
          // 60-120 seconds: 75 to 95%
          progress = Math.min(95, 75 + Math.floor(((elapsedSeconds - 60) / 60) * 20));
        } else {
          // After 2 minutes, stay at 95%
          progress = 95;
        }
      } else {
        // If no start time available, use fixed progress increments
        // Start at 10% and cap at 95%
        progress = Math.min(95, Math.max(10, progress + 5));
      }
      
      return NextResponse.json({
        status: "processing",
        progress: progress
      });
    }

    // Default fallback
    return NextResponse.json({
      status: "processing",
      progress: 10
    });
  } catch (error) {
    console.error("Error checking optimization status:", error);
    return NextResponse.json({ 
      status: "error",
      error: "Failed to check optimization status" 
    }, { status: 500 });
  }
} 