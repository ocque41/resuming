import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

/**
 * API route for AI Document Agent
 * 
 * This is a mock implementation as we transition to a new backend
 * 
 * Required parameters:
 * - message: string (the user's message)
 * 
 * Optional parameters:
 * - documentId: string (ID of the document to analyze)
 * - s3Key: string (S3 key of the document if not yet in database)
 * - mode: string (edit, create, or analyze)
 * - stream: boolean (whether to stream the response)
 * - context: object (additional context for the agent)
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user using a more reliable method
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    // Get request body
    const body = await req.json();
    const { 
      message, 
      documentId, 
      s3Key, 
      mode = 'analyze',
      stream = false,
      context = {} 
    } = body;

    // Simple logging
    console.log('Agent API request:', {
      messageLength: message?.length,
      documentId,
      s3Key,
      mode,
      stream
    });

    // Validate required fields
    if (!message) {
      return NextResponse.json({ 
        error: 'Message is required' 
      }, { status: 400 });
    }

    // Generate a mock response based on the input
    const response = generateMockResponse(message, mode);
    
    // Simulate a delay to make it feel more realistic
    await new Promise((resolve) => setTimeout(resolve, 500));

    // If streaming is enabled, return a mock stream
    if (stream) {
      // For simplicity, we'll just return a regular response for now
      // In a real implementation, you would set up proper streaming
      return NextResponse.json({
        response,
        documentId,
        s3Key,
        mode,
        status: 'success',
        mockResponse: true
      });
    }

    // Return regular mock response
    return NextResponse.json({
      response,
      documentId,
      s3Key,
      mode,
      status: 'success',
      mockResponse: true
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in AI Document Agent API:', errorMessage);
    
    return NextResponse.json({ 
      error: errorMessage
    }, { status: 500 });
  }
}

/**
 * Generate a mock response based on the message and mode
 */
function generateMockResponse(message: string, mode: string): string {
  const lowercaseMsg = message.toLowerCase();
  
  // Check for greetings
  if (lowercaseMsg.includes('hello') || 
      lowercaseMsg.includes('hi') || 
      lowercaseMsg.includes('hey')) {
    return "Hello! I'm your AI document assistant. How can I help you today?";
  }
  
  // Mode-specific responses
  switch (mode) {
    case 'create':
      return "I'd be happy to help you create a new document. What type of document are you looking to create?";
    case 'edit':
      return "I can help you edit your document. What changes would you like to make?";
    case 'analyze':
      return "I'll analyze this document for you. Give me a moment... Based on my analysis, I can see several areas that could be improved.";
    default:
      return "I understand your request. How else can I assist you with your document?";
  }
} 