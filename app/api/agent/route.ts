import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { logger } from '@/lib/logger';

/**
 * API route for AI Document Agent
 * 
 * This route forwards requests to the AWS Lambda function that handles the AI Document Agent
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
    // Authenticate user
    const session = await auth();
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

    // Validate required fields
    if (!message) {
      return NextResponse.json({ 
        error: 'Message is required' 
      }, { status: 400 });
    }

    // At least one of documentId or s3Key should be provided
    if (!documentId && !s3Key && mode !== 'create') {
      return NextResponse.json({ 
        error: 'Either documentId or s3Key is required except in create mode' 
      }, { status: 400 });
    }

    // Get Lambda endpoint from environment variable
    const lambdaEndpoint = process.env.NEXT_PUBLIC_AWS_LAMBDA_AI_AGENT_ENDPOINT;
    if (!lambdaEndpoint) {
      logger.error('AI Agent Lambda endpoint not configured', new Error('Missing Lambda endpoint configuration'));
      return NextResponse.json({ 
        error: 'AI Agent endpoint not configured' 
      }, { status: 500 });
    }

    logger.info('Sending request to AI Document Agent', {
      userId: session.user.id,
      documentId,
      s3Key,
      mode
    });

    // Prepare request payload
    const payload = {
      message,
      documentId,
      s3Key,
      userId: session.user.id,
      userEmail: session.user.email,
      mode,
      stream,
      context: {
        ...context,
        timestamp: Date.now(),
      }
    };

    // Call AWS Lambda function
    const response = await fetch(lambdaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Handle response
    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If we can't parse the JSON, just use the status code message
      }
      
      logger.error('Error from AI Agent Lambda', new Error(errorMessage), {
        httpStatus: response.status,
        httpStatusText: response.statusText
      });
      
      throw new Error(errorMessage);
    }

    // For streaming responses, we need to forward the stream
    if (stream) {
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // For regular responses, we parse the JSON and return it
    const data = await response.json();
    
    logger.info('Successfully received response from AI Document Agent', {
      userId: session.user.id,
      documentId,
      responseLength: data.response ? data.response.length : 0
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in AI Document Agent API', error);
    
    return NextResponse.json({ 
      error: errorMessage
    }, { status: 500 });
  }
} 