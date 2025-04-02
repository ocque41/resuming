import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { logger } from '@/lib/logger';

/**
 * Generate a presigned URL for direct S3 file upload
 * 
 * Required parameters:
 * - fileName: string (name of the file to upload)
 * - fileType: string (MIME type of the file)
 * 
 * Optional parameters:
 * - metadata: object (additional metadata for the file)
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    // Get request body
    const body = await req.json();
    const { fileName, fileType, metadata = {} } = body;

    // Validate request
    if (!fileName) {
      return NextResponse.json({ 
        error: 'File name is required' 
      }, { status: 400 });
    }

    if (!fileType) {
      return NextResponse.json({ 
        error: 'File type is required' 
      }, { status: 400 });
    }

    // Get Lambda endpoint from environment variable
    const lambdaEndpoint = process.env.NEXT_PUBLIC_AWS_LAMBDA_PRESIGNED_URL_ENDPOINT;
    if (!lambdaEndpoint) {
      logger.error('Presigned URL endpoint not configured', new Error('Missing Lambda endpoint configuration'));
      return NextResponse.json({ 
        error: 'Presigned URL endpoint not configured' 
      }, { status: 500 });
    }

    logger.info('Generating presigned URL', {
      userId: session.user.id,
      fileName,
      fileType
    });

    // Call AWS Lambda function
    const response = await fetch(lambdaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        fileType,
        userId: session.user.id,
        metadata: {
          ...metadata,
          originalName: fileName,
          uploadedBy: session.user.email || session.user.id,
          uploadedAt: new Date().toISOString()
        }
      }),
    });

    // Handle response
    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If we can't parse the JSON, just use the status code message
      }
      
      logger.error('Error from presigned URL Lambda', errorMessage, {
        httpStatus: response.status,
        httpStatusText: response.statusText
      });
      
      throw new Error(errorMessage);
    }

    // Parse and return response
    const data = await response.json();
    
    if (!data.uploadUrl || !data.s3Key) {
      logger.error('Invalid response from presigned URL Lambda', new Error('Missing required fields'), { data });
      throw new Error('Invalid response from Lambda function');
    }
    
    logger.info('Successfully generated presigned URL', {
      userId: session.user.id,
      s3Key: data.s3Key
    });
    
    return NextResponse.json({
      uploadUrl: data.uploadUrl,
      s3Key: data.s3Key,
      expiresIn: data.expiresIn || 300, // 5 minutes default if not provided
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error generating upload URL', error, {
      details: errorMessage
    });
    
    return NextResponse.json({ 
      error: error.message || 'An unexpected error occurred while generating the upload URL'
    }, { status: 500 });
  }
} 