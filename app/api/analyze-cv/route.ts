// app/api/analyze-cv/route.ts
import { NextResponse } from 'next/server';
import { analyzeCV } from '@/lib/analyzeCV';
import { getCVByFileName, updateCVAnalysis } from '@/lib/db/queries.server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('fileName');
  if (!fileName) {
    return NextResponse.json({ error: 'Missing fileName parameter' }, { status: 400 });
  }

  // Use non-null assertion operator to ensure fileName is a string.
  if (!fileName) {
    return NextResponse.json({ error: 'Missing fileName parameter' }, { status: 400 });
  }
  const cvRecord = await getCVByFileName(fileName);
  if (!cvRecord) {
    return NextResponse.json({ error: 'CV not found' }, { status: 404 });
  }

  try {
    // Use the rawText from the retrieved CV record for analysis.
    const analysis = await analyzeCV(cvRecord.rawText);

    // Merge new analysis data with any existing metadata.
    const existingMetadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    const optimizedTimes = existingMetadata.optimizedTimes ? existingMetadata.optimizedTimes + 1 : 1;
    const newMetadata = {
      ...existingMetadata,
      atsScore: analysis.atsScore,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      optimized: true,
      optimizedTimes,
    };

    // Update the CV record with the new analysis metadata.
    await updateCVAnalysis(cvRecord.id, JSON.stringify(newMetadata));
    return NextResponse.json(newMetadata);
  } catch (error: any) {
    console.error('Error during analysis:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
