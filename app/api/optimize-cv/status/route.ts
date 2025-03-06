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
    if (metadata.optimized) {
      // Check for optimizedText in both locations (for backward compatibility)
      const optimizedText = metadata.optimizedText || metadata.optimizedCV;
      
      if (optimizedText) {
        return NextResponse.json({
          status: "completed",
          optimizedText: optimizedText,
          template: metadata.selectedTemplate || "professional"
        });
      } else {
        console.error("Optimization marked as complete but no optimized text found");
        return NextResponse.json({
          status: "error",
          error: "Optimization completed but no optimized text was found"
        }, { status: 500 });
      }
    }

    // If optimization is still in progress
    if (metadata.optimizing) {
      // Always use the progress value from the metadata
      const progress = metadata.progress || 10;
      
      // Check if optimization has been running for too long (more than 5 minutes)
      if (metadata.startTime) {
        const startTime = new Date(metadata.startTime);
        const currentTime = new Date();
        const timeDiffMinutes = (currentTime.getTime() - startTime.getTime()) / (1000 * 60);
        
        if (timeDiffMinutes > 5) {
          // Reset the optimization state
          metadata.optimizing = false;
          metadata.error = "Optimization timed out after 5 minutes";
          await updateCVMetadata(String(cvRecord.id), metadata);
          
          return NextResponse.json({
            status: "error",
            error: "Optimization timed out after 5 minutes"
          }, { status: 500 });
        }
      }
      
      // Log the progress for debugging
      console.log(`Optimization progress for ${fileName}: ${progress}%`);
      
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
  } catch (error: any) {
    console.error("Error checking optimization status:", error);
    return NextResponse.json({ 
      status: "error",
      error: `Failed to check optimization status: ${error.message}` 
    }, { status: 500 });
  }
}

// Helper function to update CV metadata
async function updateCVMetadata(cvId: string, metadata: CVMetadata) {
  try {
    // Import the database query function directly
    const { updateCVAnalysis } = await import("@/lib/db/queries.server");
    
    // Update the CV metadata using the server function
    // Convert the cvId string back to a number since updateCVAnalysis expects a number
    await updateCVAnalysis(Number(cvId), JSON.stringify(metadata));
    
    return true;
  } catch (error: any) {
    console.error("Error updating CV metadata:", error);
    return false;
  }
} 