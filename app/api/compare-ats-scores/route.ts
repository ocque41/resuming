import { NextRequest, NextResponse } from "next/server";
import { analyzeCV } from "@/lib/analyzeCV";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { getCVByFileName } from "@/lib/db/queries.server";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Parse request body
    const body = await request.json();
    const { fileName } = body;
    
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }
    
    // Get the CV record
    const cvRecord = await getCVByFileName(fileName);
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }
    
    // Verify ownership
    if (cvRecord.userId !== userId) {
      console.error(`User ${userId} attempted to access CV ${cvRecord.id} belonging to user ${cvRecord.userId}`);
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 401 });
    }
    
    // Parse metadata
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    
    // Check if CV has been optimized
    if (!metadata.optimizedText) {
      return NextResponse.json({ 
        error: "CV has not been optimized yet",
        originalAtsScore: metadata.atsScore || null,
        optimizedAtsScore: null,
        difference: null,
        comparison: null
      }, { status: 400 });
    }
    
    // Check if we already have ATS scores for both
    const originalAtsScore = metadata.atsScore || null;
    const optimizedAtsScore = metadata.optimizedAtsScore || null;
    
    // If we don't have the optimized score yet, analyze it
    if (optimizedAtsScore === null && metadata.optimizedText) {
      console.log("Analyzing optimized CV to get ATS score");
      try {
        const optimizedAnalysis = await analyzeCV(metadata.optimizedText);
        
        if (optimizedAnalysis && typeof optimizedAnalysis.atsScore === 'number') {
          // Save the optimized ATS score to metadata
          const updatedMetadata = {
            ...metadata,
            optimizedAtsScore: optimizedAnalysis.atsScore,
            optimizedIndustry: optimizedAnalysis.industry || null,
            optimizedKeywords: optimizedAnalysis.missingKeywords || [],
            lastAnalyzed: new Date().toISOString()
          };
          
          // Update DB with the new metadata
          await db.update(cvs)
            .set({ 
              metadata: JSON.stringify(updatedMetadata)
            })
            .where(eq(cvs.id, cvRecord.id));
          
          // Use the new score for response
          metadata.optimizedAtsScore = optimizedAnalysis.atsScore;
        }
      } catch (analysisError) {
        console.error("Error analyzing optimized CV:", analysisError);
        // Continue with what we have
      }
    }
    
    // Calculate score difference and comparison
    const difference = metadata.optimizedAtsScore !== null && originalAtsScore !== null 
      ? metadata.optimizedAtsScore - originalAtsScore 
      : null;
    
    // Generate a human-readable comparison
    let comparison = null;
    if (difference !== null) {
      if (difference > 5) {
        comparison = "Significant improvement in ATS score";
      } else if (difference > 0) {
        comparison = "Slight improvement in ATS score";
      } else if (difference === 0) {
        comparison = "No change in ATS score";
      } else if (difference > -5) {
        comparison = "Slight decrease in ATS score";
      } else {
        comparison = "Significant decrease in ATS score";
      }
    }
    
    // Return the scores and comparison
    return NextResponse.json({
      originalAtsScore,
      optimizedAtsScore: metadata.optimizedAtsScore,
      difference,
      comparison,
      recommendedActions: generateRecommendedActions(originalAtsScore, metadata.optimizedAtsScore, metadata)
    });
    
  } catch (error) {
    console.error("Error in compare-ats-scores API:", error);
    return NextResponse.json(
      { error: `Failed to compare ATS scores: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// Helper function to generate recommended actions based on score comparison
function generateRecommendedActions(originalScore: number | null, optimizedScore: number | null, metadata: any): string[] {
  const actions: string[] = [];
  
  if (originalScore === null || optimizedScore === null) {
    return ["Complete both CV analysis and optimization to compare ATS scores"];
  }
  
  if (optimizedScore < originalScore) {
    actions.push("The optimization has reduced your ATS score. Consider the following actions:");
    
    // Check for missing keywords
    if (metadata.missingKeywords && metadata.missingKeywords.length > 0) {
      actions.push(`Add these industry-specific keywords that may be missing: ${metadata.missingKeywords.join(', ')}`);
    }
    
    // Check optimization template
    if (metadata.selectedTemplate) {
      actions.push(`Try a different template - the current template (${metadata.selectedTemplate}) may not be optimal for your industry`);
    }
    
    // Suggest manual review
    actions.push("Manually review your original CV and ensure all important keywords are preserved in the optimized version");
    
    // Suggest full reoptimization
    actions.push("Consider reoptimizing your CV with a focus on ATS score improvement");
  } else if (optimizedScore > originalScore) {
    if (optimizedScore - originalScore > 10) {
      actions.push("Great improvement! Your optimized CV is significantly more ATS-friendly");
    } else {
      actions.push("Your optimized CV has a better ATS score, but there's still room for improvement");
      
      if (optimizedScore < 80) {
        actions.push("Consider adding more industry-specific keywords and achievements to boost your score further");
      }
    }
  } else {
    // Scores are equal
    actions.push("Your ATS score hasn't changed. Consider these improvements:");
    actions.push("Add more relevant industry keywords and specific achievements with metrics");
    actions.push("Use more precise technical terminology related to your field");
  }
  
  return actions;
} 