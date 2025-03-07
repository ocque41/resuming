// lib/analyzeCV.ts
export async function analyzeCV(rawText: string): Promise<any> {
  // Clean the raw text: trim and collapse multiple whitespace characters into a single space.
  const cleanedText = rawText.trim().replace(/\s+/g, ' ');

  // Detect industry first so we can tailor analysis
  const detectedIndustry = detectIndustry(cleanedText);
  console.log(`Detected industry: ${detectedIndustry}`);

  // Construct an enhanced prompt for a detailed, job-oriented analysis.
  const prompt = `You are an expert CV reviewer and career consultant specializing in resume optimization for IMMEDIATE job applications. The user is trying to GET A JOB NOW - not improve their career long-term.

Analyze the following CV content and produce a detailed, tailored assessment aimed at helping the candidate SECURE A JOB RIGHT AWAY in the ${detectedIndustry} industry. 

IMPORTANT: Do NOT suggest getting more experience or education - the candidate needs to use what they already have to land interviews immediately.

Key ATS insights for ${detectedIndustry} industry:
${getIndustrySpecificAtsInsights(detectedIndustry)}

Analyze the CV to determine:
1. The candidate's career path and industry (e.g., software development, marketing, finance)
2. Their education level and career stage (e.g., recent graduate, mid-career professional)
3. Their most marketable skills and experiences for their target industry
4. How their CV can be immediately improved to stand out to employers

Return a JSON object with the following keys:
- "atsScore": A number between 1-100 without any symbols or characters (example: 85)
- "industry": The specific industry the candidate is in (be precise - e.g. "Front-end Web Development" not just "Technology")
- "strengths": An array of 3-5 key strengths that make the candidate immediately employable in their field.
- "weaknesses": An array of 3-5 specific issues in the CV that are hurting their chances of getting interviews RIGHT NOW (focus on presentation, not suggesting more experience).
- "missingKeywords": An array of 3-7 industry-specific keywords that are commonly expected in CVs for this industry but are missing from this CV.
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
  
  if (!result.choices || !result.choices[0] || !result.choices[0].message) {
    throw new Error('Invalid response from OpenAI API');
  }
  
  const message = result.choices[0].message.content;

  try {
    // First, try to parse the message as JSON
    let analysis;
    try {
      analysis = JSON.parse(message);
    } catch (parseError) {
      // If direct parsing fails, try to extract JSON from the message
      const jsonMatch = message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not extract valid JSON from the response');
      }
    }
    
    // Format the ATS score
    if (analysis.atsScore !== undefined) {
      // Handle different types of atsScore
      let score;
      if (typeof analysis.atsScore === 'number') {
        score = analysis.atsScore;
      } else if (typeof analysis.atsScore === 'string') {
        // Remove any non-numeric characters and parse
        const numericString = analysis.atsScore.replace(/[^0-9]/g, '');
        score = parseInt(numericString, 10);
      }
      
      // Ensure score is a valid number
      if (!isNaN(score)) {
        analysis.atsScore = score;
      } else {
        // Default to a middle score if parsing fails
        analysis.atsScore = 50;
      }
    }
    
    return analysis;
  } catch (error) {
    console.error('Error parsing AI response:', error);
    console.error('Raw response:', message);
    throw new Error('Failed to parse AI response: ' + message);
  }
}

// Helper function to detect industry based on CV content
function detectIndustry(text: string): string {
  // Normalize text for better pattern matching
  const normalizedText = text.toLowerCase();
  
  // Technology industry patterns
  const techPatterns = [
    /\b(javascript|typescript|python|java|c\+\+|react|angular|vue|node\.js|express|django)\b/i,
    /\b(software engineer|developer|frontend|backend|full stack|web developer|mobile developer)\b/i,
    /\b(aws|azure|gcp|docker|kubernetes|devops|cloud)\b/i,
    /\b(machine learning|data science|artificial intelligence|ml|ai|deep learning)\b/i,
    /\b(github|gitlab|bitbucket|git|agile|scrum|jira)\b/i
  ];
  
  // Finance industry patterns
  const financePatterns = [
    /\b(accounting|accountant|cpa|financial|finance|investment|banking)\b/i,
    /\b(portfolio|asset management|wealth management|financial analysis)\b/i,
    /\b(balance sheet|p&l|profit and loss|cash flow|financial reporting)\b/i,
    /\b(equity|stocks|bonds|securities|trading|trader|hedge fund)\b/i,
    /\b(bloomberg|refinitiv|excel|financial modeling|valuation)\b/i
  ];
  
  // Marketing industry patterns
  const marketingPatterns = [
    /\b(marketing|digital marketing|brand|content marketing|social media)\b/i,
    /\b(seo|sem|ppc|google ads|facebook ads|paid social|paid search)\b/i,
    /\b(content creation|content strategy|copywriting|brand strategy)\b/i,
    /\b(campaign management|email marketing|crm|analytics|roi)\b/i,
    /\b(hubspot|mailchimp|hootsuite|google analytics|adobe analytics)\b/i
  ];
  
  // Healthcare industry patterns
  const healthcarePatterns = [
    /\b(healthcare|medical|clinical|patient care|physician|doctor|nurse)\b/i,
    /\b(hospital|clinic|ehr|emr|epic|cerner|meditech)\b/i,
    /\b(pharmaceutical|pharma|biotech|drug development|clinical trials)\b/i,
    /\b(hipaa|regulatory compliance|fda|medical devices|healthcare policy)\b/i,
    /\b(patient|diagnosis|treatment|care coordination|telehealth)\b/i
  ];
  
  // Sales industry patterns
  const salesPatterns = [
    /\b(sales|account executive|business development|account manager)\b/i,
    /\b(revenue|quota|pipeline|leads|prospects|closed deals|closing)\b/i,
    /\b(crm|salesforce|hubspot|outreach|sales engagement)\b/i,
    /\b(negotiation|customer acquisition|relationship management)\b/i,
    /\b(b2b|b2c|enterprise sales|inside sales|outside sales|field sales)\b/i
  ];
  
  // Count matches for each industry
  const techMatches = techPatterns.filter(pattern => pattern.test(normalizedText)).length;
  const financeMatches = financePatterns.filter(pattern => pattern.test(normalizedText)).length;
  const marketingMatches = marketingPatterns.filter(pattern => pattern.test(normalizedText)).length;
  const healthcareMatches = healthcarePatterns.filter(pattern => pattern.test(normalizedText)).length;
  const salesMatches = salesPatterns.filter(pattern => pattern.test(normalizedText)).length;
  
  // Determine the best match
  const matches = [
    { industry: 'Technology', count: techMatches },
    { industry: 'Finance', count: financeMatches },
    { industry: 'Marketing', count: marketingMatches },
    { industry: 'Healthcare', count: healthcareMatches },
    { industry: 'Sales', count: salesMatches }
  ];
  
  // Sort by match count (descending)
  matches.sort((a, b) => b.count - a.count);
  
  // Detect tech sub-industries
  if (matches[0].industry === 'Technology' && matches[0].count > 0) {
    if (/\b(machine learning|data science|artificial intelligence|ml|ai|neural network)\b/i.test(normalizedText)) {
      return 'AI & Data Science';
    }
    if (/\b(frontend|react|angular|vue|html|css|ui|ux|web design)\b/i.test(normalizedText)) {
      return 'Front-end Development';
    }
    if (/\b(backend|api|server|node\.js|django|flask|express|database)\b/i.test(normalizedText)) {
      return 'Back-end Development';
    }
    if (/\b(devops|cloud|aws|azure|gcp|kubernetes|docker|ci\/cd|jenkins)\b/i.test(normalizedText)) {
      return 'DevOps & Cloud Engineering';
    }
    if (/\b(mobile|ios|android|swift|kotlin|react native|flutter)\b/i.test(normalizedText)) {
      return 'Mobile Development';
    }
  }
  
  // If no strong match, return generic
  if (matches[0].count === 0) {
    return 'General';
  }
  
  return matches[0].industry;
}

// Get industry-specific ATS insights
function getIndustrySpecificAtsInsights(industry: string): string {
  const insights: Record<string, string> = {
    'Technology': `
- Technical skills should be prominently listed in a dedicated "Technical Skills" or "Skills" section
- Include specific versions of technologies, programming languages, and frameworks (e.g., "React 18" not just "React")
- Use standard job titles that ATS systems recognize (e.g., "Full Stack Developer" not "Code Ninja")
- Include metrics of project success (e.g., "reduced page load time by 40%")
- List relevant GitHub repositories or technical projects
- Include certifications with exact names (e.g., "AWS Certified Solutions Architect")`,
    
    'AI & Data Science': `
- List specific ML/AI frameworks and libraries (TensorFlow, PyTorch, scikit-learn, etc.)
- Include experience with specific algorithms and models
- Mention data visualization tools (Tableau, PowerBI, etc.)
- Highlight experience with large datasets, distributed computing
- Quantify achievements with metrics (accuracy improvement, efficiency gains)
- Include any published research or competition results`,
    
    'Front-end Development': `
- List modern front-end frameworks (React, Vue, Angular, etc.)
- Include experience with state management (Redux, Context API, etc.)
- Mention responsive design, cross-browser compatibility
- Include experience with CSS preprocessors (SASS, LESS)
- Highlight performance optimization achievements
- Include any UI/UX knowledge or collaboration`,
    
    'Back-end Development': `
- List specific backend frameworks and languages (Node.js, Django, Rails, etc.)
- Include database experience (SQL, NoSQL, specific DB systems)
- Mention API development and patterns (REST, GraphQL)
- Include experience with authentication, authorization systems
- Highlight scalability solutions and achievements
- Mention serverless experience if applicable`,
    
    'DevOps & Cloud Engineering': `
- List specific cloud platforms with certification details
- Include experience with IaC tools (Terraform, CloudFormation)
- Mention container orchestration (Kubernetes, Docker Swarm)
- Include CI/CD pipeline tools and experience
- Highlight automation achievements and metrics
- Include security practices and compliance experience`,
    
    'Mobile Development': `
- List specific mobile platforms (iOS, Android, cross-platform)
- Include experience with native languages (Swift, Kotlin, etc.)
- Mention app store deployment experience
- Include app performance metrics and user metrics
- Highlight experience with responsive UI, offline features
- Include any experience with app analytics`,
    
    'Finance': `
- Include specific financial certifications (CPA, CFA, etc.)
- List financial software proficiency (Bloomberg Terminal, FactSet, etc.)
- Mention regulatory compliance knowledge (SOX, IFRS, GAAP)
- Include quantifiable achievements (cost reductions, profit increases)
- Highlight advanced Excel skills and financial modeling
- Use financial terminology specific to your sub-field`,
    
    'Marketing': `
- Include digital marketing tools and platforms
- List specific campaign metrics and ROI achievements
- Mention experience with analytics platforms
- Include content management systems and marketing automation
- Highlight social media platform-specific experience
- Use metrics for all achievements (growth percentages, audience size)`,
    
    'Healthcare': `
- Include healthcare-specific certifications and licenses
- List experience with EHR/EMR systems by name
- Mention compliance knowledge (HIPAA, HITECH)
- Include patient care metrics or quality improvement initiatives
- Highlight specialized medical terminology relevant to your field
- Use recognized medical credentials and formatting`,
    
    'Sales': `
- Include specific sales methodologies (SPIN, Challenger, etc.)
- List CRM systems and sales tools by name
- Mention quota achievement percentages
- Include client acquisition metrics and deal sizes
- Highlight industry-specific sales experience
- Use recognized metrics (YoY growth, percent to quota)`,
    
    'General': `
- Use relevant industry keywords from job descriptions
- Include specific achievements with metrics
- List software and tools relevant to your role
- Mention project management methodologies if applicable
- Highlight transferable skills with examples
- Use standard job titles for your industry`
  };
  
  return insights[industry] || insights['General'];
}
