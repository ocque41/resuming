import { NextRequest, NextResponse } from 'next/server';

// Generate sample analysis result for debugging purposes
export async function POST(req: NextRequest) {
  // Generate a random delay to simulate processing time
  const delay = Math.floor(Math.random() * 1000) + 500;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  let documentId = 'sample';
  let fileName = 'debug-sample.pdf';
  let type = 'general';
  
  try {
    // Try to parse the request body to get documentId and fileName
    const body = await req.json();
    if (body.documentId) documentId = body.documentId;
    if (body.fileName) fileName = body.fileName;
    if (body.type) type = body.type;
    
    console.log(`[DEBUG API] Generating sample analysis for document ID: ${documentId}, fileName: ${fileName}, type: ${type}`);
  } catch (error) {
    console.error('[DEBUG API] Failed to parse request body', error);
  }
  
  // Generate a consistent but slightly randomized analysis
  const analysis = generateSampleAnalysis(documentId, fileName, type);
  
  console.log(`[DEBUG API] Returning sample analysis with ${Object.keys(analysis).length} fields`);
  
  return NextResponse.json(analysis);
}

function generateSampleAnalysis(documentId: string, fileName: string, type: string) {
  const currentTime = new Date().toISOString();
  const fileType = fileName.split('.').pop()?.toLowerCase() || 'pdf';
  
  // Generate a deterministic but random-looking score
  const getScore = (seed: number) => {
    return Math.floor(50 + (seed * 40 % 50));
  };
  
  // Use document ID as a seed for consistent but varying scores
  const seedValue = documentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  
  const baseInsights = {
    clarity: getScore(seedValue),
    relevance: getScore(seedValue + 1),
    completeness: getScore(seedValue + 2),
    conciseness: getScore(seedValue + 3),
    overallScore: getScore(seedValue + 4),
    structure: getScore(seedValue + 5),
    engagement: getScore(seedValue + 6),
    contentquality: getScore(seedValue + 7)
  };
  
  // Create different analysis types based on the requested analysis type
  let analysisResult: any = {
    documentId,
    fileName,
    type,
    summary: `This is a sample analysis for debugging purposes. The document appears to be a ${fileType.toUpperCase()} file analyzed as a ${type} document.`,
    keyPoints: [
      "This is an automatically generated debug sample",
      "Use this to test UI components without making real API calls",
      "The content varies slightly based on document ID and type",
      "All metrics are generated from a deterministic algorithm"
    ],
    recommendations: [
      "Make sure the document content is clear and well-structured",
      "Consider adding more specific details to enhance clarity",
      "Review the document for any grammatical or spelling errors",
      "Ensure the document follows industry best practices"
    ],
    insights: baseInsights,
    topics: [
      { name: "Document Analysis", relevance: 0.95 },
      { name: "Testing", relevance: 0.85 },
      { name: "Debugging", relevance: 0.75 },
      { name: type.charAt(0).toUpperCase() + type.slice(1), relevance: 0.65 }
    ],
    entities: [
      { name: fileName, type: "Document", count: 1 },
      { name: "Analysis", type: "Concept", count: 3 },
      { name: "Debug", type: "Concept", count: 2 }
    ],
    sentiment: {
      overall: "neutral",
      score: 0.5
    },
    languageQuality: {
      grammar: getScore(seedValue + 8),
      spelling: getScore(seedValue + 9),
      readability: getScore(seedValue + 10),
      overall: getScore(seedValue + 11)
    },
    createdAt: currentTime
  };
  
  // Customize based on type
  if (type === 'resume' || type === 'cv') {
    analysisResult.summary = `This appears to be a résumé or CV document in ${fileType.toUpperCase()} format. The sample analysis provides insights specifically for job application documents.`;
    analysisResult.keyPoints.push("Includes skills and qualifications assessment");
    analysisResult.keyPoints.push("Experience section clarity evaluation");
    analysisResult.recommendations.push("Highlight achievements with quantifiable results");
    analysisResult.recommendations.push("Tailor your résumé to the specific job description");
    analysisResult.topics.push({ name: "Employment", relevance: 0.9 });
    analysisResult.topics.push({ name: "Skills", relevance: 0.88 });
    analysisResult.insights.ats_compatibility = getScore(seedValue + 12);
    analysisResult.insights.skills_relevance = getScore(seedValue + 13);
  }
  
  if (type === 'cover-letter') {
    analysisResult.summary = `This appears to be a cover letter document in ${fileType.toUpperCase()} format. The sample analysis evaluates the effectiveness and personalization of your letter.`;
    analysisResult.keyPoints.push("Evaluated personalization and targeting");
    analysisResult.keyPoints.push("Assessed overall persuasiveness");
    analysisResult.recommendations.push("Personalize the letter more specifically to the company");
    analysisResult.recommendations.push("Connect your experiences directly to the job requirements");
    analysisResult.topics.push({ name: "Application", relevance: 0.92 });
    analysisResult.topics.push({ name: "Qualifications", relevance: 0.87 });
    analysisResult.insights.personalization = getScore(seedValue + 14);
    analysisResult.insights.persuasiveness = getScore(seedValue + 15);
  }
  
  if (type === 'professional') {
    analysisResult.summary = `This appears to be a professional document in ${fileType.toUpperCase()} format. The sample analysis evaluates professionalism, formatting, and overall quality.`;
    analysisResult.keyPoints.push("Evaluated professional tone and formatting");
    analysisResult.keyPoints.push("Assessed overall document organization");
    analysisResult.recommendations.push("Maintain consistent formatting throughout");
    analysisResult.recommendations.push("Use professional terminology appropriate to your field");
    analysisResult.topics.push({ name: "Business", relevance: 0.91 });
    analysisResult.topics.push({ name: "Professional", relevance: 0.89 });
    analysisResult.insights.professionalism = getScore(seedValue + 16);
    analysisResult.insights.formatting = getScore(seedValue + 17);
  }
  
  return analysisResult;
} 