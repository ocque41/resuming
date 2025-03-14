'use client';

import React from 'react';
import { Download, CheckCircle, AlertCircle } from 'lucide-react';

interface DocumentDownloadStatusProps {
  isDownloading: boolean;
  isDownloadComplete: boolean;
  error: string | null;
  onManualDownload: () => void;
}

const DocumentDownloadStatus: React.FC<DocumentDownloadStatusProps> = ({
  isDownloading,
  isDownloadComplete,
  error,
  onManualDownload
}) => {
  return (
    <div className="w-full bg-[#0D0D0D] border border-gray-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-white">Document Download</h3>
        {isDownloadComplete && !error && (
          <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-500">
            Complete
          </span>
        )}
        {error && (
          <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-500">
            Failed
          </span>
        )}
        {isDownloading && !isDownloadComplete && !error && (
          <span className="px-2 py-1 text-xs rounded-full bg-[#B4916C]/20 text-[#B4916C]">
            In Progress
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-4">
        {isDownloadComplete && !error ? (
          <div className="flex items-center text-green-500">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Document downloaded successfully</span>
          </div>
        ) : error ? (
          <div className="flex items-center text-red-400">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="flex items-center text-[#B4916C]">
            <div className="animate-spin w-5 h-5 mr-2 border-2 border-[#B4916C] border-t-transparent rounded-full" />
            <span>Downloading document...</span>
          </div>
        )}
      </div>
      
      {(error || isDownloadComplete) && (
        <button
          onClick={onManualDownload}
          className="mt-4 px-4 py-2 bg-[#B4916C] hover:bg-[#A3815C] text-white rounded-md flex items-center transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          {error ? 'Try Manual Download' : 'Download Again'}
        </button>
      )}
      
      {error && (
        <div className="mt-3 text-xs text-gray-400">
          <p>If automatic download failed, you can:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Try the manual download button above</li>
            <li>Check if your browser is blocking downloads</li>
            <li>Try using a different browser</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default DocumentDownloadStatus; 