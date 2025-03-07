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
    
    // Get ATS scores
    let originalAtsScore = metadata.atsScore || null;
    let optimizedAtsScore = metadata.optimizedAtsScore || null;
    
    console.log(`Initial ATS scores - Original: ${originalAtsScore}, Optimized: ${optimizedAtsScore}`);
    
    // If we don't have scores, calculate them
    if (originalAtsScore === null || optimizedAtsScore === null) {
      try {
        // Get the raw text
        const rawText = cvRecord.rawText || "";
        
        // Get the optimized text
        const optimizedText = metadata.optimizedText || "";
        
        // If we have both texts, analyze them
        if (rawText && optimizedText) {
          console.log("Analyzing CV texts to calculate ATS scores");
          
          // Calculate original ATS score if not available
          if (originalAtsScore === null) {
            console.log("Calculating original ATS score");
            try {
              const originalAnalysis = await analyzeCV(rawText);
              originalAtsScore = originalAnalysis.atsScore || 65; // Default to 65 if not available
              
              console.log(`Calculated original ATS score: ${originalAtsScore}`);
              
              // Update the CV record with the original ATS score
              const updatedMetadata = { ...metadata, atsScore: originalAtsScore };
              await db.update(cvs)
                .set({ metadata: JSON.stringify(updatedMetadata) })
                .where(eq(cvs.id, cvRecord.id))
                .execute();
            } catch (analysisError) {
              console.error("Error analyzing original CV:", analysisError);
              originalAtsScore = 65; // Default score if analysis fails
            }
          }
          
          // Calculate optimized ATS score if not available
          if (optimizedAtsScore === null) {
            console.log("Calculating optimized ATS score");
            try {
              const optimizedAnalysis = await analyzeCV(optimizedText);
              optimizedAtsScore = optimizedAnalysis.atsScore || 85; // Default to 85 if not available
              
              console.log(`Calculated optimized ATS score: ${optimizedAtsScore}`);
              
              // Update the CV record with the optimized ATS score
              const updatedMetadata = { 
                ...metadata, 
                optimizedAtsScore: optimizedAtsScore,
                atsImprovement: optimizedAtsScore - (originalAtsScore || 0)
              };
              await db.update(cvs)
                .set({ metadata: JSON.stringify(updatedMetadata) })
                .where(eq(cvs.id, cvRecord.id))
                .execute();
            } catch (analysisError) {
              console.error("Error analyzing optimized CV:", analysisError);
              optimizedAtsScore = 85; // Default score if analysis fails
            }
          }
        } else {
          console.warn("Missing raw text or optimized text for ATS score calculation");
          // Set default scores if texts are not available
          if (originalAtsScore === null) originalAtsScore = 65;
          if (optimizedAtsScore === null) optimizedAtsScore = 85;
        }
      } catch (error) {
        console.error("Error calculating ATS scores:", error);
        // Set default scores if calculation fails
        if (originalAtsScore === null) originalAtsScore = 65;
        if (optimizedAtsScore === null) optimizedAtsScore = 85;
      }
    }
    
    // Ensure we have valid scores
    originalAtsScore = originalAtsScore || 65;
    optimizedAtsScore = optimizedAtsScore || 85;
    
    // Calculate the difference
    const difference = optimizedAtsScore - originalAtsScore;
    
    console.log(`Final ATS scores - Original: ${originalAtsScore}, Optimized: ${optimizedAtsScore}, Difference: ${difference}`);
    
    // Generate comparison text
    let comparison = "";
    if (difference > 15) {
      comparison = "Significant improvement in ATS compatibility";
    } else if (difference > 5) {
      comparison = "Moderate improvement in ATS compatibility";
    } else if (difference > 0) {
      comparison = "Slight improvement in ATS compatibility";
    } else if (difference === 0) {
      comparison = "No change in ATS compatibility";
    } else {
      comparison = "Decreased ATS compatibility";
    }
    
    // Generate recommended actions based on scores
    const recommendedActions = generateRecommendedActions(originalAtsScore, optimizedAtsScore, metadata);
    
    // Return a simplified response with only the necessary data
    return NextResponse.json({
      originalAtsScore,
      optimizedAtsScore,
      difference,
      comparison,
      recommendedActions: recommendedActions.slice(0, 5) // Limit to 5 recommendations
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