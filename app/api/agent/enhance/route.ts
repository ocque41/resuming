import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentById } from '@/lib/document/queries.server';

// Use simple console logging to avoid any import issues
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error || '');
  }
};

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/enhance
 * 
 * API route for document enhancement via AI agent
 * Required body parameters:
 * - message: User's message/query
 * - documentId: (optional) ID of the document to enhance
 * - mode: 'edit' | 'create' | 'analyze'
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.message) {
      return NextResponse.json(
        { error: 'Missing required parameter: message' },
        { status: 400 }
      );
    }
    
    const { message, documentId, mode = 'edit', stream = false } = body;
    
    // Log the request
    logger.info('Document enhancement request', {
      userId: session.user.id,
      documentId: documentId || 'none',
      mode,
      messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
    });

    // Get document if ID is provided
    let document = null;
    if (documentId) {
      document = await getDocumentById(documentId);
      
      if (!document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }
      
      // Check document ownership - compare as strings to avoid type issues
      if (String(document.userId) !== String(session.user.id)) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }
    
    // Check for streaming response request
    if (stream) {
      return handleStreamingResponse(message, document, mode, session.user.id);
    }
    
    // Process with AI agent
    const response = await processWithAIAgent(message, document, mode, session.user.id);
    
    // Return the response
    return NextResponse.json({
      success: true,
      response
    });
  } catch (error) {
    // Log the error - use simple string for error
    logger.error('Error in document enhancement', error instanceof Error ? error.message : 'Unknown error');
    
    // Return an error response
    return NextResponse.json(
      { error: 'Failed to process enhancement request' },
      { status: 500 }
    );
  }
}

/**
 * Process a request with the AI agent
 */
