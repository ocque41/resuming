import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  S3ServiceException 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client } from './s3Client';
import { Readable } from 'stream';
import { logger } from './logger';

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'cv-optimizer';
const EXPIRATION_SECONDS = 3600; // 1 hour

/**
 * Convert a readable stream to a buffer
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Upload a file buffer to S3
 * @param buffer - The file buffer to upload
 * @param fileName - The name of the file with path (e.g., 'pdfs/example.pdf')
 * @returns The S3 object key (path in the bucket)
 */
export async function uploadFileToS3(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const s3Client = getS3Client();
    const key = fileName.startsWith('/') ? fileName.substring(1) : fileName;
    
    logger.info(`Uploading file to S3: ${key}`);
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: determineContentType(fileName)
    });
    
    await s3Client.send(command);
    logger.info(`File uploaded to S3: ${key}`);
    
    return key;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error uploading to S3: ${errorMessage}`);
    throw new Error(`Failed to upload file to S3: ${errorMessage}`);
  }
}

/**
 * Get a file from S3
 * @param key - The S3 object key (path in the bucket)
 * @returns The file buffer
 */
export async function getFileFromS3(key: string): Promise<Buffer> {
  try {
    const s3Client = getS3Client();
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    
    logger.info(`Retrieving file from S3: ${normalizedKey}`);
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: normalizedKey
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response body from S3');
    }
    
    const stream = response.Body as Readable;
    const buffer = await streamToBuffer(stream);
    
    logger.info(`File retrieved from S3: ${normalizedKey}`);
    return buffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error retrieving from S3: ${errorMessage}`);
    throw new Error(`Failed to retrieve file from S3: ${errorMessage}`);
  }
}

/**
 * Delete a file from S3
 * @param key - The S3 object key (path in the bucket)
 * @returns A boolean indicating success
 */
export async function deleteFileFromS3(key: string): Promise<boolean> {
  try {
    const s3Client = getS3Client();
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    
    logger.info(`Deleting file from S3: ${normalizedKey}`);
    
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: normalizedKey
    });
    
    await s3Client.send(command);
    
    logger.info(`File deleted from S3: ${normalizedKey}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error deleting from S3: ${errorMessage}`);
    throw new Error(`Failed to delete file from S3: ${errorMessage}`);
  }
}

/**
 * Get a signed URL for a file in S3
 * @param key - The S3 object key (path in the bucket)
 * @param expirationSeconds - The number of seconds until the URL expires (default: 1 hour)
 * @returns A signed URL for the file
 */
export async function getSignedS3Url(key: string, expirationSeconds = EXPIRATION_SECONDS): Promise<string> {
  try {
    const s3Client = getS3Client();
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    
    logger.info(`Generating signed URL for S3 file: ${normalizedKey}`);
    
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: normalizedKey
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn: expirationSeconds });
    
    logger.info(`Generated signed URL for S3 file: ${normalizedKey}`);
    return url;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error generating signed URL: ${errorMessage}`);
    throw new Error(`Failed to generate signed URL: ${errorMessage}`);
  }
}

/**
 * Determine the content type based on the file name
 */
function determineContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'txt':
      return 'text/plain';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
} 