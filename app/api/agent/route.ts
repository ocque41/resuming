import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

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

    // Check for simple greeting to bypass document requirement
    const isSimpleGreeting = /^(hello|hi|hey|greetings|howdy)(\s.*)?$/i.test(message.trim());
    const isCreateMode = mode === 'create';
    
    // At least one of documentId or s3Key should be provided
    // Skip this check for create mode or simple greetings
    if (!documentId && !s3Key && !isCreateMode && !isSimpleGreeting) {
      return NextResponse.json({ 
        error: 'Either documentId or s3Key is required except in create mode or for simple greetings' 
      }, { status: 400 });
    }

    // Get Lambda endpoint from environment variable with multiple fallbacks
    let lambdaEndpoint = process.env.NEXT_PUBLIC_AWS_LAMBDA_AI_AGENT_ENDPOINT || 
                         process.env.AWS_LAMBDA_AI_AGENT_ENDPOINT;
    
    const mockMode = process.env.NEXT_PUBLIC_MOCK_BACKEND === 'true';
    const isDevMode = process.env.NODE_ENV === 'development';
    
    // If endpoint is not configured, check if we should use fallbacks
    if (!lambdaEndpoint) {
      // In development or mock mode, provide a fallback response
      if (isDevMode || mockMode) {
        console.warn('Using mock response for AI agent in development/mock mode');
        return NextResponse.json({
          response: `This is a mock response in ${isDevMode ? 'development' : 'mock'} mode. Your message was: "${message}"`,
          documentId,
          s3Key,
          mode,
          status: 'success',
          mockResponse: true
        });
      }
      
      // In production with no endpoint, return a clear error
      console.error('AI Agent Lambda endpoint not configured - please set NEXT_PUBLIC_AWS_LAMBDA_AI_AGENT_ENDPOINT in your environment');
      return NextResponse.json({ 
        error: 'AI Agent endpoint not configured - please check server environment variables',
        details: 'Contact administrator to configure the Lambda endpoint'
      }, { status: 500 });
    }

    // Prepare request payload
    const payload = {
      message,
      documentId,
      s3Key,
      userId: session.user.id,
      mode: isSimpleGreeting && !isCreateMode ? 'create' : mode, // Force create mode for simple greetings
      stream,
      context: {
        ...context,
        timestamp: Date.now(),
        isSimpleGreeting
      }
    };

    try {
      // Call AWS Lambda function with proper authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add API key if configured (common auth method for API Gateway)
      const apiKey = process.env.AWS_LAMBDA_API_KEY || process.env.API_GATEWAY_KEY;
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }
      
      // Add authorization header if configured
      const authToken = process.env.AWS_LAMBDA_AUTH_TOKEN;
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      console.log('Calling Lambda with headers:', Object.keys(headers));
      
      const response = await fetch(lambdaEndpoint, {
        method: 'POST',
        headers,
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
        
        console.error('Error from AI Agent Lambda:', errorMessage);
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
      return NextResponse.json(data);
    } catch (fetchError) {
      console.error('Fetch error in agent API:', fetchError);
      
      // If in development mode, provide a helpful mock response
      if (isDevMode || mockMode) {
        return NextResponse.json({
          response: `This is a fallback response due to an error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}. Your message was: "${message}"`,
          documentId,
          s3Key,
          mode,
          status: 'error_fallback',
          mockResponse: true
        });
      }
      
      return NextResponse.json({ 
        error: fetchError instanceof Error ? fetchError.message : 'Error calling agent service'
      }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in AI Document Agent API:', errorMessage);
    
    return NextResponse.json({ 
      error: errorMessage
    }, { status: 500 });
  }
} 