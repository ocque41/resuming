"use client";

// Remove this line as we'll use the correct import path
// declare module '@heroicons/react/outline';

import { useState } from "react";
import { Menu } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Trash, Download, MoreVertical, FileText, AlertCircle, Loader2 } from "lucide-react";
import DeleteCVButton from "@/components/DeleteCVButton";
import DocumentDetails from "@/components/DocumentDetails.client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ActionsDropdownProps {
  cv: any;
}

const MotionMenuItems = motion(Menu.Items);

export default function ActionsDropdown({ cv }: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  
  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setDownloadError(null);
      setIsOpen(false); // Close the dropdown when starting download
      
      // Get the metadata to check if there's an optimized version
      let metadata = null;
      try {
        metadata = typeof cv.metadata === 'string' && cv.metadata 
          ? JSON.parse(cv.metadata) 
          : cv.metadata;
      } catch (parseError) {
        console.error('Error parsing metadata:', parseError);
        metadata = null;
      }
      
      // Determine which file to download (original or optimized)
      const endpoint = metadata?.optimized 
        ? `/api/download-cv?fileName=${encodeURIComponent(cv.fileName)}&optimized=true` 
        : `/api/download-cv?fileName=${encodeURIComponent(cv.fileName)}`;
      
      console.log(`Downloading document from: ${endpoint}`);
      
      // Fetch the file
      const response = await fetch(endpoint);
      
      // Check if response is OK and if it's a PDF
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Download failed:', errorData);
        throw new Error(errorData.error || `Failed to download file: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        console.error('Unexpected content type:', contentType);
        throw new Error(`Received unexpected file format: ${contentType || 'unknown'}`);
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      console.log(`File downloaded successfully, size: ${blob.size} bytes`);
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = window.document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = cv.fileName;
      window.document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
      
      // Show success message (could be implemented with a toast)
      console.log('Download successful');
    } catch (error) {
      console.error('Error downloading file:', error);
      setDownloadError(`Failed to download file: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleViewDetails = () => {
    setShowDetails(true);
    setIsOpen(false); // Close the dropdown when opening details
  };

  const menuItems = [
    {
      label: isDownloading ? "Downloading..." : "Download",
      icon: isDownloading ? Loader2 : Download,
      onClick: handleDownload,
      className: "text-[#F9F6EE]",
      disabled: isDownloading
    },
    {
      label: "View Details",
      icon: FileText,
      onClick: handleViewDetails,
      className: "text-[#F9F6EE]",
      disabled: false
    },
    {
      label: "Delete",
      icon: Trash,
      onClick: () => {},
      className: "text-red-400",
      customContent: <DeleteCVButton cvId={cv.id} />,
      disabled: false
    }
  ];

  return (
    <>
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button as={motion.button}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#B4916C] hover:bg-[#161616] transition-colors duration-200"
        >
          <MoreVertical className="w-4 h-4" />
        </Menu.Button>

        <AnimatePresence>
          {isOpen && (
            <MotionMenuItems
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.2, bounce: 0.25 }}
              className="absolute right-0 mt-2 w-48 origin-top-right bg-[#111111] border border-[#222222] rounded-lg shadow-lg focus:outline-none z-10 py-1"
            >
              {menuItems.map((item) => (
                <Menu.Item key={item.label} disabled={item.disabled}>
                  {({ active }) => (
                    <div
                      className={`${
                        active ? "bg-[#161616]" : ""
                      } group flex items-center w-full px-4 py-2 text-sm ${item.className} ${
                        item.disabled ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {item.customContent ? (
                        <div className="flex items-center w-full">
                          {item.icon === Loader2 ? (
                            <item.icon className="w-4 h-4 mr-3 animate-spin" />
                          ) : (
                            <item.icon className="w-4 h-4 mr-3" />
                          )}
                          {item.customContent}
                        </div>
                      ) : (
                        <button
                          onClick={item.onClick}
                          className="flex items-center w-full"
                          disabled={item.disabled}
                        >
                          {item.icon === Loader2 ? (
                            <item.icon className="w-4 h-4 mr-3 animate-spin" />
                          ) : (
                            <item.icon className="w-4 h-4 mr-3" />
                          )}
                          {item.label}
                        </button>
                      )}
                    </div>
                  )}
                </Menu.Item>
              ))}
            </MotionMenuItems>
          )}
        </AnimatePresence>
      </Menu>
      
      {/* Download status indicator */}
      {isDownloading && (
        <div className="fixed bottom-4 right-4 bg-[#111111] border border-[#222222] rounded-lg shadow-lg p-3 flex items-center z-50">
          <Loader2 className="w-4 h-4 mr-2 text-[#B4916C] animate-spin" />
          <span className="text-[#F9F6EE] text-sm">Downloading {cv.fileName}...</span>
        </div>
      )}
      
      {/* Download error message */}
      {downloadError && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert className="bg-[#3A1F24] border border-[#E57373]/30 rounded-xl max-w-md">
            <AlertCircle className="h-4 w-4 text-[#E57373]" />
            <AlertDescription className="text-[#F9F6EE] ml-2 text-sm">
              {downloadError}
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      {/* Document Details Modal */}
      {showDetails && (
        <DocumentDetails 
          cvId={cv.id} 
          onClose={() => setShowDetails(false)} 
        />
      )}
    </>
  );
} 