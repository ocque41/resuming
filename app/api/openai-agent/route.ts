import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

// Get the Python API URL from environment variables
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Add user ID to the request body
    const requestBody = await request.json();
    const bodyWithUser = {
      ...requestBody,
      userId: session.user.id,
    };
    
    // Get the agent mode from the request (analyze, edit, create)
    const mode = requestBody.mode || 'analyze';
    
    // Forward the request to the Python API
    const response = await fetch(`${PYTHON_API_URL}/agent/${mode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyWithUser),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Python API request failed' },
        { status: response.status }
      );
    }
    
    // Return the response from the Python API
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error proxying request to Python API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle streaming responses
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const documentId = searchParams.get('documentId');
    const mode = searchParams.get('mode') || 'analyze';
    
    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing required parameter: documentId' },
        { status: 400 }
      );
    }
    
    // Create URL for streaming endpoint
    const streamUrl = new URL(`/agent/${mode}/stream`, PYTHON_API_URL);
    streamUrl.searchParams.append('documentId', documentId);
    streamUrl.searchParams.append('userId', session.user.id.toString());
    
    // Forward to Python API with streaming enabled
    const response = await fetch(streamUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Python API streaming request failed' },
        { status: response.status }
      );
    }
    
    // Return the streaming response
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('Error in streaming request to Python API:', error);
    return NextResponse.json(
      { error: 'Internal server error in streaming request' },
      { status: 500 }
    );
  }
} 