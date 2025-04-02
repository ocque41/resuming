#!/bin/bash

# Bash script for packaging Lambda function on Linux/macOS

# Create package directory
echo -e "\033[0;32mCreating package directory...\033[0m"
mkdir -p package

# Create virtual environment
echo -e "\033[0;32mCreating virtual environment...\033[0m"
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo -e "\033[0;32mInstalling dependencies...\033[0m"
pip install -r requirements.txt -t package/

# Copy Lambda function files
echo -e "\033[0;32mCopying Lambda function files...\033[0m"
cp lambda_function.py package/
cp pdf_processor.py package/
cp presigned_url_generator.py package/

# Navigate to package directory
cd package

# Create ZIP file
echo -e "\033[0;32mCreating deployment package (ZIP)...\033[0m"
zip -r ../lambda_deployment_package.zip .

# Return to original directory
cd ..

# Deactivate virtual environment
deactivate

echo -e "\033[0;32mPackage created successfully: lambda_deployment_package.zip\033[0m"
echo -e "\033[0;33mUpload this ZIP file to AWS Lambda console or use AWS CLI to deploy\033[0m"

echo -e "\033[0;36mEnvironment variables to set in Lambda:\033[0m"
echo -e "\033[0;36mOPENAI_API_KEY - Your OpenAI API key\033[0m"
echo -e "\033[0;36mS3_BUCKET - S3 bucket name for document storage\033[0m"
echo -e "\033[0;36mDOCUMENTS_TABLE - DynamoDB table for documents (default: documents)\033[0m"
echo -e "\033[0;36mCOLLECTIONS_TABLE - DynamoDB table for collections (default: collections)\033[0m"
echo -e "\033[0;36mDOC_COLLECTIONS_TABLE - DynamoDB table for document-collection mappings (default: documentCollections)\033[0m" 