import { NextRequest, NextResponse } from "next/server";
import { getCVByFileName } from "@/lib/db/queries.server";

// Define the metadata interface
interface CVMetadata {
  optimizing?: boolean;
  optimized?: boolean;
  optimizedText?: string;
  selectedTemplate?: string;
  progress?: number;
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
      // Calculate an estimated progress (this could be more sophisticated in production)
      const progress = metadata.progress || Math.floor(Math.random() * 30) + 60; // Simulate progress between 60-90%
      
      return NextResponse.json({
        status: "processing",
        progress: progress
      });
    }

    // Default fallback
    return NextResponse.json({
      status: "processing",
      progress: 50
    });
  } catch (error) {
    console.error("Error checking optimization status:", error);
    return NextResponse.json({ 
      status: "error",
      error: "Failed to check optimization status" 
    }, { status: 500 });
  }
} 