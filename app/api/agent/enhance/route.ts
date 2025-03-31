import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Python backend URL (replace with environment variable in production)
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const requestData = await request.json();
    const { message, documentId, mode, stream = false } = requestData;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Call Python backend with OpenAI Agents SDK
    const userId = session.user.id;
    
    try {
      // Add streaming support if requested
      if (stream) {
        // Call the streaming endpoint
        const streamUrl = `${PYTHON_BACKEND_URL}/agent/enhance/stream`;
        const agentResponse = await fetch(streamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            document_id: documentId,
            mode,
            user_id: userId
          }),
        });
        
        if (!agentResponse.ok) {
          throw new Error(`Agent API Error: ${agentResponse.statusText}`);
        }
        
        // Create a TransformStream to pass the streaming data to the client
        const { readable, writable } = new TransformStream();
        
        // Pipe the response from the Python backend to the client
        const reader = agentResponse.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get reader from agent response');
        }
        
        const writer = writable.getWriter();
        
        // Stream handling in background
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              await writer.write(value);
            }
          } catch (error) {
            console.error('Error in streaming:', error);
          } finally {
            await writer.close();
          }
        })();
        
        // Return a streaming response
        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
          },
        });
      } else {
        // Regular non-streaming API call
        const agentResponse = await fetch(`${PYTHON_BACKEND_URL}/agent/enhance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            document_id: documentId,
            mode,
            user_id: userId
          }),
        });
        
        if (!agentResponse.ok) {
          const errorData = await agentResponse.json();
          throw new Error(`Agent API Error: ${errorData.detail || agentResponse.statusText}`);
        }
        
        const data = await agentResponse.json();
        return NextResponse.json(data);
      }
    } catch (error: any) {
      console.error('Error calling Python backend:', error);
      
      // Fallback response for debugging/development
      return NextResponse.json({
        response: `[${mode === 'edit' ? 'Edit' : 'Create'} Mode] There was an error processing your request. (Backend error: ${error.message})`,
        documentId: documentId || 'new-document-id',
        mode
      });
    }
  } catch (error: any) {
    console.error('Error processing agent request:', error);
    return NextResponse.json(
      { error: 'Failed to process request', message: error.message },
      { status: 500 }
    );
  }
} 