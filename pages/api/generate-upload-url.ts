import type { NextRequest } from 'next/server';

export type UploadUrlResponse = {
  uploadUrl: string;
  s3Key: string;
};

export type ErrorResponse = {
  error: string;
};

export const config = {
  runtime: 'edge',
};

export default async function handler(
  req: NextRequest
): Promise<Response> {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' } as ErrorResponse),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { fileName, fileType } = body;

    // Validate the request
    if (!fileName) {
      return new Response(
        JSON.stringify({ error: 'File name is required' } as ErrorResponse),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Get the Lambda endpoint from environment variables
    const lambdaEndpoint = process.env.AWS_LAMBDA_PRESIGNED_URL_ENDPOINT;

    if (!lambdaEndpoint) {
      console.error('AWS_LAMBDA_PRESIGNED_URL_ENDPOINT is not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Upload service is not properly configured' 
        } as ErrorResponse),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Call the AWS Lambda function to get a presigned URL
    const lambdaResponse = await fetch(lambdaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        fileType: fileType || 'application/octet-stream',
      }),
    });

    if (!lambdaResponse.ok) {
      const errorText = await lambdaResponse.text();
      console.error('Lambda function error:', errorText);
      
      return new Response(
        JSON.stringify({ 
          error: 'Error generating upload URL' 
        } as ErrorResponse),
        {
          status: lambdaResponse.status,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const data = await lambdaResponse.json();
    
    // Validate the Lambda response
    if (!data.uploadUrl || !data.s3Key) {
      console.error('Invalid Lambda response:', data);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid response from upload service' 
        } as ErrorResponse),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        uploadUrl: data.uploadUrl,
        s3Key: data.s3Key,
      } as UploadUrlResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in generate upload URL API route:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error' 
      } as ErrorResponse),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
} 