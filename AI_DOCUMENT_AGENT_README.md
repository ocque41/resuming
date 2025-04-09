# AI Document Agent Implementation

This document provides instructions for deploying and using the AI document agent integration between your Next.js application and AWS services.

## Overview

The AI document agent allows users to:
- Upload documents to S3
- Save document metadata in the database
- Ask questions about documents
- Get AI-powered analysis, editing, and creation of documents

## Architecture

The implementation consists of the following components:

1. **Frontend**: React components in the Next.js application
2. **API Routes**: Next.js API routes that handle document operations
3. **Lambda Function**: AWS Lambda function that processes document content with OpenAI
4. **API Gateway**: AWS API Gateway that exposes the Lambda function
5. **S3 Bucket**: Storage for document files
6. **DynamoDB**: Storage for document metadata

## Deployment Steps

### 1. Set Up Lambda Function

1. Make sure you have the AWS CLI installed and configured with appropriate credentials
2. Run the deployment script to package the Lambda function:
   ```
   chmod +x aws_lambda_setup.sh
   ./aws_lambda_setup.sh
   ```
3. Follow the instructions in the script output to deploy the Lambda function to AWS

### 2. Configure API Gateway

1. Create a new API Gateway REST API in the AWS console
2. Import the provided `api_gateway_config.json` file
3. Replace `REGION` and `ACCOUNT_ID` placeholders with your actual values
4. Deploy the API to a new stage named "prod"
5. Note the Invoke URL of your API Gateway deployment

### 3. Update Environment Variables

Update your `.env.local` file with the following variables:
```
AWS_LAMBDA_AI_AGENT_ENDPOINT=https://your-api-gateway-url/prod/agent
AWS_LAMBDA_PRESIGNED_URL_ENDPOINT=https://your-api-gateway-url/prod/upload-url
```

### 4. Configure AWS Services

1. Set up the IAM role for the Lambda function with the required permissions (refer to the checklist)
2. Create the necessary DynamoDB tables for document storage
3. Set up S3 bucket for document storage with appropriate CORS configuration

## Usage

Once deployed, the AI Document Agent can be used in the application:

1. **Uploading Documents**:
   - Use the `FileUploader` component to upload documents to S3
   - The document metadata will be saved in the database

2. **Interacting with Documents**:
   - Navigate to the `enhance` page to interact with documents
   - Select a document from the dropdown menu
   - Ask questions or give instructions to the AI agent

3. **Creating New Documents**:
   - Begin a query with "Create" to have the AI agent help with document creation
   - Follow the agent's guidance to create the document

4. **Editing Documents**:
   - Select an existing document
   - Ask the agent to edit or improve specific aspects of the document
   - The agent will provide suggestions and help implement changes

## Troubleshooting

If you encounter issues:

1. **API Gateway CORS Issues**:
   - Ensure the API Gateway has CORS properly configured
   - Check the integration response headers

2. **Lambda Function Errors**:
   - Check CloudWatch logs for detailed error messages
   - Ensure all environment variables are properly set

3. **S3 Access Issues**:
   - Verify the Lambda function has appropriate permissions to access S3
   - Check CORS configuration on the S3 bucket

4. **Next.js API Route Errors**:
   - Check server logs for detailed error messages
   - Verify environment variables are properly set

## Development and Testing

For local development and testing:

1. Set `NEXT_PUBLIC_MOCK_BACKEND=true` in your `.env.local` file to use mock responses
2. Use the test environment when making changes to ensure they work as expected
3. When ready to switch to the live Lambda function, set `NEXT_PUBLIC_MOCK_BACKEND=false`

## Monitoring

Monitor the performance and usage of your AI Document Agent:

1. Set up CloudWatch Alarms for Lambda errors and duration
2. Monitor API Gateway request and error rates
3. Track S3 usage and costs
4. Set up budget alerts to avoid unexpected costs

## Security Considerations

1. Ensure proper authentication is implemented for all requests
2. Use the minimum necessary permissions for the Lambda IAM role
3. Consider encrypting sensitive data at rest in S3 and DynamoDB
4. Regularly review and update permissions as needed 