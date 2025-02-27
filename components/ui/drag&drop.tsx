"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { useRouter } from "next/navigation";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const DragAndDropUpload: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
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
      const response = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Upload successful:", response.data);
      setUploadSuccess(true);
      router.refresh();
    } catch (error: any) {
      console.error("Error uploading file:", error);
      setError("Error uploading file. Please try again.");
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="space-y-1">
      <div
        {...getRootProps()}
        className="w-full max-w-4xl h-48 flex justify-center items-center border rounded-lg shadow-md transition-all duration-200 cursor-pointer focus:outline-none focus:ring-0 border-[#B4916C] bg-[#050505]"
      >
        <input {...getInputProps()} className="hidden" />
        <div className="text-center px-4">
          {isDragActive ? (
            <p className="text-blue-600 font-medium">Drop your CV here...</p>
          ) : (
            <p className="text-white">Drop Your CV</p>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {uploadSuccess && (
        <p className="mt-2 text-sm text-green-600">
          File uploaded successfully!
        </p>
      )}
    </div>
  );
};

export default DragAndDropUpload;
