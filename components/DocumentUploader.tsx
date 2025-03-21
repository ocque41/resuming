'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DocumentUploaderProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentUploader({ isOpen, onClose }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      handleFile(selectedFile);
    }
  };

  const handleFile = (selectedFile: File) => {
    // Check if file is PDF, DOC, or DOCX
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF, DOC, or DOCX file.');
      setFile(null);
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB
      setError('File size should be less than 10MB.');
      setFile(null);
      return;
    }

    setError(null);
    setFile(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
  };

  const uploadFile = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // In a real implementation, send the file to your server
      // const response = await fetch('/api/documents/upload', {
      //   method: 'POST',
      //   body: formData,
      // });
      
      // For now, simulate a successful upload
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // if (!response.ok) throw new Error('Upload failed');
      // const data = await response.json();
      
      onClose();
      setFile(null);
      // Refresh the document list
      router.refresh();
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#0A0A0A] border-[#222222]">
        <DialogHeader>
          <DialogTitle className="text-[#F9F6EE] font-safiro">Upload CV</DialogTitle>
        </DialogHeader>
        
        <div className="p-1">
          <div
            className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
              isDragging
                ? 'border-[#B4916C] bg-[#B4916C]/5'
                : file
                  ? 'border-green-600/40 bg-green-900/5'
                  : 'border-[#333333] hover:border-[#555555]'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {!file ? (
              <div className="text-center">
                <Upload className="h-10 w-10 text-[#B4916C] mx-auto mb-4" />
                <p className="text-[#F9F6EE] mb-1">
                  Drag and drop your CV here
                </p>
                <p className="text-[#8A8782] text-sm mb-3">
                  PDF, DOC, or DOCX (max 10MB)
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#333333] text-[#C5C2BA] hover:bg-[#1A1A1A]"
                  onClick={() => document.getElementById('cv-upload')?.click()}
                >
                  Browse Files
                </Button>
                <input
                  type="file"
                  id="cv-upload"
                  className="hidden"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between bg-[#161616] p-3 rounded-md">
                <div className="flex items-center">
                  <div className="bg-[#222222] p-2 rounded mr-3">
                    <Upload className="h-5 w-5 text-[#B4916C]" />
                  </div>
                  <div className="text-left">
                    <p className="font-safiro truncate max-w-[180px]">{file.name}</p>
                    <p className="text-xs text-[#8A8782]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button 
                  className="text-[#8A8782] hover:text-red-400 p-1" 
                  onClick={removeFile}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
          
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
          
          <div className="flex justify-end mt-6 space-x-3">
            <Button 
              type="button" 
              variant="outline" 
              className="border-[#333333] text-[#C5C2BA] hover:bg-[#1A1A1A]"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]"
              disabled={!file || uploading}
              onClick={uploadFile}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 