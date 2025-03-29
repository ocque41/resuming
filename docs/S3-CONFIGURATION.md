# S3 Storage Configuration

This document provides instructions for setting up and configuring an AWS S3 bucket for file storage in the application.

## Prerequisites

- An AWS account with permissions to create and manage S3 buckets
- AWS Access Key ID and Secret Access Key with S3 permissions

## Setup Instructions

### 1. Create an S3 Bucket

1. Log in to the AWS Management Console and navigate to the S3 service
2. Click "Create bucket"
3. Enter a globally unique bucket name (e.g., `your-app-files-bucket`)
4. Select the AWS Region where you want to create the bucket
5. Configure bucket settings:
   - Enable ACLs if you need fine-grained access control
   - Block all public access (recommended for security)
   - Enable bucket versioning (optional, for file version history)
   - Enable server-side encryption (recommended for security)
6. Create the bucket

### 2. Configure CORS (Cross-Origin Resource Sharing)

If your application needs to make direct uploads from the browser:

1. Navigate to your bucket in the AWS console
2. Go to the "Permissions" tab
3. Scroll down to the "Cross-origin resource sharing (CORS)" section
4. Click "Edit" and add a CORS configuration like:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["https://your-app-domain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Replace `https://your-app-domain.com` with your application's domain or use `*` for development.

### 3. Create an IAM User with S3 Access

1. Navigate to the IAM service in the AWS console
2. Click "Users" and then "Add user"
3. Enter a username (e.g., `app-s3-user`)
4. Select "Programmatic access"
5. Click "Next: Permissions"
6. Create a policy or use an existing one with the following permissions:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`
   - `s3:ListBucket`
7. Limit the policy to the specific bucket you created
8. Complete the user creation process
9. Save the Access Key ID and Secret Access Key (displayed only once)

### 4. Configure Environment Variables

Add these environment variables to your application:

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=your-bucket-name
```

## Security Considerations

- Never commit AWS credentials to your code repository
- Use IAM policies with the principle of least privilege
- Consider using IAM roles and temporary credentials for enhanced security
- Enable server-side encryption for sensitive files
- Regularly rotate access keys
- Implement file size limits to prevent abuse
- Set up proper bucket logging and monitoring

## Testing S3 Configuration

To test your S3 configuration, try uploading a file through your application and verify that:

1. The file is stored in your S3 bucket
2. The file can be accessed via the application
3. Files are properly organized in the correct folders (pdfs, docx, etc.)

## Troubleshooting

Common issues:

- **Access Denied errors**: Check IAM permissions and bucket policies
- **CORS errors**: Verify your CORS configuration
- **Region issues**: Ensure the region in your code matches the bucket's region
- **Path problems**: Check that path separators are consistent (use forward slashes) 