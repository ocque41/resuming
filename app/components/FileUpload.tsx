"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from './ui/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onFileUploaded?: (fileInfo: {
    fileId: string;
    fileKey: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }) => void;
  acceptedFileTypes?: Record<string, string[]>;
  maxSize?: number;
}

export function FileUpload({
  onFileUploaded,
  acceptedFileTypes = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt']
  },
  maxSize = 10 * 1024 * 1024, // 10MB
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setSelectedFile(file);
    setUploadError(null);
    
    try {
      await uploadFile(file);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Something went wrong during the upload',
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    maxSize,
    multiple: false,
  });

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Step 1: Request a pre-signed URL
      const urlResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });
      
      if (!urlResponse.ok) {
        const error = await urlResponse.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }
      
      const { uploadUrl, fileId, fileKey } = await urlResponse.json();
      
      // Step 2: Upload the file directly to S3 using the pre-signed URL
      // Create a simulated upload with progress
      const xhr = new XMLHttpRequest();
      
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);
      
      // Set up progress tracking
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };
      
      // Set up completion handler
      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error occurred during upload'));
        xhr.onabort = () => reject(new Error('Upload was aborted'));
      });
      
      // Start the upload
      xhr.send(file);
      
      // Wait for the upload to complete
      await uploadPromise;
      
      // Step 3: Notify parent component about the successful upload
      if (onFileUploaded) {
        onFileUploaded({
          fileId,
          fileKey,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        });
      }
      
      toast({
        title: 'File uploaded',
        description: `${file.name} was successfully uploaded`,
      });
      
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetry = () => {
    if (selectedFile) {
      uploadFile(selectedFile).catch((error) => {
        console.error('Retry upload error:', error);
        setUploadError(error instanceof Error ? error.message : 'Retry upload failed');
      });
    }
  };

  return (
    <div className="w-full">
      {!isUploading && !selectedFile && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}`}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-600 text-center">
            {isDragActive 
              ? 'Drop the file here...' 
              : 'Drag & drop a file here, or click to select'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            PDF, DOCX or TXT (max {maxSize / (1024 * 1024)}MB)
          </p>
          
          {fileRejections.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                <span>
                  {fileRejections[0].errors[0].code === 'file-too-large'
                    ? `File is too large. Max size is ${maxSize / (1024 * 1024)}MB`
                    : 'Unsupported file type. Please use PDF, DOCX, or TXT files.'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {selectedFile && !isUploading && !uploadError && (
        <div className="mt-4 p-4 border rounded-lg">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-primary mr-3" />
            <div className="flex-1">
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedFile(null)}
            >
              Change
            </Button>
          </div>
        </div>
      )}
      
      {isUploading && (
        <div className="mt-4">
          <div className="flex items-center mb-2">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Uploading...</span>
            <span className="text-sm ml-auto">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}
      
      {uploadError && (
        <div className="mt-4 p-4 border border-red-300 bg-red-50 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Upload failed</p>
              <p className="text-xs text-red-700 mt-1">{uploadError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3" 
                onClick={handleRetry}
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 