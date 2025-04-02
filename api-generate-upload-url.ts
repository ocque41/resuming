import type { NextApiRequest, NextApiResponse } from 'next';

// Response type definition
type UploadUrlResponse = {
  uploadUrl: string;
  s3Key: string;
};

// Error response type definition
type ErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadUrlResponse | ErrorResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get request body
    const { fileName, fileType } = req.body;

    // Validate request
    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    // Get Lambda endpoint from environment variable
    const lambdaEndpoint = process.env.NEXT_PUBLIC_PRESIGNED_URL_ENDPOINT;
    if (!lambdaEndpoint) {
      return res.status(500).json({ error: 'Presigned URL endpoint not configured' });
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
    return res.status(200).json({
      uploadUrl: data.uploadUrl,
      s3Key: data.s3Key
    });
  } catch (error: any) {
    console.error('Error generating upload URL:', error);
    return res.status(500).json({ 
      error: error.message || 'An unexpected error occurred'
    });
  }
} 