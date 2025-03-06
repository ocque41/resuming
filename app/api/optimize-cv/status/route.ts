import { NextRequest, NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";

// Define the metadata interface
interface CVMetadata {
  optimizing?: boolean;
  optimized?: boolean;
  optimizedText?: string;
  optimizedCV?: string;
  selectedTemplate?: string;
  progress?: number;
  startTime?: string; // Track when optimization started
  error?: string; // Store any error messages
  [key: string]: any; // Allow for additional properties
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  
  if (!fileName) {
    return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
  }

  try {
    console.log(`Checking optimization status for: ${fileName}`);
    const cvRecord = await getCVByFileName(fileName);
    
    if (!cvRecord) {
      console.error(`CV not found: ${fileName}`);
      return NextResponse.json({ 
        status: "error",
        error: `CV not found: ${fileName}` 
      }, { status: 404 });
    }

    let metadata: CVMetadata = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
      console.log(`Parsed metadata for ${fileName}:`, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error(`Error parsing metadata for ${fileName}:`, error);
      return NextResponse.json({ 
        status: "error",
        error: "Invalid metadata format" 
      }, { status: 500 });
    }

    // Check if there's an error stored in the metadata
    if (metadata.error) {
      console.error(`Error found in metadata for ${fileName}:`, metadata.error);
      return NextResponse.json({ 
        status: "error",
        error: metadata.error 
      }, { status: 500 });
    }

    // Check if optimization was initiated
    if (!metadata.optimizing && !metadata.optimized) {
      console.log(`Optimization not initiated for ${fileName}`);
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
        console.log(`Optimization completed for ${fileName}`);
        return NextResponse.json({
          status: "completed",
          optimizedText: optimizedText,
          template: metadata.selectedTemplate || "professional"
        });
      } else {
        console.error(`Optimization marked as complete but no optimized text found for ${fileName}`);
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
          try {
            await updateCVMetadata(String(cvRecord.id), metadata);
          } catch (updateError) {
            console.error(`Error updating metadata for timeout on ${fileName}:`, updateError);
          }
          
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
    console.log(`Using default fallback for ${fileName}`);
    return NextResponse.json({
      status: "processing",
      progress: 10
    });
  } catch (error: any) {
    console.error(`Error checking optimization status for ${fileName}:`, error);
    return NextResponse.json({ 
      status: "error",
      error: `Failed to check optimization status: ${error.message}` 
    }, { status: 500 });
  }
}

// Helper function to update CV metadata
async function updateCVMetadata(cvId: string, metadata: CVMetadata) {
  try {
    console.log(`Updating metadata for CV ID: ${cvId}`);
    // Import the database query function directly
    const { updateCVAnalysis } = await import("@/lib/db/queries.server");
    
    // Update the CV metadata using the server function
    // Convert the cvId string back to a number since updateCVAnalysis expects a number
    await updateCVAnalysis(Number(cvId), JSON.stringify(metadata));
    
    return true;
  } catch (error: any) {
    console.error(`Error updating CV metadata for ID ${cvId}:`, error);
    return false;
  }
} 