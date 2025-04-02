import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Response type definition
type UploadUrlResponse = {
  uploadUrl: string;
  s3Key: string;
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
    const { fileName, fileType } = body;

    // Validate request
    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    // Get Lambda endpoint from environment variable
    const lambdaEndpoint = process.env.NEXT_PUBLIC_PRESIGNED_URL_ENDPOINT;
    if (!lambdaEndpoint) {
      return NextResponse.json({ error: 'Presigned URL endpoint not configured' }, { status: 500 });
    }

    // Call AWS Lambda function
    const response = await fetch(lambdaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        fileType,
      }),
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }

    // Parse and return response
    const data = await response.json();
    return NextResponse.json({
      uploadUrl: data.uploadUrl,
      s3Key: data.s3Key
    });
  } catch (error: any) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred'
    }, { status: 500 });
  }
} 