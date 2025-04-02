import json
import os
import logging
import boto3
from boto3.dynamodb.conditions import Key
import base64
import uuid
import requests
from datetime import datetime

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS services
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Environment variables
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME')
DOCUMENTS_TABLE = os.environ.get('DOCUMENTS_TABLE', 'documents')
COLLECTIONS_TABLE = os.environ.get('COLLECTIONS_TABLE', 'collections')
DOC_COLLECTIONS_TABLE = os.environ.get('DOC_COLLECTIONS_TABLE', 'documentCollections')

# Initialize DynamoDB tables
documents_table = dynamodb.Table(DOCUMENTS_TABLE)
collections_table = dynamodb.Table(COLLECTIONS_TABLE)
doc_collections_table = dynamodb.Table(DOC_COLLECTIONS_TABLE)

def lambda_handler(event, context):
    """
    Main handler for AWS Lambda
    """
    logger.info("Processing request with event: %s", event)
    
    try:
        # Parse request body
        if isinstance(event, str):
            body = json.loads(event)
        elif isinstance(event, dict) and 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
        
        # Extract parameters
        message = body.get('message', '')
        document_id = body.get('documentId')
        s3_key = body.get('s3Key')
        user_id = body.get('userId')
        mode = body.get('mode', 'edit')
        stream = body.get('stream', False)
        context_info = body.get('context', {})
        
        # Validate required fields
        if not message:
            return create_response(400, {
                'error': 'Missing required parameter: message'
            })
        
        if not user_id:
            return create_response(400, {
                'error': 'Missing required parameter: userId'
            })
        
        # Get document content if document_id or s3_key is provided
        document_content = None
        if document_id:
            document = get_document_by_id(document_id)
            if document:
                s3_key = document.get('s3Key')
        
        if s3_key:
            document_content = get_document_content(s3_key)
        
        # Process with OpenAI
        response = process_with_openai(
            message=message,
            document_content=document_content,
            user_id=user_id,
            mode=mode,
            context_info=context_info
        )
        
        # Return the response
        return create_response(200, {
            'response': response
        })
    except Exception as e:
        logger.error("Error processing request: %s", str(e), exc_info=True)
        return create_response(500, {
            'error': f'Internal server error: {str(e)}'
        })

def get_document_by_id(document_id):
    """
    Retrieve document metadata from DynamoDB
    """
    try:
        response = documents_table.get_item(
            Key={'id': document_id}
        )
        return response.get('Item')
    except Exception as e:
        logger.error("Error retrieving document by ID: %s", str(e), exc_info=True)
        return None

def get_document_content(s3_key):
    """
    Retrieve document content from S3
    """
    try:
        response = s3.get_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key
        )
        
        content = response['Body'].read()
        
        # Handle different document types
        if s3_key.lower().endswith('.pdf'):
            # For PDFs, you would typically use a PDF parser here
            # This is a placeholder - in a real implementation you would 
            # use a library like PyPDF2 or pdfplumber
            return extract_text_from_pdf(content)
        elif s3_key.lower().endswith('.docx'):
            # For DOCX, you would use a Word document parser
            # This is a placeholder - in a real implementation you would
            # use a library like python-docx
            return extract_text_from_docx(content)
        elif s3_key.lower().endswith('.txt'):
            # Plain text is straightforward
            return content.decode('utf-8')
        else:
            # Default fallback
            return content.decode('utf-8')
    except Exception as e:
        logger.error("Error retrieving document content from S3: %s", str(e), exc_info=True)
        return None

def extract_text_from_pdf(pdf_content):
    """
    Placeholder for PDF text extraction
    In a production environment, use a proper PDF parser like PyPDF2 or pdfplumber
    """
    return "This is placeholder text for a PDF document. In a real implementation, this would contain the actual text extracted from the PDF."

def extract_text_from_docx(docx_content):
    """
    Placeholder for DOCX text extraction
    In a production environment, use a proper DOCX parser like python-docx
    """
    return "This is placeholder text for a DOCX document. In a real implementation, this would contain the actual text extracted from the Word document."

def process_with_openai(message, document_content, user_id, mode, context_info):
    """
    Process the request using OpenAI API
    """
    if not OPENAI_API_KEY:
        logger.error("OpenAI API key not configured")
        return "The AI agent is not properly configured. Please contact support."
    
    try:
        # Set up the API request
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        }
        
        # Create system message based on mode
        system_message = get_system_message_for_mode(mode, context_info)
        
        # Create messages array
        messages = [
            {"role": "system", "content": system_message}
        ]
        
        # Add document content if available
        if document_content:
            messages.append({
                "role": "system", 
                "content": f"Document content: {document_content[:4000]}..."
            })
        
        # Add user message
        messages.append({
            "role": "user",
            "content": message
        })
        
        # Make API request to OpenAI
        data = {
            "model": "gpt-4",  # Or another appropriate model
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 1500
        }
        
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=data
        )
        
        # Process the response
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content']
        else:
            logger.error("OpenAI API error: %s", response.text)
            return f"Error communicating with AI service: {response.status_code}"
    except Exception as e:
        logger.error("Error processing with OpenAI: %s", str(e), exc_info=True)
        return f"Sorry, I encountered an error while processing your request: {str(e)}"

def get_system_message_for_mode(mode, context_info):
    """
    Get appropriate system message based on the mode
    """
    document_name = context_info.get('documentName', 'the document')
    
    if mode == 'edit':
        return (
            f"You are an AI document editing assistant. You are reviewing and helping improve {document_name}. "
            "Provide helpful, constructive feedback and suggestions for improvement. "
            "Focus on grammar, clarity, structure, and overall quality. "
            "Your goal is to help the user refine their document to be more effective and professional."
        )
    elif mode == 'create':
        return (
            "You are an AI document creation assistant. Help the user create a new document from scratch. "
            "Guide them through the process, asking clarifying questions if needed. "
            "Provide structured, well-formatted content based on the user's requirements. "
            "Your goal is to help the user create a professional, effective document."
        )
    elif mode == 'analyze':
        return (
            f"You are an AI document analysis assistant. You are analyzing {document_name}. "
            "Provide a thorough review of the document, highlighting strengths and areas for improvement. "
            "Analyze the structure, clarity, effectiveness, and overall quality. "
            "Your goal is to give the user a comprehensive understanding of their document's quality and potential improvements."
        )
    else:
        # Default system message
        return (
            "You are an AI document assistant. Help the user with their document needs, whether it's creating, editing, or analyzing content. "
            "Provide helpful, professional guidance and feedback. "
            "Your goal is to make the user's document as effective as possible."
        )

def create_response(status_code, body):
    """
    Create a properly formatted Lambda response
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        },
        'body': json.dumps(body)
    } 