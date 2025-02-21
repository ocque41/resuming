// app/api/optimize-cv/route.ts
import { NextResponse } from "next/server";
import { getCVByFileName, updateCVAnalysis } from "@/lib/db/queries.server";
import { optimizeCVBackground } from "@/lib/optimizeCVBackground";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  if (!fileName) {
    return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
  }

  // Ensure fileName is non-null.
  const cvRecord = await getCVByFileName(fileName!);
  if (!cvRecord) {
    return NextResponse.json({ error: "CV not found" }, { status: 404 });
  }

  // Ensure the CV has been analyzed (metadata should include analysis).
  const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
  if (!metadata || !metadata.atsScore) {
    return NextResponse.json({ error: "CV has not been analyzed yet." }, { status: 400 });
  }

  try {
    // Mark the CV record as "optimizing" so the frontend can show progress.
    const updatedMetadata = { ...metadata, optimizing: true };
    await updateCVAnalysis(cvRecord.id, JSON.stringify(updatedMetadata));

    // Fire-and-forget the background optimization process.
    optimizeCVBackground(cvRecord);

    // Return an immediate response indicating that optimization has started.
    return NextResponse.json({ message: "Optimization started. Please check back later." });
  } catch (error: any) {
    console.error("Error initiating optimization:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
