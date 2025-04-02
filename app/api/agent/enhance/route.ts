import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocumentById } from '@/lib/document/queries.server';
import { simpleLogger as logger } from '@/lib/logger';

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
    // Log the error
    logger.error('Error in document enhancement', error instanceof Error ? error : 'Unknown error');
    
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
    logger.error('Error processing with AI agent', error instanceof Error ? error : 'Unknown error');
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
        logger.error('Error in streaming response', error instanceof Error ? error : 'Unknown error');
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
 * Generate a mock AI response for development
 */
function mockAIResponse(message: string, document: any, mode: string) {
  const documentInfo = document ? 
    `document "${document.fileName}"` : 
    'no specific document';
  
  if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
    return `Hello! I'm your AI document assistant. You're working with ${documentInfo}. How can I help you today?`;
  }
  
  if (message.toLowerCase().includes('create')) {
    return `I'll help you create a new document. What type of document would you like to create? For example, I can help with resumes, cover letters, reports, or other professional documents.`;
  }
  
  if (message.toLowerCase().includes('edit') || message.toLowerCase().includes('change')) {
    return `I'll help you edit ${documentInfo}. What changes would you like to make? For example, I can help improve formatting, clarity, or structure.`;
  }
  
  if (message.toLowerCase().includes('analyze') || message.toLowerCase().includes('review')) {
    return `After analyzing ${documentInfo}, here are my observations:\n\n1. The document is well-structured overall.\n2. Some sentences could be more concise.\n3. Consider adding more specific examples to strengthen your points.\n\nWould you like me to suggest specific improvements?`;
  }
  
  // Default response
  return `I'll help you with ${documentInfo} in ${mode} mode. To get started, could you please tell me more specifically what you'd like to do? For example, you can ask me to analyze the content, suggest improvements, or help with editing specific sections.`;
} 