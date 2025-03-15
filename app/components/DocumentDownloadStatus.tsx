'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, RefreshCw } from "lucide-react";

interface DocumentDownloadStatusProps {
  isGeneratingDocument: boolean;
  isDownloading: boolean;
  isDownloadComplete: boolean;
  documentError: string | null;
  processingStatus: string;
  processingProgress: number;
  onManualDownload: () => void;
  onRetry: () => void;
}

export default function DocumentDownloadStatus({
  isGeneratingDocument,
  isDownloading,
  isDownloadComplete,
  documentError,
  processingStatus,
  processingProgress,
  onManualDownload,
  onRetry
}: DocumentDownloadStatusProps) {
  return (
    <div className="mt-4 space-y-4">
      {/* Show error message if there's an error */}
      {documentError && (
        <Alert variant="destructive" className="bg-red-900 border-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            {documentError}
            {documentError.includes('download failed') && (
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-4 bg-red-800 hover:bg-red-700 border-red-700"
                onClick={onManualDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                Manual Download
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-4 bg-red-800 hover:bg-red-700 border-red-700"
              onClick={onRetry}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Show success message if download is complete */}
      {isDownloadComplete && !documentError && (
        <Alert className="bg-green-900 border-green-800 text-white">
          <AlertDescription className="ml-2">
            Document downloaded successfully! If you need to download it again, click the button below.
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-4 bg-green-800 hover:bg-green-700 border-green-700"
              onClick={onManualDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Show manual download button if document is generated but not downloaded */}
      {!isDownloading && !isDownloadComplete && processingProgress === 100 && !documentError && (
        <Alert className="bg-amber-900 border-amber-800 text-white">
          <AlertDescription className="ml-2">
            Document generated successfully but wasn't downloaded automatically. Click the button below to download it.
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-4 bg-amber-800 hover:bg-amber-700 border-amber-700"
              onClick={onManualDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Document
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Show processing status */}
      {(isGeneratingDocument || isDownloading) && (
        <div className="text-sm text-gray-300 animate-pulse">
          {processingStatus}
        </div>
      )}
    </div>
  );
} 