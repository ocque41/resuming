// app/api/analyze-cv/route.ts
import { NextResponse } from 'next/server';
import { analyzeCV } from '@/lib/cvAnalyzer';
import { getCVByFileName, updateCVAnalysis } from '@/lib/db/queries.server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('fileName');
  const cvId = searchParams.get('cvId');
  
  if (!fileName) {
    return NextResponse.json({ error: 'Missing fileName parameter' }, { status: 400 });
  }
  
  if (!cvId) {
    return NextResponse.json({ error: 'Missing cvId parameter' }, { status: 400 });
  }

  try {
    // Log that we're starting analysis
    logger.info(`Starting analysis for CV ${fileName} (ID: ${cvId})`);
    
    // Get CV by filename
    const cvRecord = await getCVByFileName(fileName as string);
    if (!cvRecord) {
      logger.error(`CV not found: ${fileName}`);
      return NextResponse.json({ error: 'CV not found' }, { status: 404 });
    }

    if (!cvRecord.rawText) {
      logger.error(`CV text content not found: ${fileName}`);
      return NextResponse.json({ error: 'CV text content not found' }, { status: 400 });
    }

    // Use the rawText from the retrieved CV record for analysis
    const analysis = await analyzeCV(cvRecord.rawText);
    logger.info(`Analysis completed for CV ${fileName} (ID: ${cvId}), ATS Score: ${analysis.atsScore}`);

    // Merge new analysis data with any existing metadata
    const existingMetadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    const optimizedTimes = existingMetadata.optimizedTimes ? existingMetadata.optimizedTimes + 1 : 1;
    
    // Create comprehensive metadata that will be helpful for optimization
    const newMetadata = {
      ...existingMetadata,
      // Analysis core results
      atsScore: analysis.atsScore,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      industry: analysis.industry,
      
      // Detailed analysis data
      keywordAnalysis: analysis.keywordAnalysis || existingMetadata.keywordAnalysis,
      sectionBreakdown: analysis.sectionBreakdown || existingMetadata.sectionBreakdown,
      keywordMatches: analysis.keywordMatches || existingMetadata.keywordMatches,
      metrics: analysis.metrics || existingMetadata.metrics,
      
      // Formatting-specific analysis (used by enhanced UI)
      formattingStrengths: existingMetadata.formattingStrengths || [],
      formattingWeaknesses: existingMetadata.formattingWeaknesses || [],
      formattingRecommendations: existingMetadata.formattingRecommendations || [],
      
      // Status tracking
      analysisDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      optimized: existingMetadata.optimized || false,
      optimizedTimes,
      
      // Clear any processing flags to ensure optimization can start fresh
      processing: false,
      processingError: null,
      processingCompleted: false
    };

    // Update the CV record with the new analysis metadata
    await updateCVAnalysis(cvRecord.id, JSON.stringify(newMetadata));
    logger.info(`Metadata updated for CV ${fileName} (ID: ${cvId})`);
    
    return NextResponse.json(newMetadata);
  } catch (error: any) {
    logger.error('Error during analysis:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
