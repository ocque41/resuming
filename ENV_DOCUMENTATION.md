# Environment Variables Documentation

This document outlines the environment variables required for the AI Document Agent application.

## Core Environment Variables

### AWS Lambda Configuration

These variables are required for connecting to AWS Lambda functions:

```
# AWS Lambda Configuration for AI Agent
AWS_LAMBDA_AI_AGENT_ENDPOINT="https://api.resuming.ai/agent"
NEXT_PUBLIC_AWS_LAMBDA_AI_AGENT_ENDPOINT="https://api.resuming.ai/agent"
AWS_LAMBDA_PRESIGNED_URL_ENDPOINT="https://api.resuming.ai/upload-url"
NEXT_PUBLIC_AWS_LAMBDA_PRESIGNED_URL_ENDPOINT="https://api.resuming.ai/upload-url"

# API Gateway Authentication (required if your API Gateway uses API keys)
AWS_LAMBDA_API_KEY="your-api-gateway-key"
API_GATEWAY_KEY="your-api-gateway-key"  # Alternative name

# Token-based Authentication (required if your API Gateway uses token auth)
AWS_LAMBDA_AUTH_TOKEN="your-authorization-token"
```

> **Important:** If your AWS API Gateway is configured with API key or token-based authentication, you must provide the corresponding key or token. The 403 Forbidden error typically indicates missing or invalid authentication.

### AWS S3 Configuration

These variables are required for S3 bucket access:

```
AWS_REGION=eu-north-1
AWS_S3_BUCKET_NAME=documents--resuming17
S3_BUCKET_NAME=documents--resuming17
AWS_S3_ENDPOINT=https://s3.eu-north-1.amazonaws.com
AWS_S3_FORCE_PATH_STYLE=false
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

### Authentication Configuration

```
AUTH_SECRET="your-auth-secret-at-least-32-chars"
NEXTAUTH_SECRET="your-nextauth-secret-key"
```

### OpenAI Configuration

```
OPENAI_API_KEY="your-openai-api-key"
OPENAI_ORGANIZATION_ID="your-organization-id" # Optional
```

## Development Mode Configuration

For local development, you can enable mock mode:

```
NEXT_PUBLIC_LOCAL_MODE="true"
NEXT_PUBLIC_MOCK_BACKEND="true"
NEXT_PUBLIC_FORCE_MOCK="true"
NEXT_PUBLIC_OFFLINE_MODE="true"
```

## Production Configuration

For production environments:

```
NODE_ENV="production"
NEXT_PUBLIC_BASE_URL="https://your-domain.com"
BASE_URL="https://your-domain.com"
```

## Troubleshooting

If you encounter the "AI Agent endpoint not configured" error:

1. Verify that both `AWS_LAMBDA_AI_AGENT_ENDPOINT` and `NEXT_PUBLIC_AWS_LAMBDA_AI_AGENT_ENDPOINT` are set
2. Check that the endpoint URL is correct and accessible
3. Ensure AWS credentials have proper permissions to invoke the Lambda function
4. For local development, enable mock mode to use a fallback response

## Adding New Variables

When adding new environment variables:

1. Document them in this file
2. Update `.env.example` with the new variables
3. Update deployment configuration in your CI/CD pipeline
4. If they're publicly accessible (NEXT_PUBLIC_*), consider security implications 