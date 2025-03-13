import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractKeywords } from "@/lib/keywords";
import { structureCV } from "@/lib/cv/structureCV";
import { formatStructuredCV } from "@/lib/cv/formatCV";
import { cacheDocument, getCachedDocument } from "@/lib/cache/documentCache";
import { generateQuantifiedAchievements, generateQuantifiedGoals } from "@/lib/cv/generate";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { cvId, jobDescription } = body;

    if (!cvId) {
      return NextResponse.json({ error: "CV ID is required" }, { status: 400 });
    }

    if (!jobDescription) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }

    // Get CV from database
    const cv = await prisma.cV.findUnique({
      where: {
        id: cvId,
        userId: session.user.id,
      },
    });

    if (!cv) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }

    // Get cached document if available
    const cachedDoc = await getCachedDocument(cvId);
    if (!cachedDoc) {
      return NextResponse.json({ error: "CV content not found in cache" }, { status: 404 });
    }

    // Extract keywords from job description
    const jobKeywords = extractKeywords(jobDescription);

    // Structure the CV
    const structuredCV = await structureCV(cachedDoc.content);

    // Extract keywords from CV
    const cvKeywords = extractKeywords(cachedDoc.content);

    // Calculate keyword matches and missing keywords
    const keywordMatches = jobKeywords
      .filter(keyword => cvKeywords.includes(keyword))
      .map(keyword => ({
        keyword,
        count: cachedDoc.content.toLowerCase().split(keyword.toLowerCase()).length - 1
      }));

    const missingKeywords = jobKeywords.filter(keyword => !cvKeywords.includes(keyword));

    // Calculate match score
    const matchScore = Math.round((keywordMatches.length / jobKeywords.length) * 100);

    // Generate job-specific achievements and goals
    const jobSpecificAchievements = generateQuantifiedAchievements(jobKeywords);
    const jobSpecificGoals = generateQuantifiedGoals(jobKeywords);

    // Update structured CV with job-specific content
    const optimizedStructuredCV = {
      ...structuredCV,
      achievements: [
        ...structuredCV.achievements,
        ...jobSpecificAchievements.filter(achievement => 
          !structuredCV.achievements.some(existing => 
            existing.toLowerCase().includes(achievement.toLowerCase())
          )
        )
      ],
      goals: [
        ...structuredCV.goals,
        ...jobSpecificGoals.filter(goal => 
          !structuredCV.goals.some(existing => 
            existing.toLowerCase().includes(goal.toLowerCase())
          )
        )
      ]
    };

    // Format the optimized CV
    const optimizedText = formatStructuredCV(optimizedStructuredCV);

    // Cache the optimized document
    await cacheDocument(cvId, optimizedText, "specific");

    // Return the results
    return NextResponse.json({
      success: true,
      matchScore,
      keywordMatches,
      missingKeywords,
      optimizedText
    });

  } catch (error) {
    console.error("Error processing CV:", error);
    return NextResponse.json(
      { error: "Failed to process CV" },
      { status: 500 }
    );
  }
} 