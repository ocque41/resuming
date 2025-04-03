import { NextResponse } from 'next/server';

/**
 * Health check endpoint for the AI Document Agent API
 * 
 * This endpoint returns the status of the AI Document Agent API
 * and checks if the required environment variables are properly configured.
 */
export async function GET() {
  // Check required environment variables
  const lambdaEndpoint = process.env.NEXT_PUBLIC_AWS_LAMBDA_AI_AGENT_ENDPOINT || 
                         process.env.AWS_LAMBDA_AI_AGENT_ENDPOINT;
  
  const uploadEndpoint = process.env.NEXT_PUBLIC_AWS_LAMBDA_PRESIGNED_URL_ENDPOINT || 
                         process.env.AWS_LAMBDA_PRESIGNED_URL_ENDPOINT;
  
  // Check AWS credentials
  const hasAwsCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
  
  // Determine environment
  const environment = process.env.NODE_ENV || 'development';
  const mockMode = process.env.NEXT_PUBLIC_MOCK_BACKEND === 'true';
  
  // Check if Lambda endpoints are configured
  const isLambdaConfigured = !!lambdaEndpoint;
  const isUploadConfigured = !!uploadEndpoint;
  
  // Prepare response
  const status = {
    service: 'AI Document Agent API',
    status: 'ok',
    environment,
    mockMode,
    configuration: {
      agent: isLambdaConfigured ? 'configured' : 'missing',
      upload: isUploadConfigured ? 'configured' : 'missing',
      awsCredentials: hasAwsCredentials ? 'configured' : 'missing',
    },
    timestamp: new Date().toISOString(),
  };
  
  // Determine overall status
  if (!isLambdaConfigured || !isUploadConfigured) {
    status.status = 'degraded';
  }
  
  if (!hasAwsCredentials && environment === 'production') {
    status.status = 'degraded';
  }
  
  // Return the health status
  return NextResponse.json(status);
} 