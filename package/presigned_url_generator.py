import json
import os
import boto3
import uuid
from datetime import datetime, timedelta

# Initialize S3 client
s3 = boto3.client('s3')

# Get S3 bucket name from environment variables
S3_BUCKET = os.environ.get('S3_BUCKET')

# Get upload folder prefix from environment variables (optional)
UPLOAD_PREFIX = os.environ.get('UPLOAD_PREFIX', 'user-uploads/')

def lambda_handler(event, context):
    """
    Lambda handler function for generating presigned URLs for S3 direct uploads.
    """
    # Set up CORS headers for responses
    headers = {
        'Access-Control-Allow-Origin': '*',  # Or your specific domain
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Content-Type': 'application/json'
    }
    
    # Handle preflight requests
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'Preflight request successful'})
        }
    
    # Parse the request body
    try:
        if isinstance(event, dict) and 'body' in event:
            # API Gateway format
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        else:
            # Direct invocation format
            body = event
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    
    # Extract parameters from the request
    file_name = body.get('fileName')
    file_type = body.get('fileType', 'application/octet-stream')
    
    # Validate required parameters
    if not file_name:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'fileName is required'})
        }
    
    try:
        # Generate a unique S3 key for the file
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        
        # Extract the file extension
        file_extension = os.path.splitext(file_name)[1]
        if not file_extension:
            file_extension = '.bin'  # Default extension if none is provided
        
        # Create the S3 key (path)
        s3_key = f"{UPLOAD_PREFIX}{timestamp}_{unique_id}{file_extension}"
        
        # Generate a presigned URL for uploading
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': S3_BUCKET,
                'Key': s3_key,
                'ContentType': file_type
            },
            ExpiresIn=300  # URL expires in 5 minutes
        )
        
        # Return the presigned URL and S3 key to the client
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'uploadUrl': presigned_url,
                's3Key': s3_key
            })
        }
    except Exception as e:
        print(f"Error generating presigned URL: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': f'Failed to generate upload URL: {str(e)}'})
        } 