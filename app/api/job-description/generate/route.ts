import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/db/queries.server";
import { mistralService } from "@/lib/services/mistral.service";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the request body
    const body = await req.json();
    const {
      jobTitle,
      industry,
      experienceLevel,
      keySkills,
      location,
      companyDescription,
      additionalDetails
    } = body;

    // Validate required parameters
    if (!jobTitle) {
      return NextResponse.json(
        { error: "Job title is required" },
        { status: 400 }
      );
    }

    // Construct the prompt
    const prompt = `Generate a professional job description for the following position:

Job Title: ${jobTitle}
${industry ? `Industry: ${industry}` : ''}
${experienceLevel ? `Experience Level: ${experienceLevel}` : ''}
${keySkills ? `Key Skills/Requirements: ${keySkills}` : ''}
${location ? `Location: ${location}` : ''}
${companyDescription ? `Company Description: ${companyDescription}` : ''}
${additionalDetails ? `Additional Details: ${additionalDetails}` : ''}

Please format the job description with the following sections:
1. Overview/Summary
2. Responsibilities
3. Requirements/Qualifications
4. Benefits/Perks (if applicable)
5. How to Apply

The response should be well-structured, professional, and detailed enough to attract qualified candidates.`;

    // Generate the job description
    const response = await mistralService.generateText({
      prompt,
      temperature: 0.7,
      max_tokens: 2000,
    });

    // Return the generated job description
    return NextResponse.json({ jobDescription: response });
  } catch (error) {
    logger.error("Error generating job description", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: "Failed to generate job description" },
      { status: 500 }
    );
  }
} 