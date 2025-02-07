"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";

const DragAndDropUpload: React.FC = () => {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("/api/upload-cv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Upload successful:", response.data);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="space-y-1">
      {/* Label above the drop area */}
      <label className="block text-sm font-medium text-gray-700">
        Upload A CV
      </label>
      
      {/* Drop area */}
      <div
        {...getRootProps()}
        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md 
          transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500
          ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-[#000000]"}`}
      >
        <input {...getInputProps()} className="hidden" />
        <div className="space-y-1 text-center">
          {isDragActive ? (
            <p className="text-blue-600 font-medium">Drop your CV here...</p>
          ) : (
            <p className="text-white">
              Drop
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DragAndDropUpload;
