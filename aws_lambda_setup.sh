#!/bin/bash

# AWS Lambda setup script for document AI agent
# This script helps set up the Python environment and create the deployment package

# Set variables
LAMBDA_NAME="document-ai-agent"
RUNTIME="python3.9"
HANDLER="lambda_function.lambda_handler"
OUTPUT_DIR="./lambda_package"
ZIP_FILE="lambda_function.zip"

echo "Setting up AWS Lambda deployment package for $LAMBDA_NAME"

# Create output directory
mkdir -p $OUTPUT_DIR
echo "Created output directory: $OUTPUT_DIR"

# Create virtual environment
python -m venv $OUTPUT_DIR/venv
echo "Created virtual environment"

# Activate virtual environment
source $OUTPUT_DIR/venv/bin/activate
echo "Activated virtual environment"

# Install dependencies
pip install -r requirements.txt
echo "Installed dependencies from requirements.txt"

# Create the package directory
mkdir -p $OUTPUT_DIR/package
echo "Created package directory: $OUTPUT_DIR/package"

# Copy Lambda function to package directory
cp lambda_function.py $OUTPUT_DIR/package/
echo "Copied lambda_function.py to package directory"

# Install dependencies to package directory
pip install -r requirements.txt -t $OUTPUT_DIR/package/
echo "Installed dependencies to package directory"

# Create zip file
cd $OUTPUT_DIR/package
zip -r ../$ZIP_FILE .
cd ../..
echo "Created deployment package: $OUTPUT_DIR/$ZIP_FILE"

# Instructions for deployment
echo ""
echo "=========== DEPLOYMENT INSTRUCTIONS ==========="
echo "To deploy this Lambda function to AWS, follow these steps:"
echo ""
echo "1. Upload the deployment package to AWS Lambda:"
echo "   aws lambda create-function \\"
echo "     --function-name $LAMBDA_NAME \\"
echo "     --runtime $RUNTIME \\"
echo "     --handler $HANDLER \\"
echo "     --role YOUR_LAMBDA_ROLE_ARN \\"
echo "     --zip-file fileb://$OUTPUT_DIR/$ZIP_FILE"
echo ""
echo "2. Or update an existing function:"
echo "   aws lambda update-function-code \\"
echo "     --function-name $LAMBDA_NAME \\"
echo "     --zip-file fileb://$OUTPUT_DIR/$ZIP_FILE"
echo ""
echo "3. Configure environment variables in AWS Console or CLI:"
echo "   - OPENAI_API_KEY: Your OpenAI API key"
echo "   - S3_BUCKET_NAME: Your S3 bucket name for documents"
echo "   - DOCUMENTS_TABLE: DynamoDB table for documents (default: documents)"
echo "   - COLLECTIONS_TABLE: DynamoDB table for collections (default: collections)"
echo "   - DOC_COLLECTIONS_TABLE: DynamoDB table for document-collection relations (default: documentCollections)"
echo ""
echo "4. Set up API Gateway to expose this Lambda function"
echo "================================================"

# Deactivate virtual environment
deactivate
echo "Deactivated virtual environment"

echo "Setup completed successfully!" 