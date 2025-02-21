// app/api/optimize-cv/route.ts
import { NextResponse } from "next/server";
import { getCVByFileName, updateCVAnalysis } from "@/lib/db/queries.server";
import { optimizeCV } from "@/lib/optimizeCV";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  if (!fileName) {
    return NextResponse.json(
      { error: "Missing fileName parameter" },
      { status: 400 }
    );
  }

  // Use non-null assertion since we've checked fileName exists.
  const cvRecord = await getCVByFileName(fileName!);
  if (!cvRecord) {
    return NextResponse.json({ error: "CV not found" }, { status: 404 });
  }

  // Ensure the CV has been analyzed already (analysis stored in metadata).
  const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : null;
  if (!metadata || !metadata.atsScore) {
    return NextResponse.json(
      { error: "CV has not been analyzed yet." },
      { status: 400 }
    );
  }

  if (!cvRecord.rawText) {
    return NextResponse.json({ error: 'CV text content not found' }, { status: 400 });
  }

  try {
    // Generate optimized CV using rawText and existing analysis.
    const optimizationResult = await optimizeCV(cvRecord.rawText, metadata);

    // Merge new optimization data into metadata.
    const newMetadata = {
      ...metadata,
      optimizedCV: optimizationResult.optimizedText,
      optimizedPDFUrl: optimizationResult.optimizedPDFUrl,
      optimized: true,
      optimizedTimes: metadata.optimizedTimes ? metadata.optimizedTimes + 1 : 1,
    };

    // Update the CV record in the database.
    await updateCVAnalysis(cvRecord.id, JSON.stringify(newMetadata));
    return NextResponse.json(newMetadata);
  } catch (error: any) {
    console.error("Error during CV optimization:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
