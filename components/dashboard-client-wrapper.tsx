"use client";

import React from "react";
import DashboardComboboxes from "@/components/dashboard-comboboxes.client";
import DragAndDropUpload from "@/components/ui/drag&drop";

// Expecting cvs to be passed as props
export default function DashboardClientWrapper({ cvs }: { cvs: any[] }) {
  const handleFileUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }
      
      // Handle successful upload
      const data = await response.json();
      // Update UI or state
      
    } catch (error) {
      console.error('Upload error:', error);
      // Show error message to user
    }
  };

  return (
    <>
      <div className="bg-black text-white p-6 rounded-lg mt-8 mx-auto max-w-md lg:max-w-2xl h-192 flex items-center justify-center">
        <DragAndDropUpload />
      </div>
    </>
  );
}
