# PowerShell script for packaging Lambda function on Windows

# Create package directory
Write-Host "Creating package directory..." -ForegroundColor Green
New-Item -ItemType Directory -Path "package" -Force | Out-Null

# Create virtual environment
Write-Host "Creating virtual environment..." -ForegroundColor Green
python -m venv venv
./venv/Scripts/Activate.ps1

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
pip install -r requirements.txt -t package/

# Copy Lambda function files
Write-Host "Copying Lambda function files..." -ForegroundColor Green
Copy-Item -Path "lambda_function.py" -Destination "package/"
Copy-Item -Path "pdf_processor.py" -Destination "package/"
Copy-Item -Path "presigned_url_generator.py" -Destination "package/"

# Navigate to package directory
Set-Location package

# Create ZIP file
Write-Host "Creating deployment package (ZIP)..." -ForegroundColor Green
Compress-Archive -Path * -DestinationPath "../lambda_deployment_package.zip" -Force

# Return to original directory
Set-Location ..

# Deactivate virtual environment
deactivate

Write-Host "Package created successfully: lambda_deployment_package.zip" -ForegroundColor Green
Write-Host "Upload this ZIP file to AWS Lambda console or use AWS CLI to deploy" -ForegroundColor Yellow

Write-Host "Environment variables to set in Lambda:" -ForegroundColor Cyan
Write-Host "OPENAI_API_KEY - Your OpenAI API key" -ForegroundColor Cyan
Write-Host "S3_BUCKET - S3 bucket name for document storage" -ForegroundColor Cyan
Write-Host "DOCUMENTS_TABLE - DynamoDB table for documents (default: documents)" -ForegroundColor Cyan
Write-Host "COLLECTIONS_TABLE - DynamoDB table for collections (default: collections)" -ForegroundColor Cyan
Write-Host "DOC_COLLECTIONS_TABLE - DynamoDB table for document-collection mappings (default: documentCollections)" -ForegroundColor Cyan 