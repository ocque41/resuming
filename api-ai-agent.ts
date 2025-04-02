import type { NextApiRequest, NextApiResponse } from 'next';

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AIResponse | ErrorResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get request body
    const { prompt, documentKey, documentId } = req.body;

    // Validate request
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get Lambda endpoint from environment variable
    const lambdaEndpoint = process.env.NEXT_PUBLIC_AI_AGENT_ENDPOINT;
    if (!lambdaEndpoint) {
      return res.status(500).json({ error: 'AI Agent endpoint not configured' });
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
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error calling AI agent:', error);
    return res.status(500).json({ 
      error: error.message || 'An unexpected error occurred',
      status: 'error'
    });
  }
} 