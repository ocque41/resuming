// lib/analyzeCV.ts
export async function analyzeCV(rawText: string): Promise<any> {
  // Clean the raw text: trim and collapse multiple whitespace characters into a single space.
  const cleanedText = rawText.trim().replace(/\s+/g, ' ');

  // Construct an enhanced prompt for a detailed, job-oriented analysis.
  const prompt = `You are an expert CV reviewer and career consultant specializing in resume optimization for IMMEDIATE job applications. The user is trying to GET A JOB NOW - not improve their career long-term.

Analyze the following CV content and produce a detailed, tailored assessment aimed at helping the candidate SECURE A JOB RIGHT AWAY. 

IMPORTANT: Do NOT suggest getting more experience or education - the candidate needs to use what they already have to land interviews immediately.

Analyze the CV to determine:
1. The candidate's career path and industry (e.g., software development, marketing, finance)
2. Their education level and career stage (e.g., recent graduate, mid-career professional)
3. Their most marketable skills and experiences for their target industry
4. How their CV can be immediately improved to stand out to employers

Return a JSON object with the following keys:
- "atsScore": A percentage (example: 85%) indicating how well the CV is optimized for Applicant Tracking Systems.
- "strengths": An array of 3-5 key strengths that make the candidate immediately employable in their field.
- "weaknesses": An array of 3-5 specific issues in the CV that are hurting their chances of getting interviews RIGHT NOW (focus on presentation, not suggesting more experience).
- "recommendations": An array of 3 specific, actionable recommendations that will immediately improve their chances of getting interviews. Focus on:
   1. Keyword optimization for their specific industry
   2. Reorganizing content to highlight their most impressive achievements
   3. Removing or de-emphasizing content that doesn't help them get a job now

- "industryInsight": A brief analysis of how competitive the candidate is in their industry based on their current qualifications, and specific suggestions for positioning themselves effectively against other candidates.
- "targetRoles": An array of 2-3 specific job titles that the candidate should apply for based on their current qualifications.

Return your answer strictly as a JSON object with these exact keys (do not include any extra text or explanations).

CV Content:
${cleanedText}`;

  // Call OpenAI's API to get the analysis.
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4', // Upgraded to GPT-4 for better analysis
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });

  const result = await response.json();
  const message = result.choices[0].message.content;

  try {
    const analysis = JSON.parse(message);
    return analysis;
  } catch (error) {
    throw new Error('Failed to parse AI response: ' + message);
  }
}
