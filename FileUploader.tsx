import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploaderProps {
  onUploadComplete: (s3Key: string) => void;
  allowedFileTypes?: string[];
  maxSizeMB?: number;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onUploadComplete,
  allowedFileTypes = ['.pdf', '.doc', '.docx', '.txt'],
  maxSizeMB = 10
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    // Validate file size
    if (file.size > maxSizeBytes) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    // Validate file type
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!allowedFileTypes.includes(fileExtension)) {
      setError(`Unsupported file type. Allowed types: ${allowedFileTypes.join(', ')}`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      // Step 1: Get a presigned URL from our API
      const presignedUrlResponse = await fetch('/api/generate-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!presignedUrlResponse.ok) {
        const errorData = await presignedUrlResponse.json();
        throw new Error(errorData.error || 'Failed to get upload URL');
      }
      
      const { uploadUrl, s3Key } = await presignedUrlResponse.json();

      // Step 2: Upload the file directly to S3 using the presigned URL
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      
      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };

      // Handle upload completion
      xhr.onload = () => {
        if (xhr.status === 200) {
          setUploading(false);
          setUploadProgress(100);
          onUploadComplete(s3Key);
        } else {
          throw new Error(`Upload failed with status ${xhr.status}`);
        }
      };

      // Handle upload error
      xhr.onerror = () => {
        throw new Error('Upload failed');
      };

      // Start the upload
      xhr.send(file);
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(err.message || 'An error occurred during upload');
      setUploading(false);
    }
  }, [maxSizeBytes, allowedFileTypes, maxSizeMB, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: allowedFileTypes.reduce((acc, type) => {
      // Convert extension to MIME type (simplified)
      const mimeMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain'
      };
      
      const mime = mimeMap[type];
      if (mime) {
        acc[mime] = [type];
      }
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: maxSizeBytes,
    multiple: false,
    disabled: uploading
  });

  return (
    <div className="w-full">
      <div 
        {...getRootProps()} 
        className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div>
            <p className="mb-2">Uploading...</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="mt-2 text-sm text-gray-500">{uploadProgress}%</p>
          </div>
        ) : isDragActive ? (
          <p>Drop the file here...</p>
        ) : (
          <div>
            <p className="mb-1">Drag and drop a file here, or click to select</p>
            <p className="text-sm text-gray-500">
              Allowed types: {allowedFileTypes.join(', ')} (Max: {maxSizeMB}MB)
            </p>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-2 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUploader; 