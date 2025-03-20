"use client";

// Remove this line as we'll use the correct import path
// declare module '@heroicons/react/outline';

import { useState } from "react";
import { Menu } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Trash, Download, MoreVertical, FileText, AlertCircle, Loader2, Search } from "lucide-react";
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
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  
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
      
      // Fetch the file with proper binary handling
      const response = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-cache', // Prevent caching issues with binary data
      });
      
      // Check if response is OK
      if (!response.ok) {
        // Try to parse error as JSON if possible
        try {
          const errorData = await response.json();
          console.error('Download failed:', errorData);
          throw new Error(errorData.error || `Failed to download file: ${response.status} ${response.statusText}`);
        } catch (jsonError) {
          // If it's not JSON, just use the status text
          throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }
      }
      
      // Verify content type
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
      
      // Verify that the blob type is PDF
      if (blob.type !== 'application/pdf') {
        console.warn(`MIME type mismatch: expected application/pdf but got ${blob.type}`);
        // Continue anyway as the server might have set the wrong content type
      }
      
      console.log(`File downloaded successfully, size: ${blob.size} bytes, type: ${blob.type}`);
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Use the filename from Content-Disposition if available, otherwise fall back to cv.fileName
      const contentDisposition = response.headers.get('content-disposition');
      let filename = cv.fileName;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+?)"/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
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

  const handleDiagnosticCheck = async () => {
    try {
      setIsRunningDiagnostic(true);
      setDiagnosticResult(null);
      setIsOpen(false);
      
      // Call the diagnostic API
      const response = await fetch(`/api/debug/check-pdf?fileName=${encodeURIComponent(cv.fileName)}`);
      
      if (!response.ok) {
        throw new Error(`Diagnostic check failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('PDF diagnostic results:', result);
      setDiagnosticResult(result);
      
      // Display results in console for easier debugging
      if (result.isPdf) {
        console.info(
          `PDF Diagnostic: ${result.fileName} (${result.fileSize} bytes) - ` +
          `PDF v${result.version}, EOF: ${result.hasEof ? 'OK' : 'MISSING'}, ` +
          `Objects: ${result.structureInfo.objCount}, ` +
          `Streams: ${result.structureInfo.streamCount}/${result.structureInfo.endstreamCount}`
        );
      } else {
        console.error(`File does not appear to be a valid PDF. First bytes: ${result.hexDump.firstBytes.substring(0, 20)}...`);
      }
    } catch (error) {
      console.error('Error running PDF diagnostic:', error);
      setDownloadError(`Diagnostic check failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  // Build the menu items array dynamically to include development options
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
  
  // Add diagnostic option in development mode
  if (process.env.NODE_ENV === 'development') {
    menuItems.push({
      label: isRunningDiagnostic ? "Checking..." : "Diagnostic Check",
      icon: isRunningDiagnostic ? Loader2 : Search,
      onClick: handleDiagnosticCheck,
      className: "text-[#F9F6EE]",
      disabled: isRunningDiagnostic
    });
  }

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
      
      {/* Diagnostic result display (only in development) */}
      {diagnosticResult && process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert 
            className={`rounded-xl max-w-md ${
              diagnosticResult.isPdf 
                ? "bg-[#1A2E35] border border-[#4ECDC4]/30" 
                : "bg-[#3A1F24] border border-[#E57373]/30"
            }`}
          >
            <div className="flex flex-col w-full">
              <div className="flex items-center">
                {diagnosticResult.isPdf ? (
                  <div className="h-4 w-4 text-[#4ECDC4] mr-2">✓</div>
                ) : (
                  <AlertCircle className="h-4 w-4 text-[#E57373] mr-2" />
                )}
                <span className="text-[#F9F6EE] font-semibold">
                  PDF Diagnostic: {diagnosticResult.isPdf ? 'Valid PDF' : 'Invalid PDF'}
                </span>
              </div>
              <div className="text-[#F9F6EE] ml-6 mt-1 text-sm">
                <div>File: {diagnosticResult.fileName}</div>
                <div>Size: {diagnosticResult.fileSize} bytes</div>
                {diagnosticResult.isPdf && (
                  <>
                    <div>Version: {diagnosticResult.version}</div>
                    <div>EOF marker: {diagnosticResult.hasEof ? 'Present' : 'Missing'}</div>
                    <div>Objects: {diagnosticResult.structureInfo.objCount}</div>
                  </>
                )}
              </div>
            </div>
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