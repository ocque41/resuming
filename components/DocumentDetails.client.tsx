"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Download, X, FileText, Calendar, Info, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { format } from "date-fns";

interface DocumentDetailsProps {
  cvId: number | string;
  onClose: () => void;
}

interface DocumentData {
  id: number;
  fileName: string;
  createdAt: string;
  filePath: string;
  rawText: string | null;
  metadata: Record<string, any>;
}

export default function DocumentDetails({ cvId, onClose }: DocumentDetailsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentData | null>(null);

  useEffect(() => {
    const fetchDocumentDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/cv/get-details?cvId=${cvId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load document details');
        }
        
        const data = await response.json();
        setDocument(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching document details:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (cvId) {
      fetchDocumentDetails();
    }
  }, [cvId]);

  const handleDownload = async () => {
    if (!document) return;
    
    try {
      const isOptimized = document.metadata?.optimized || false;
      const endpoint = `/api/download-cv?fileName=${encodeURIComponent(document.fileName)}${isOptimized ? '&optimized=true' : ''}`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = window.document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = document.fileName;
      window.document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPP');
    } catch (e) {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'p');
    } catch (e) {
      return '';
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[80vh] max-h-[80vh] border border-[#222222] bg-[#111111] p-0 rounded-xl overflow-hidden">
        <div className="sticky top-0 z-10 bg-[#111111] border-b border-[#222222] px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-safiro text-[#F9F6EE]">
              Document Details
            </DialogTitle>
            <DialogClose asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8 text-[#8A8782] hover:text-[#F9F6EE] hover:bg-[#161616]"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription className="text-sm text-[#8A8782] font-borna mt-1">
            View detailed information about your document
          </DialogDescription>
        </div>

        <ScrollArea className="h-full px-6 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 rounded-full border-2 border-[#B4916C] border-t-transparent animate-spin mb-4"></div>
              <p className="text-[#8A8782] font-borna">Loading document details...</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="bg-[#3A1F24] border border-[#E57373]/30 rounded-xl mb-6">
              <AlertCircle className="h-5 w-5 text-[#E57373]" />
              <AlertDescription className="text-[#F9F6EE] ml-2 font-borna">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {document && !loading && (
            <div className="space-y-6">
              {/* Basic Information */}
              <Card className="border border-[#222222] bg-[#0D0D0D] shadow-lg overflow-hidden">
                <CardHeader className="pb-0 pt-5">
                  <CardTitle className="text-lg font-safiro text-[#F9F6EE] flex items-center">
                    <FileText className="h-5 w-5 text-[#B4916C] mr-2" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-[#8A8782] mb-1">File Name</h4>
                      <p className="text-[#F9F6EE] font-borna break-all">{document.fileName}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-[#8A8782] mb-1">Document ID</h4>
                      <p className="text-[#F9F6EE] font-borna">{document.id}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-[#8A8782] mb-1">Upload Date</h4>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-[#B4916C] mr-1" />
                        <p className="text-[#F9F6EE] font-borna">{formatDate(document.createdAt)}</p>
                      </div>
                      <div className="flex items-center mt-1">
                        <Clock className="h-4 w-4 text-[#B4916C] mr-1" />
                        <p className="text-[#8A8782] text-sm font-borna">{formatTime(document.createdAt)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-end">
                      <Button
                        onClick={handleDownload}
                        className="bg-[#B4916C] hover:bg-[#A3815C] text-white font-borna"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Document
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Metadata Section */}
              <Card className="border border-[#222222] bg-[#0D0D0D] shadow-lg overflow-hidden">
                <CardHeader className="pb-0 pt-5">
                  <CardTitle className="text-lg font-safiro text-[#F9F6EE] flex items-center">
                    <Info className="h-5 w-5 text-[#B4916C] mr-2" />
                    Document Metadata
                  </CardTitle>
                  <CardDescription className="text-sm text-[#8A8782] font-borna">
                    Technical details and properties of your document
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  {/* ATS Score if available */}
                  {document.metadata?.atsScore && (
                    <div className="mb-4 p-3 bg-[#0D1F15]/50 rounded-lg border border-[#1A4332]/50">
                      <h4 className="text-sm font-medium text-[#4ADE80] mb-2">ATS Score</h4>
                      <div className="w-full bg-[#1A4332]/30 rounded-full h-2.5">
                        <div 
                          className="bg-[#4ADE80] h-2.5 rounded-full" 
                          style={{ width: `${document.metadata.atsScore}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-[#8A8782]">0%</span>
                        <span className="text-xs text-[#4ADE80]">{document.metadata.atsScore}%</span>
                        <span className="text-xs text-[#8A8782]">100%</span>
                      </div>
                    </div>
                  )}

                  {/* Optimization Status */}
                  {document.metadata?.optimized !== undefined && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-[#8A8782] mb-2">Optimization Status</h4>
                      <Badge 
                        className={document.metadata.optimized ? 
                          "bg-[#0D1F15] text-[#4ADE80]" : 
                          "bg-[#161616] text-[#8A8782]"
                        }
                      >
                        {document.metadata.optimized ? "Optimized" : "Not Optimized"}
                      </Badge>
                    </div>
                  )}

                  {/* All Metadata Key-Value Pairs */}
                  <div className="rounded-lg border border-[#222222] overflow-hidden">
                    <div className="bg-[#161616] px-4 py-2">
                      <h4 className="text-sm font-medium text-[#F9F6EE]">All Metadata Properties</h4>
                    </div>
                    <div className="divide-y divide-[#222222]">
                      {Object.entries(document.metadata || {}).map(([key, value]) => (
                        <div key={key} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center">
                          <span className="font-medium text-sm text-[#B4916C] sm:w-1/3">{key}</span>
                          <span className="font-borna text-[#F9F6EE] sm:w-2/3 break-all">
                            {typeof value === 'object' 
                              ? JSON.stringify(value) 
                              : String(value)}
                          </span>
                        </div>
                      ))}
                      
                      {Object.keys(document.metadata || {}).length === 0 && (
                        <div className="px-4 py-3 text-[#8A8782] italic text-sm">
                          No metadata available for this document
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Content Preview (if available) */}
              {document.rawText && (
                <Card className="border border-[#222222] bg-[#0D0D0D] shadow-lg overflow-hidden mb-6">
                  <CardHeader className="pb-0 pt-5">
                    <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
                      Document Content Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="rounded-lg border border-[#222222] bg-[#050505] p-4 overflow-hidden">
                      <pre className="text-[#F9F6EE] font-borna text-sm whitespace-pre-wrap overflow-auto max-h-64">
                        {document.rawText}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 