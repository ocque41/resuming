import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Response type definition
type AIResponse = {
  response?: string;
  status: string;
  error?: string;
  request?: {
    documentId?: string;
    documentKey?: string;
  };
};

// Error response type definition
type ErrorResponse = {
  error: string;
};

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Get request body
    const body = await req.json();
    const { prompt, documentKey, documentId } = body;

    // Validate request
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Get Lambda endpoint from environment variable
    const lambdaEndpoint = process.env.NEXT_PUBLIC_AI_AGENT_ENDPOINT;
    if (!lambdaEndpoint) {
      return NextResponse.json({ error: 'AI Agent endpoint not configured' }, { status: 500 });
    }

    // Call AWS Lambda function
    const response = await fetch(lambdaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        documentKey,
        documentId,
      }),
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }

    // Parse and return response
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error calling AI agent:', error);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred',
      status: 'error'
    }, { status: 500 });
  }
} 