import type { NextRequest } from 'next/server';

export type AIResponse = {
  response: string;
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
    const { prompt, documentKey, documentId } = body;

    // Validate the request
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' } as ErrorResponse),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Get the Lambda endpoint from environment variables
    const lambdaEndpoint = process.env.AWS_LAMBDA_AI_AGENT_ENDPOINT;

    if (!lambdaEndpoint) {
      console.error('AWS_LAMBDA_AI_AGENT_ENDPOINT is not configured');
      return new Response(
        JSON.stringify({ 
          error: 'AI agent is not properly configured' 
        } as ErrorResponse),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Call the AWS Lambda function
    const lambdaResponse = await fetch(lambdaEndpoint, {
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

    if (!lambdaResponse.ok) {
      const errorText = await lambdaResponse.text();
      console.error('Lambda function error:', errorText);
      
      return new Response(
        JSON.stringify({ 
          error: 'Error processing your request' 
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
    
    return new Response(
      JSON.stringify({
        response: data.response || 'No response from AI agent',
      } as AIResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in AI agent API route:', error);
    
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