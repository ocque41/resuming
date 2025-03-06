import { NextResponse } from "next/server";
import { getCVByFileName, updateCVAnalysis } from "@/lib/db/queries.server";
import { optimizeCVBackground } from "@/lib/optimizeCVBackground";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  if (!fileName) {
    return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
  }

  const cvRecord = await getCVByFileName(fileName!);
  if (!cvRecord) {
    return NextResponse.json({ error: "CV not found" }, { status: 404 });
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

    optimizeCVBackground(cvRecord).catch(error => {
      console.error("Background optimization failed:", error);
    });
    
    return NextResponse.json({ message: "Optimization started. Please check back later." });
  } catch (error: any) {
    console.error("Error initiating optimization:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    optimizeCVBackground(cvRecord, templateId).catch(error => {
      console.error("Background optimization with template failed:", error);
    });
    
    return NextResponse.json({ message: "Optimization with selected template started. Please check back later." });
  } catch (error: any) {
    console.error("Error initiating optimization with template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
