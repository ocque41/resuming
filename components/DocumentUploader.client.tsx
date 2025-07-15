"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Upload, CheckCircle, File, FileText, Settings } from 'lucide-react';

interface DocumentUploaderProps {
  onUploadComplete?: (fileId: string) => void;
  allowedTypes?: string[];
  maxSizeMB?: number;
  showPreview?: boolean;
}

export default function DocumentUploader({
  onUploadComplete,
  allowedTypes,
  maxSizeMB = 10,
  showPreview = true,
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Set default accepted file types if not provided
  const defaultAcceptedTypes = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
    'text/plain': ['.txt'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'application/rtf': ['.rtf'],
  };

  const getFileTypeAccept = () => {
    if (!allowedTypes || allowedTypes.length === 0) {
      return defaultAcceptedTypes;
    }
    
    return Object.fromEntries(
      Object.entries(defaultAcceptedTypes).filter(([_, extensions]) => 
        extensions.some(ext => allowedTypes.includes(ext.replace('.', '')))
      )
    );
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }
    
    setFiles(acceptedFiles);
    setError(null);
    setSuccess(null);
    
    // Create preview for image files
    if (showPreview && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, [maxSizeMB, showPreview]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getFileTypeAccept(),
    maxFiles: 1,
    multiple: false,
  });

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.includes('pdf')) return <File className="h-10 w-10 text-[#B4916C] mb-2" />;
    if (type.includes('word')) return <FileText className="h-10 w-10 text-[#B4916C] mb-2" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <Settings className="h-10 w-10 text-[#B4916C] mb-2" />;
    if (type.includes('presentation') || type.includes('powerpoint')) return <FileText className="h-10 w-10 text-[#B4916C] mb-2" />;
    if (type.includes('image')) return <FileText className="h-10 w-10 text-[#B4916C] mb-2" />;
    return <File className="h-10 w-10 text-[#B4916C] mb-2" />;
  };

  const getAcceptedFileTypes = () => {
    const acceptedTypes = Object.values(getFileTypeAccept()).flat();
    return acceptedTypes.map(type => type.replace('.', '').toUpperCase()).join(', ');
  };

  const uploadFile = async () => {
    if (files.length === 0) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('documentType', files[0].type);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.floor(Math.random() * 15);
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 500);

      // Actual upload
      const response = await fetch('/api/document/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const responseData = await response.json();
      setUploadProgress(100);
      setSuccess('Document uploaded successfully!');
      
      // Call the callback if provided
      if (onUploadComplete && responseData.fileId) {
        onUploadComplete(responseData.fileId);
      }
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setFiles([]);
        setSuccess(null);
        setUploadProgress(0);
        setPreview(null);
      }, 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border border-[#B4916C]/20 bg-black shadow-lg w-full">
      <CardContent className="p-6">
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-[#B4916C] bg-[#B4916C]/5' 
              : 'border-gray-600 hover:border-[#B4916C]/50 hover:bg-black/30'
          }`}
        >
          <input data-testid="file-input" {...getInputProps()} />
          
          <div className="flex flex-col items-center justify-center gap-2">
            {!files.length ? (
              <>
                <Upload className="h-10 w-10 text-[#B4916C] mb-2" />
                <p className="text-base font-medium text-white">
                  {isDragActive ? 'Drop your document here...' : 'Drag & drop your document here'}
                </p>
                <p className="text-sm text-gray-400">or click to browse files</p>
                <p className="text-xs text-gray-500 mt-2">Supported formats: {getAcceptedFileTypes()}</p>
              </>
            ) : (
              <>
                {getFileIcon(files[0])}
                <p className="text-base font-medium text-white">{files[0].name}</p>
                <p className="text-sm text-gray-400">
                  {(files[0].size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </>
            )}
          </div>
        </div>

        {preview && (
          <div className="mt-4 p-2 border border-gray-700 rounded-md">
            <img 
              src={preview} 
              alt="File preview" 
              className="mx-auto max-h-40 object-contain"
            />
          </div>
        )}

        {files.length > 0 && !uploading && !success && (
          <div className="mt-4 flex justify-end">
            <Button 
              onClick={() => {
                setFiles([]);
                setPreview(null);
              }} 
              variant="outline" 
              className="mr-2 border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={uploadFile} 
              className="bg-[#B4916C] hover:bg-[#A3815C] text-white"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </div>
        )}

        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-400">Uploading...</span>
              <span className="text-sm text-[#B4916C]">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {error && (
          <Alert className="mt-4 bg-red-950/30 border-red-800/30 text-red-400">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mt-4 bg-green-950/30 border-green-800/30 text-green-400">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 