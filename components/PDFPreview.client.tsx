'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Download, RefreshCw, Plus, Minus } from 'lucide-react';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFPreviewProps {
  pdfData: string;
  fileName?: string;
  onDownload?: () => void;
}

export default function PDFPreview({ pdfData, fileName = 'document.pdf', onDownload }: PDFPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Reset state when PDF data changes
  useEffect(() => {
    setPageNumber(1);
    setScale(1.0);
    setRotation(0);
    setLoading(true);
    setError(null);
  }, [pdfData]);

  // Measure container width for responsive rendering
  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }

    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle PDF load success
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  // Handle PDF load error
  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF. Please try again.');
    setLoading(false);
  }

  // Navigation functions
  function goToPrevPage() {
    setPageNumber(page => Math.max(page - 1, 1));
  }

  function goToNextPage() {
    if (numPages) {
      setPageNumber(page => Math.min(page + 1, numPages));
    }
  }

  // Zoom functions
  function zoomIn() {
    setScale(s => Math.min(s + 0.2, 3.0));
  }

  function zoomOut() {
    setScale(s => Math.max(s - 0.2, 0.5));
  }

  // Rotation function
  function rotate() {
    setRotation(r => (r + 90) % 360);
  }

  // Handle download
  function handleDownload() {
    if (onDownload) {
      onDownload();
    } else {
      // Default download if no custom handler is provided
      const linkSource = `data:application/pdf;base64,${pdfData}`;
      const downloadLink = document.createElement('a');
      downloadLink.href = linkSource;
      downloadLink.download = fileName;
      downloadLink.click();
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-md overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={goToPrevPage} 
            disabled={pageNumber <= 1 || loading}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <ChevronLeft size={20} />
          </Button>
          <span className="text-gray-300 mx-2">
            {loading ? '...' : `${pageNumber} / ${numPages || '...'}`}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={goToNextPage} 
            disabled={!numPages || pageNumber >= numPages || loading}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <ChevronRight size={20} />
          </Button>
        </div>
        
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={zoomOut} 
            disabled={loading || scale <= 0.5}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <Minus size={20} />
          </Button>
          <span className="text-gray-300 mx-2">{Math.round(scale * 100)}%</span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={zoomIn} 
            disabled={loading || scale >= 3.0}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <Plus size={20} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={rotate} 
            disabled={loading}
            className="text-gray-300 hover:text-white hover:bg-gray-700 ml-2"
          >
            <RefreshCw size={20} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleDownload} 
            className="text-gray-300 hover:text-white hover:bg-gray-700 ml-2"
          >
            <Download size={20} />
          </Button>
        </div>
      </div>
      
      <div 
        ref={containerRef} 
        className="flex-1 overflow-auto p-4 flex justify-center items-start bg-gray-900"
      >
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-400 p-4">
            <span className="mb-2">⚠️</span>
            <p className="text-center">{error}</p>
          </div>
        ) : (
          <Document
            file={`data:application/pdf;base64,${pdfData}`}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center w-full h-[500px] gap-4">
                <Skeleton className="h-[640px] w-[480px] bg-gray-800" />
                <p className="text-gray-400">Loading PDF...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center w-full h-[500px] text-red-400">
                <p>Failed to load PDF</p>
              </div>
            }
          >
            {loading ? null : (
              <Page
                pageNumber={pageNumber}
                scale={scale}
                rotate={rotation}
                width={containerWidth ? Math.min(containerWidth - 40, 800) : undefined}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={
                  <Skeleton className="h-[640px] w-[480px] bg-gray-800" />
                }
              />
            )}
          </Document>
        )}
      </div>
    </div>
  );
} 