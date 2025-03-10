'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ComboboxPopover } from '@/components/ui/combobox';
import { AlertCircle, Download, FileText, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PDFPreview from './PDFPreview.client';

interface CVPreviewCardProps {
  userId: number | string;
}

interface CVItem {
  id: number;
  fileName: string;
  optimizedPdf?: boolean;
  optimizedDocx?: boolean;
}

export default function CVPreviewCard({ userId }: CVPreviewCardProps) {
  const [cvs, setCvs] = useState<CVItem[]>([]);
  const [selectedCV, setSelectedCV] = useState<CVItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [docxBase64, setDocxBase64] = useState<string | null>(null);

  // Fetch available CVs
  useEffect(() => {
    async function fetchCVs() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/cv/list');
        if (!response.ok) {
          throw new Error('Failed to fetch CVs');
        }
        
        const data = await response.json();
        
        if (data.cvs && Array.isArray(data.cvs)) {
          // Map API results to our component's format
          const formattedCVs = data.cvs.map((cv: { id: number; fileName: string; metadata?: { optimizedPdfFilePath?: string; optimizedDocxFilePath?: string } }) => ({
            id: cv.id,
            fileName: cv.fileName,
            optimizedPdf: cv.metadata?.optimizedPdfFilePath ? true : false,
            optimizedDocx: cv.metadata?.optimizedDocxFilePath ? true : false,
          }));
          
          setCvs(formattedCVs);
          
          // Auto-select the first CV that has optimized versions
          const optimizedCV = formattedCVs.find((cv: CVItem) => cv.optimizedPdf || cv.optimizedDocx);
          if (optimizedCV) {
            setSelectedCV(optimizedCV);
            fetchCVContent(optimizedCV.id);
          }
        } else {
          setCvs([]);
        }
      } catch (error) {
        console.error('Error fetching CVs:', error);
        setError('Failed to load available CVs. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchCVs();
  }, [userId]);

  // Fetch CV content when a CV is selected
  const fetchCVContent = useCallback(async (cvId: number) => {
    try {
      setLoading(true);
      setError(null);
      setPdfBase64(null);
      setDocxBase64(null);
      
      const response = await fetch(`/api/cv/get?id=${cvId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch CV content');
      }
      
      const data = await response.json();
      
      if (data.pdfBase64) {
        setPdfBase64(data.pdfBase64);
      }
      
      if (data.docxBase64) {
        setDocxBase64(data.docxBase64);
      }
    } catch (error) {
      console.error('Error fetching CV content:', error);
      setError('Failed to load CV content. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle CV selection
  const handleCVSelect = useCallback((fileName: string) => {
    const cv = cvs.find(cv => cv.fileName === fileName);
    if (cv) {
      setSelectedCV(cv);
      fetchCVContent(cv.id);
    }
  }, [cvs, fetchCVContent]);

  // Handle PDF download
  const handleDownloadPdf = useCallback(() => {
    if (!pdfBase64) return;
    
    const linkSource = `data:application/pdf;base64,${pdfBase64}`;
    const downloadLink = document.createElement('a');
    downloadLink.href = linkSource;
    downloadLink.download = selectedCV ? `${selectedCV.fileName.replace('.pdf', '')}-optimized.pdf` : 'optimized-cv.pdf';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }, [pdfBase64, selectedCV]);

  // Handle DOCX download
  const handleDownloadDocx = useCallback(() => {
    if (!docxBase64) return;
    
    const linkSource = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBase64}`;
    const downloadLink = document.createElement('a');
    downloadLink.href = linkSource;
    downloadLink.download = selectedCV ? `${selectedCV.fileName.replace('.pdf', '')}-optimized.docx` : 'optimized-cv.docx';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }, [docxBase64, selectedCV]);

  // Refresh CV data
  const handleRefresh = useCallback(() => {
    if (selectedCV) {
      fetchCVContent(selectedCV.id);
    }
  }, [selectedCV, fetchCVContent]);

  // Display options for the combobox
  const cvOptions = cvs.map(cv => cv.fileName);

  return (
    <Card className="bg-[#121212] border-gray-800 shadow-xl overflow-hidden">
      <CardContent className="p-6">
        {error && (
          <Alert className="mb-4 bg-red-900/20 text-red-400 border border-red-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center space-x-2 mb-6">
          <div className="flex-grow">
            <ComboboxPopover
              options={cvOptions}
              label="Select a CV"
              onSelect={handleCVSelect}
              accentColor="#B4916C"
              darkMode={true}
            />
          </div>
          <Button
            onClick={handleRefresh}
            disabled={!selectedCV || loading}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-10 h-10 border-2 border-[#B4916C] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400">Loading CV content...</p>
          </div>
        ) : selectedCV ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                <FileText className="h-5 w-5 inline mr-2 text-[#B4916C]" />
                {selectedCV.fileName}
              </h3>
              
              <div className="flex space-x-2">
                {docxBase64 && (
                  <Button
                    onClick={handleDownloadDocx}
                    className="bg-[#B4916C] hover:bg-[#A3815C] text-white"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    DOCX
                  </Button>
                )}
                
                {pdfBase64 && (
                  <Button
                    onClick={handleDownloadPdf}
                    className="bg-[#B4916C] hover:bg-[#A3815C] text-white"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                )}
              </div>
            </div>
            
            {pdfBase64 ? (
              <div className="h-[600px] border border-gray-700 rounded-md overflow-hidden">
                <PDFPreview 
                  pdfData={pdfBase64} 
                  fileName={selectedCV ? `${selectedCV.fileName.replace('.pdf', '')}-optimized.pdf` : 'optimized-cv.pdf'}
                  onDownload={handleDownloadPdf}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] border border-gray-700 rounded-md">
                <p className="text-gray-400 mb-2">No PDF preview available</p>
                {selectedCV.optimizedDocx && (
                  <Button
                    onClick={handleDownloadDocx}
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download DOCX
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400">
            {cvs.length > 0 ? (
              <p>Select a CV to view and download</p>
            ) : (
              <p>No optimized CVs available. Optimize a CV first.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 