async function processWithAIAgent(message: string, document: any, mode: string, userId: string) {
  try {
    // For mock mode, just return a simulated response
    if (process.env.NEXT_PUBLIC_MOCK_BACKEND === 'true') {
      return mockAIResponse(message, document, mode);
    }
    
    // Prepare request to AWS Lambda
    const lambdaEndpoint = process.env.AWS_LAMBDA_AI_AGENT_ENDPOINT;
    
    if (!lambdaEndpoint) {
      logger.error('AWS Lambda endpoint not configured');
      return 'Sorry, the AI agent is not properly configured. Please contact support.';
    }
    
    // Prepare request body
    const requestBody = {
      message,
      documentId: document?.id,
      s3Key: document?.s3Key,
      userId,
      mode,
      // Add additional context as needed
      context: {
        documentName: document?.fileName,
        documentType: document?.type,
        documentMetadata: document?.metadata
      }
    };
    
    // Make the request to Lambda
    const response = await fetch(lambdaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Lambda returned status ${response.status}`);
    }
    
    const data = await response.json();
    return data.response || 'No response from AI agent';
  } catch (error) {
    logger.error('Error processing with AI agent', error instanceof Error ? error.message : 'Unknown error');
    return 'Sorry, I encountered an error while processing your request. Please try again later.';
  }
}

/**
 * Handle streaming response
 */
async function handleStreamingResponse(message: string, document: any, mode: string, userId: string) {
  // Create a new ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Simulate streaming response for mock mode
        if (process.env.NEXT_PUBLIC_MOCK_BACKEND === 'true') {
          const mockResponse = mockAIResponse(message, document, mode);
          
          // Break response into chunks to simulate streaming
          const chunks = mockResponse.match(/.{1,20}/g) || [];
          
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
            // Simulate delay between chunks
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          controller.close();
          return;
        }
        
        // Prepare request to AWS Lambda with streaming
        const lambdaEndpoint = process.env.AWS_LAMBDA_AI_AGENT_ENDPOINT;
        
        if (!lambdaEndpoint) {
          controller.enqueue(new TextEncoder().encode(
            'Sorry, the AI agent is not properly configured. Please contact support.'
          ));
          controller.close();
          return;
        }
        
        // Prepare request body
        const requestBody = {
          message,
          documentId: document?.id,
          s3Key: document?.s3Key,
          userId,
          mode,
          stream: true,
          context: {
            documentName: document?.fileName,
            documentType: document?.type,
            documentMetadata: document?.metadata
          }
        };
        
        // Make the request to Lambda
        const response = await fetch(lambdaEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          controller.enqueue(new TextEncoder().encode(
            `Error: Lambda returned status ${response.status}`
          ));
          controller.close();
          return;
        }
        
        // Handle streaming response from Lambda
        const reader = response.body?.getReader();
        if (!reader) {
          controller.enqueue(new TextEncoder().encode(
            'Error: Could not get response stream from Lambda'
          ));
          controller.close();
          return;
        }
        
        // Read chunks from Lambda and forward to client
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        
        controller.close();
      } catch (error) {
        // Handle errors
        logger.error('Error in streaming response', error instanceof Error ? error.message : 'Unknown error');
        controller.enqueue(new TextEncoder().encode(
          'Sorry, I encountered an error while processing your request. Please try again later.'
        ));
        controller.close();
      }
    }
  });
  
  // Return the streaming response
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

/**
 * Provide a mock AI response for testing
 */
function mockAIResponse(message: string, document: any, mode: string) {
  // Handle greetings and introductions
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('hello') || 
      lowerMessage.includes('hi') || 
      lowerMessage.includes('hey') || 
      lowerMessage.includes('greetings')) {
    
    const documentContext = document 
      ? `I see you're working with "${document.fileName}". `
      : '';
    
    let modeSpecific = '';
    if (mode === 'create') {
      modeSpecific = "I'm ready to help you create a new document. What type of document would you like to create? I can help with resumes, cover letters, reports, and more.";
    } else if (mode === 'edit') {
      modeSpecific = "I'm ready to help you edit and improve your document. Just let me know what changes you'd like to make.";
    } else if (mode === 'analyze') {
      modeSpecific = "I'm ready to analyze your document and provide insights. What would you like me to focus on?";
    } else {
      modeSpecific = "How can I assist you with your document today?";
    }
    
    return `Hello! 👋 I'm your AI document assistant. ${documentContext}${modeSpecific}`;
  }

  // Check for document creation mode
  if (mode === 'create') {
    if (lowerMessage.includes('resume') || lowerMessage.includes('cv')) {
      return `# Professional Resume\n\n## Contact Information\nJohn Doe\nEmail: john.doe@example.com\nPhone: (123) 456-7890\n\n## Professional Summary\nExperienced software developer with 5+ years of expertise in web development, specializing in React and Node.js. Passionate about creating scalable, efficient applications with excellent user experiences.\n\n## Work Experience\n### Senior Developer - Tech Solutions Inc.\n*January 2020 - Present*\n- Led development of customer-facing web applications using React\n- Implemented CI/CD pipelines reducing deployment time by 40%\n- Mentored junior developers and conducted code reviews\n\n### Web Developer - Digital Innovations\n*March 2017 - December 2019*\n- Developed responsive websites for various clients\n- Created RESTful APIs using Node.js and Express\n- Collaborated with design team to implement UI/UX improvements\n\n## Education\n**Bachelor of Science in Computer Science**\nTech University, 2017\n\n## Skills\n- JavaScript/TypeScript\n- React/Next.js\n- Node.js/Express\n- HTML/CSS\n- Git/GitHub\n- AWS/Azure\n- MongoDB/PostgreSQL`;
    } else if (lowerMessage.includes('cover letter')) {
      return `# Professional Cover Letter\n\n[Your Name]\n[Your Address]\n[City, State ZIP]\n[Your Email]\n[Your Phone]\n\n[Date]\n\n[Recipient Name]\n[Company Name]\n[Company Address]\n[City, State ZIP]\n\nDear [Recipient Name],\n\nI am writing to express my interest in the [Position] role at [Company Name]. With my background in [relevant field] and passion for [industry/work], I believe I would be a valuable addition to your team.\n\nIn my current position at [Current/Previous Company], I have developed expertise in [relevant skills/experiences that match the job description]. Some of my key accomplishments include [accomplishment 1], [accomplishment 2], and [accomplishment 3]. These experiences have prepared me well for the challenges and opportunities at [Company Name].\n\nI am particularly drawn to [Company Name] because of your [mention something specific about the company that interests you, such as their mission, products, culture, or recent developments]. I am excited about the possibility of contributing to [specific project or company goal].\n\nThank you for considering my application. I welcome the opportunity to discuss how my skills and experiences align with your needs. I look forward to hearing from you.\n\nSincerely,\n\n[Your Name]`;
    } else if (lowerMessage.includes('report')) {
      return `# Quarterly Business Analysis Report\n\n## Executive Summary\nThis report provides an analysis of the company's performance during Q1 2023. Overall, we have seen a 15% increase in revenue compared to the same period last year, driven primarily by our new product launches and expanded market presence.\n\n## Introduction\nThe purpose of this report is to analyze the business performance for Q1 2023 and provide insights into key trends, challenges, and opportunities for the upcoming quarters.\n\n## Methodology\nThis analysis uses data from our internal sales systems, customer feedback surveys, and market research reports. We have compared current performance metrics against historical data and industry benchmarks.\n\n## Findings\n\n### Sales Performance\n- Total Revenue: $2.4M (15% YoY increase)\n- Units Sold: 12,500 (8% YoY increase)\n- Average Order Value: $192 (7% YoY increase)\n\n### Regional Performance\n- North America: $1.2M (20% YoY increase)\n- Europe: $750K (12% YoY increase)\n- Asia-Pacific: $450K (10% YoY increase)\n\n### Product Performance\n- Product Line A: $1.1M (22% YoY increase)\n- Product Line B: $800K (10% YoY increase)\n- Product Line C: $500K (8% YoY increase)\n\n## Analysis\nThe significant growth in North American sales can be attributed to our new marketing campaign and expanded distribution network. Product Line A continues to be our strongest performer, driven by the new features added in the latest release.\n\n## Conclusions\nOur Q1 performance exceeds expectations and positions us well for continued growth. The investments in marketing and product development have yielded positive returns and should be continued.\n\n## Recommendations\n1. Increase marketing budget for North American region by 15%\n2. Accelerate development of new features for Product Line A\n3. Investigate underperformance of Product Line C and develop improvement strategy\n4. Expand distribution network in Asia-Pacific region to capture additional market share\n5. Implement customer loyalty program to increase repeat purchases\n\n## Appendices\n- Detailed Sales Data by Region and Product\n- Customer Satisfaction Survey Results\n- Competitor Analysis\n- Marketing Campaign Performance Metrics`;
    } else {
      return `I'd be happy to help you create a document. What type of document would you like me to help with? Some options include:\n\n- Resume/CV\n- Cover Letter\n- Business Report\n- Project Proposal\n- Meeting Minutes\n- Research Paper\n- Marketing Plan\n\nJust let me know what you need, and I can provide a template or help you draft it from scratch.`;
    }
  }
  
  // Check for document editing mode
  if (mode === 'edit' && document) {
    return `I've reviewed your document "${document.fileName}" and here are my suggestions for improvement:\n\n1. **Structure Improvements:**\n   - Consider adding clear section headings to improve readability\n   - Reorganize content to follow a more logical flow\n\n2. **Content Enhancements:**\n   - Add more specific details to strengthen your key points\n   - Consider adding data or examples to support your claims\n\n3. **Language Refinement:**\n   - Improve clarity by simplifying complex sentences\n   - Use more active voice to make your writing more engaging\n\n4. **Formatting Suggestions:**\n   - Add bullet points for lists to improve readability\n   - Consider using bold or italic formatting for emphasis\n\nWould you like me to implement any of these changes for you? Or would you prefer more specific feedback on any particular section?`;
  }
  
  // Default response for analysis mode or when no specific mode is detected
  return `I've analyzed your message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"\n\nTo better assist you, could you clarify if you'd like to:\n\n1. **Create a new document** - I can help you draft various document types like resumes, cover letters, reports, or proposals.\n\n2. **Edit an existing document** - I can review your document and suggest improvements in structure, content, language, and formatting.\n\n3. **Analyze content** - I can provide insights and extract key information from your document.\n\nJust let me know which option you prefer, and we can proceed from there.`;
} 