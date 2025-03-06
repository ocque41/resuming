import { NextResponse } from "next/server";
import { getCVByFileName, updateCVAnalysis } from "@/lib/db/queries.server";
import { optimizeCVBackground } from "@/lib/optimizeCVBackground";
import { getServerSession } from "next-auth";

// Define a session type
interface UserSession {
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

export async function GET(request: Request) {
  // Authentication check
  const session = await getServerSession() as UserSession | null;
    
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  if (!fileName) {
    return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
  }

  const cvRecord = await getCVByFileName(fileName!);
  if (!cvRecord) {
    return NextResponse.json({ error: "CV not found" }, { status: 404 });
  }

  // Ensure the CV belongs to the authenticated user
  const userId = parseInt(session.user.id, 10);
  if (isNaN(userId)) {
    console.error(`Invalid user ID: ${session.user.id}`);
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // Verify ownership
  if (cvRecord.userId !== userId) {
    console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
    return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 401 });
  }

  const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
  if (!metadata || !metadata.atsScore) {
    return NextResponse.json({ error: "CV has not been analyzed yet." }, { status: 400 });
  }

  try {
    const updatedMetadata = { 
      ...metadata, 
      optimizing: true,
      startTime: new Date().toISOString(),
      progress: 10
    };
    await updateCVAnalysis(cvRecord.id, JSON.stringify(updatedMetadata));

    // Start the optimization process in the background
    // We don't await this because it's a long-running process
    // The client will poll for status updates
    Promise.resolve().then(async () => {
      try {
        await optimizeCVBackground(cvRecord);
      } catch (error) {
        console.error("Background optimization failed:", error);
      }
    });
    
    return NextResponse.json({ message: "Optimization started. Please check back later." });
  } catch (error: any) {
    console.error("Error initiating optimization:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Authentication check
    const session = await getServerSession() as UserSession | null;
      
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, templateId } = body;

    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }

    if (!templateId) {
      return NextResponse.json({ error: "Missing templateId parameter" }, { status: 400 });
    }

    const cvRecord = await getCVByFileName(fileName);
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Ensure the CV belongs to the authenticated user
    const userId = parseInt(session.user.id, 10);
    if (isNaN(userId)) {
      console.error(`Invalid user ID: ${session.user.id}`);
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Verify ownership
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 401 });
    }

    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
    if (!metadata || !metadata.atsScore) {
      return NextResponse.json({ error: "CV has not been analyzed yet." }, { status: 400 });
    }

    const updatedMetadata = { 
      ...metadata, 
      optimizing: true,
      selectedTemplate: templateId,
      startTime: new Date().toISOString(),
      progress: 10
    };
    await updateCVAnalysis(cvRecord.id, JSON.stringify(updatedMetadata));

    // Start the optimization process in the background
    // We don't await this because it's a long-running process
    // The client will poll for status updates
    Promise.resolve().then(async () => {
      try {
        await optimizeCVBackground(cvRecord, templateId);
      } catch (error) {
        console.error("Background optimization with template failed:", error);
      }
    });
    
    return NextResponse.json({ message: "Optimization with selected template started. Please check back later." });
  } catch (error: any) {
    console.error("Error initiating optimization with template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
