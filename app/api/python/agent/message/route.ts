import { NextRequest, NextResponse } from 'next/server';

// Python backend URL - configurable via environment variables
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const requestBody = await request.json();
    
    // Forward the request to the Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/agent/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    // Check for successful response
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from Python backend: ${response.status}`, errorText);
      
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    // Return the response from the Python backend
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error in /api/python/agent/message:', error);
    
    return NextResponse.json(
      { error: 'Failed to process agent request' },
      { status: 500 }
    );
  }
} 