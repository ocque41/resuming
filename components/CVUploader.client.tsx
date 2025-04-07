"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, Upload, CheckCircle, File, FileText, 
  BarChart2, Archive, PieChart
} from 'lucide-react';

// Maximum file size in bytes (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function CVUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle size validation
    if (rejectedFiles.length > 0) {
      const sizeError = rejectedFiles.some(file => 
        file.errors && file.errors.some((e: any) => e.code === 'file-too-large')
      );
      
      if (sizeError) {
        setError(`File size exceeds the 10MB limit`);
        return;
      }
    }
    
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      console.log('File selected:', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      // Set accepted file types
      const acceptedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      // Check if file type is acceptable 
      if (!file.type || !acceptedTypes.includes(file.type)) {
        // For files without a type, check extension
        const extension = file.name.split('.').pop()?.toLowerCase();
        const acceptableExtensions = ['pdf', 'doc', 'docx', 'txt'];
        
        if (!extension || !acceptableExtensions.includes(extension)) {
          setError(`Unsupported file type. Please upload PDF, DOC, DOCX, or TXT files.`);
          return;
        }
      }
      
      setFiles(acceptedFiles);
      setError(null);
      setSuccess(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_FILE_SIZE,
  });

  // Get file icon based on file type
  const getFileIcon = (file: File) => {
    const type = file.type.toLowerCase();
    
    if (type.includes('pdf')) return <File className="h-10 w-10 text-[#B4916C] mb-2" />;
    if (type.includes('word') || type.includes('document') || type.includes('rtf') || type.includes('text')) 
      return <FileText className="h-10 w-10 text-[#B4916C] mb-2" />;
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) 
      return <BarChart2 className="h-10 w-10 text-[#B4916C] mb-2" />;
    if (type.includes('image') || type.includes('jpg') || type.includes('jpeg') || type.includes('png')) 
      return <FileText className="h-10 w-10 text-[#B4916C] mb-2" />;
    if (type.includes('zip') || type.includes('archive') || type.includes('compressed')) 
      return <Archive className="h-10 w-10 text-[#B4916C] mb-2" />;
    if (type.includes('presentation') || type.includes('powerpoint')) 
      return <PieChart className="h-10 w-10 text-[#B4916C] mb-2" />;
    
    // Default icon for unknown types
    return <File className="h-10 w-10 text-[#B4916C] mb-2" />;
  };

  const uploadFile = async () => {
    if (files.length === 0) {
      setError('Please select a file first');
      return;
    }

    // Check file size
    if (files[0].size > MAX_FILE_SIZE) {
      setError(`File size exceeds the 10MB limit`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', files[0]);
    
    console.log('Starting upload for file:', files[0].name);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.floor(Math.random() * 15);
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 500);

      // Actual upload
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error('Failed to parse server response');
      }

      if (!response.ok) {
        console.error('Upload failed with status:', response.status, responseData);
        throw new Error(responseData?.error || `Upload failed with status: ${response.status}`);
      }

      console.log('Upload successful:', responseData);
      setUploadProgress(100);
      setSuccess('Document uploaded successfully!');
      
      // Reload the page after 2 seconds to show the new document
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  // Format file size to a human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <Card className="border border-[#222222] bg-[#111111] shadow-lg w-full rounded-xl overflow-hidden">
      <CardContent className="p-5">
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-200 ${
            isDragActive 
              ? 'border-[#B4916C] bg-[#050505]' 
              : 'border-[#333333] hover:border-[#B4916C] hover:bg-[#050505]'
          }`}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center justify-center gap-2">
            {!files.length ? (
              <>
                <Upload className="h-10 w-10 text-[#B4916C] mb-2" />
                <p className="text-base font-safiro font-medium text-[#F9F6EE]">
                  {isDragActive ? 'Drop your document here...' : 'Drag & drop your document here'}
                </p>
                <p className="text-sm font-borna text-[#F9F6EE]/60">or click to browse files</p>
                <p className="text-xs font-borna text-[#F9F6EE]/40 mt-2">
                  Supports all file types • Maximum size: 10MB
                </p>
              </>
            ) : (
              <>
                {getFileIcon(files[0])}
                <p className="text-base font-safiro font-medium text-[#F9F6EE]">{files[0].name}</p>
                <p className="text-sm font-borna text-[#F9F6EE]/60">
                  {formatFileSize(files[0].size)}
                </p>
              </>
            )}
          </div>
        </div>

        {files.length > 0 && !uploading && !success && (
          <div className="mt-4 flex justify-end">
            <Button 
              onClick={() => setFiles([])} 
              variant="outline" 
              className="mr-2"
            >
              Cancel
            </Button>
            <Button 
              onClick={uploadFile} 
              variant="accent"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </div>
        )}

        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-[#F9F6EE]/60 font-borna">Uploading...</span>
              <span className="text-sm text-[#B4916C] font-borna">{uploadProgress}%</span>
            </div>
            <div className="relative w-full h-1.5 bg-[#222222] mt-2 rounded-full overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-[#B4916C] transition-all duration-300 ease-in-out" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <Alert className="mt-4 bg-[#1a0505] border border-[#3d1a1a] text-[#f5c2c2] rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-400 mr-2" />
            <AlertDescription className="font-borna">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mt-4 bg-[#0D1F15] border border-[#1A4332] text-emerald-400 rounded-lg">
            <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
            <AlertDescription className="font-borna">{success}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 