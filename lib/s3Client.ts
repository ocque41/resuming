import { S3Client } from '@aws-sdk/client-s3';
import { logger } from './logger';

let s3Client: S3Client | null = null;

/**
 * Get or create the S3 client
 * @returns The S3 client instance
 */
export function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  // Check for required environment variables
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables.');
  }

  logger.info('Initializing S3 client...');
  
  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
  
  return s3Client;
} 