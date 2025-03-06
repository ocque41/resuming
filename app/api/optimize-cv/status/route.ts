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
  optimizedPDFBase64?: string;
  lastProgressUpdate?: string; // Track the last progress update time
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
        // Log the entire metadata for debugging
        console.error(`Optimization marked as complete but no optimized text found for ${fileName}`);
        console.error(`Full metadata for debugging:`, JSON.stringify(metadata, null, 2));
        
        // Check if the optimization is still in progress despite being marked as complete
        if (metadata.optimizing) {
          console.log(`CV ${fileName} is marked as both optimized and optimizing. Treating as in-progress.`);
          return NextResponse.json({
            status: "processing",
            progress: metadata.progress || 50
          });
        }
        
        // If there's optimizedPDFBase64 but no optimizedText, try to extract it
        if (metadata.optimizedPDFBase64) {
          console.log(`Found optimizedPDFBase64 but no optimizedText for ${fileName}`);
          
          // Update the metadata to indicate we need to re-optimize
          metadata.optimizing = true;
          metadata.optimized = false;
          metadata.error = "Optimized text missing, needs re-optimization";
          
          try {
            await updateCVMetadata(String(cvRecord.id), metadata);
          } catch (updateError) {
            console.error(`Error updating metadata for ${fileName}:`, updateError);
          }
          
          return NextResponse.json({
            status: "error",
            error: "Optimization needs to be restarted. Please try again."
          }, { status: 500 });
        }
        
        // Reset the optimization state to allow for a retry
        metadata.optimized = false;
        metadata.optimizing = false;
        metadata.error = "Optimization completed but no optimized text was found";
        
        try {
          await updateCVMetadata(String(cvRecord.id), metadata);
          console.log(`Reset optimization state for ${fileName} to allow retry`);
        } catch (updateError) {
          console.error(`Error resetting optimization state for ${fileName}:`, updateError);
        }
        
        return NextResponse.json({
          status: "error",
          error: "Optimization completed but no optimized text was found. Please try again."
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
          console.log(`Optimization for ${fileName} has been running for ${timeDiffMinutes.toFixed(2)} minutes. Resetting.`);
          
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
            error: "Optimization timed out after 5 minutes. Please try again."
          }, { status: 500 });
        }
      }
      
      // Check if the progress has been stuck at the same value for too long
      if (metadata.lastProgressUpdate) {
        const lastUpdate = new Date(metadata.lastProgressUpdate);
        const currentTime = new Date();
        const timeDiffMinutes = (currentTime.getTime() - lastUpdate.getTime()) / (1000 * 60);
        
        // If progress has been stuck for more than 2 minutes, consider it stalled
        if (timeDiffMinutes > 2) {
          console.log(`Progress for ${fileName} has been stuck at ${progress}% for ${timeDiffMinutes.toFixed(2)} minutes. Resetting.`);
          
          // Reset the optimization state
          metadata.optimizing = false;
          metadata.error = `Optimization stalled at ${progress}% for over 2 minutes`;
          try {
            await updateCVMetadata(String(cvRecord.id), metadata);
          } catch (updateError) {
            console.error(`Error updating metadata for stalled progress on ${fileName}:`, updateError);
          }
          
          return NextResponse.json({
            status: "error",
            error: `Optimization stalled at ${progress}%. Please try again.`
          }, { status: 500 });
        }
      }
      
      // Update the last progress update time
      metadata.lastProgressUpdate = new Date().toISOString();
      try {
        await updateCVMetadata(String(cvRecord.id), metadata);
      } catch (updateError) {
        console.error(`Error updating lastProgressUpdate for ${fileName}:`, updateError);
        // Continue despite this error
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