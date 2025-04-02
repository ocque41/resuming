import json
import os
import boto3
import base64
from botocore.exceptions import ClientError
import openai

# Initialize AWS services
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Initialize OpenAI
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
openai.api_key = OPENAI_API_KEY

# Get DynamoDB table names from environment variables
DOCUMENTS_TABLE = os.environ.get('DOCUMENTS_TABLE', 'documents')
COLLECTIONS_TABLE = os.environ.get('COLLECTIONS_TABLE', 'collections')
DOC_COLLECTIONS_TABLE = os.environ.get('DOC_COLLECTIONS_TABLE', 'documentCollections')

# Initialize table references
documents_table = dynamodb.Table(DOCUMENTS_TABLE)
collections_table = dynamodb.Table(COLLECTIONS_TABLE)
doc_collections_table = dynamodb.Table(DOC_COLLECTIONS_TABLE)

# Get S3 bucket name from environment variables
S3_BUCKET = os.environ.get('S3_BUCKET')

# Import PDF processor module (if available in the deployment package)
try:
    from pdf_processor import extract_text_from_s3
except ImportError:
    # Define a basic fallback if the module is not available
    def extract_text_from_s3(bucket, key):
        print(f"Warning: pdf_processor module not available. Using fallback for {bucket}/{key}")
        return f"Content could not be extracted from {key}. Please ensure pdf_processor module is properly deployed."

def lambda_handler(event, context):
    """
    Main Lambda handler function for processing document requests.
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
    prompt = body.get('prompt')
    document_key = body.get('documentKey')
    document_id = body.get('documentId')
    
    # Validate required parameters
    if not prompt:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'Prompt is required'})
        }
    
    # Handle document retrieval if a document is specified
    document_content = None
    document_metadata = None
    
    if document_key:
        try:
            document_content = extract_text_from_s3(S3_BUCKET, document_key)
        except Exception as e:
            print(f"Error extracting document content: {str(e)}")
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': f'Failed to process document: {str(e)}'})
            }
    
    if document_id:
        try:
            response = documents_table.get_item(Key={'dc': document_id})
            document_metadata = response.get('Item')
        except ClientError as e:
            print(f"Error retrieving document metadata: {str(e)}")
    
    # Create the prompt for the OpenAI API
    system_message = """
    You are an AI assistant specialized in document analysis and information extraction.
    Provide concise, accurate responses based on the document content provided.
    If you don't know the answer, acknowledge it rather than making up information.
    """
    
    messages = [
        {"role": "system", "content": system_message}
    ]
    
    # Add document content to the context if available
    if document_content:
        messages.append({
            "role": "system", 
            "content": f"Here is the document content to analyze:\n\n{document_content}"
        })
    
    # Add document metadata if available
    if document_metadata:
        metadata_str = "Document metadata:\n"
        for key, value in document_metadata.items():
            if key not in ['dc']:  # Skip the primary key
                metadata_str += f"{key}: {value}\n"
        
        messages.append({"role": "system", "content": metadata_str})
    
    # Add user prompt
    messages.append({"role": "user", "content": prompt})
    
    # Call OpenAI API
    try:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured")
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.7,
            max_tokens=1500
        )
        
        ai_response = response.choices[0].message.content
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'response': ai_response})
        }
    except Exception as e:
        print(f"Error calling OpenAI API: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': f'AI processing error: {str(e)}'})
        } 