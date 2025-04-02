import { NextRequest } from 'next/server';

// Python backend URL - configurable via environment variables
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const requestBody = await request.json();
    
    // Forward the request to the Python backend streaming endpoint
    const backendResponse = await fetch(`${PYTHON_BACKEND_URL}/api/agent/message/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    // Check for successful response
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error(`Error from Python backend: ${backendResponse.status}`, errorText);
      
      // Create a response with error details
      const encoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: `Backend error: ${backendResponse.statusText}` })}\n\n`));
          controller.close();
        },
      });
      
      return new Response(errorStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        status: 500,
      });
    }
    
    // Create a transform stream to process the response
    const { readable, writable } = new TransformStream();
    
    // Pipe the backend response to our client response
    if (backendResponse.body) {
      backendResponse.body.pipeTo(writable);
    }
    
    // Return the streaming response
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) {
    console.error('Error in /api/python/agent/message/stream:', error);
    
    // Create an error stream
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Failed to process streaming request' })}\n\n`));
        controller.close();
      },
    });
    
    return new Response(errorStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
      status: 500,
    });
  }
} 