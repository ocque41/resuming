// app/api/analyze-cv/route.ts
import { NextResponse } from 'next/server';
import { analyzeCV } from '@/lib/analyzeCV';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('fileName');
  if (!fileName) {
    return NextResponse.json({ error: 'Missing fileName parameter' }, { status: 400 });
  }

  // In production, retrieve the actual CV text based on the fileName.
  // For testing, we simulate extracted CV text.
  const simulatedCVText = `John Doe
  Experienced software engineer with expertise in JavaScript, TypeScript, and cloud services.
  Education: B.Sc. in Computer Science.
  Professional experience includes roles at innovative tech companies.
  Skills: React, Node.js, Express, and AWS.`;

  try {
    const analysis = await analyzeCV(simulatedCVText);
    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('Error during analysis:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
