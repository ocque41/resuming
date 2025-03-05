"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const DragAndDropUpload: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const router = useRouter();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    setUploadSuccess(false);
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];

    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File size exceeds the maximum limit of 5 MB.");
      return;
    }

    console.log("Selected file:", file);
    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      const response = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Upload successful:", response.data);
      setUploadSuccess(true);
      router.refresh();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      setError("Error uploading file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`w-full h-56 flex flex-col justify-center items-center border rounded-lg transition-all duration-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#B4916C] 
          ${isDragActive 
            ? "border-[#B4916C] border-dashed bg-[#B4916C]/5" 
            : "border-[#B4916C]/20 bg-[#050505] hover:bg-[#B4916C]/5 hover:border-[#B4916C]/50"
          }`}
      >
        <input {...getInputProps()} className="hidden" />
        <div className="text-center px-6 py-8">
          <div className="mb-4 mx-auto w-12 h-12 rounded-full bg-[#B4916C]/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-[#B4916C]" />
          </div>
          {isUploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#B4916C] mb-2"></div>
              <p className="text-gray-300">Uploading CV...</p>
            </div>
          ) : isDragActive ? (
            <p className="text-[#B4916C] font-medium">Drop your CV here...</p>
          ) : (
            <div>
              <p className="text-gray-300 mb-2">Drag and drop your CV here, or click to browse</p>
              <p className="text-gray-500 text-sm">Accepts PDF files up to 5MB</p>
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-md">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      
      {uploadSuccess && (
        <div className="p-3 bg-[#B4916C]/10 border border-[#B4916C]/20 rounded-md">
          <p className="text-sm text-[#B4916C]">CV uploaded successfully!</p>
        </div>
      )}
    </div>
  );
};

export default DragAndDropUpload;
