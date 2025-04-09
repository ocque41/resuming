# AI Document Agent Testing Guide

This document outlines the steps to test the AI Document Agent functionality in the application.

## Prerequisites

Before testing, ensure that you have:

1. Set up all required environment variables (see `ENV_DOCUMENTATION.md`)
2. Started the development server (`npm run dev`)
3. Created a test user account for authentication

## Basic Testing

### 1. Testing the Agent Health

You can check the status of the agent API and its configuration by accessing:

```
http://localhost:3000/api/agent/health
```

This will show the current status of the agent configuration, including:
- Whether the Lambda endpoints are configured
- The current environment (development, production)
- If mock mode is enabled
- The status of AWS credentials

### 2. Test Script

Run the agent connection test script to verify the API is working correctly:

```bash
node scripts/test-agent-connection.js
```

This script will:
- Send a simple "Hello" message to the agent
- Check if the response is valid
- Verify if it's using a real agent or a mock response
- Report any configuration errors

### 3. Testing in the UI

To test the agent in the UI:

1. Navigate to the document processor page
2. Click on "Create" mode if you don't have a document
3. Type "Hello" in the chat input
4. The agent should respond with a greeting
5. If you see an error about the "AI Agent endpoint not configured", check your environment variables

## Testing Different Agent Modes

The AI Document Agent has three modes:

### 1. Create Mode

Test the create mode by:
1. Selecting "Create" in the document processor interface
2. Sending a message like: "Create a simple cover letter for a software developer role"
3. Verify the agent creates a document based on your request

### 2. Analyze Mode

Test the analyze mode by:
1. Uploading a sample document (PDF, DOCX, or TXT)
2. Selecting "Analyze" in the document processor interface
3. Sending a message like: "What are the main topics covered in this document?"
4. Verify the agent provides insights about the document content

### 3. Edit Mode

Test the edit mode by:
1. Uploading a sample document (PDF, DOCX, or TXT)
2. Selecting "Edit" in the document processor interface
3. Sending a message like: "Improve the language in the first paragraph"
4. Verify the agent suggests edits to the document

## Troubleshooting

### Lambda Endpoint Issues

If you encounter the "AI Agent endpoint not configured" error:

1. Check that both `AWS_LAMBDA_AI_AGENT_ENDPOINT` and `NEXT_PUBLIC_AWS_LAMBDA_AI_AGENT_ENDPOINT` are set correctly in your `.env.local` file
2. Verify the endpoint URL is accessible by making a direct request (e.g., with Postman)
3. Check if you have network access to the endpoint (no firewall blocking it)
4. Enable mock mode by setting `NEXT_PUBLIC_MOCK_BACKEND="true"` for testing without a Lambda endpoint

If you encounter a 403 Forbidden error:

1. This typically indicates that the Lambda function requires API Gateway authentication
2. Check if your API Gateway is configured with API key authentication:
   - If so, add the API key to your `.env.local` file as `AWS_LAMBDA_API_KEY="your-api-key"`
3. Check if your API Gateway uses IAM or token-based authentication:
   - If using tokens, add the token to your `.env.local` file as `AWS_LAMBDA_AUTH_TOKEN="your-token"`
   - If using IAM, ensure your AWS credentials have the correct IAM permissions
4. Verify with your API Gateway administrator what authentication method is required

### Authentication Issues

If the agent returns a 401 Unauthorized error:

1. Make sure you're logged in to the application
2. Check that your session is still valid
3. Verify that the authentication service is working

### Empty or Error Responses

If the agent returns empty or error responses:

1. Check the browser console for specific error messages
2. Verify that your AWS Lambda function is deployed and responding correctly
3. Check the CloudWatch logs for the Lambda function
4. Make sure the Lambda function has the necessary IAM permissions

## Next Steps

After successfully testing the basic functionality, proceed to:

1. Test document creation with various templates
2. Test document analysis with different document types
3. Test conversation context retention
4. Test error handling scenarios

## Reporting Issues

If you encounter issues that you cannot resolve, provide the following information:

1. The specific error message shown
2. The steps to reproduce the issue
3. The environment you're testing in (development, staging, production)
4. Any relevant logs from the browser console or server
5. The response from the `/api/agent/health` endpoint

This will help diagnose and fix the problem more quickly. 