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
      router.refresh(); // This triggers a re-fetch of the server component data
    } catch (error: any) {
      console.error("Error uploading file:", error);
      setError("Error uploading file. Please try again.");
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        Upload A CV
      </label>
      <div
        {...getRootProps()}
        className={`w-full h-32 flex justify-center items-center border rounded-lg shadow-md
          transition-all duration-200 cursor-pointer focus:outline-none focus:ring-0
          ${isDragActive ? "border-indigo-600 bg-[#2C2420]/80" : "border-gray-300 bg-[#2C2420]/80"} bg-[#2C2420]/80`}
      >
        <input {...getInputProps()} className="hidden" />
        <div className="space-y-1 text-center">
          {isDragActive ? (
            <p className="text-blue-600 font-medium">Drop your CV here...</p>
          ) : (
            <p className="text-gray-700">
              Drag & drop your PDF here, or click to select a file.
            </p>
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
