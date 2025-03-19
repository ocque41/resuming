'use client';

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, BarChart2, Check, ArrowRight } from 'lucide-react';

interface Document {
  id: string;
  fileName: string;
  createdAt: string;
}

interface DocumentAnalyzerClientProps {
  documents: Document[];
}

export default function DocumentAnalyzerClient({ 
  documents 
}: DocumentAnalyzerClientProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleDocumentSelect = (documentId: string) => {
    const document = documents.find(doc => doc.id === documentId);
    setSelectedDocument(document || null);
  };

  const handleAnalyze = () => {
    if (!selectedDocument) return;
    setAnalyzing(true);
    // For now, we'll just simulate analysis with a timeout
    setTimeout(() => {
      setAnalyzing(false);
    }, 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <Card className="border border-[#222222] bg-[#111111] shadow-lg overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-safiro text-[#F9F6EE]">
            Document Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-[#8A8782]">Select Document</label>
              <select 
                className="w-full p-2 bg-[#161616] border border-[#333333] rounded-md text-[#F9F6EE]"
                value={selectedDocument?.id || ""}
                onChange={(e) => handleDocumentSelect(e.target.value)}
              >
                <option value="">Choose a document...</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.fileName}
                  </option>
                ))}
              </select>
            </div>

            {selectedDocument && (
              <div className="flex items-center gap-3">
                <div className="bg-[#161616] p-3 rounded-lg">
                  <FileText className="h-6 w-6 text-[#B4916C]" />
                </div>
                <div>
                  <h3 className="text-[#F9F6EE] text-lg font-medium">{selectedDocument.fileName}</h3>
                  <p className="text-[#8A8782] text-sm">
                    Uploaded on {new Date(selectedDocument.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex justify-center py-4">
              <Button 
                className="bg-[#B4916C] hover:bg-[#A3815C] text-white"
                disabled={!selectedDocument}
                onClick={handleAnalyze}
              >
                <BarChart2 className="h-4 w-4 mr-2" />
                Analyze Document
              </Button>
            </div>
            
            <p className="text-center text-[#8A8782] italic">
              The full document analyzer functionality is available in the advanced analyzer.
            </p>
          </div>
        </CardContent>
      </Card>

      {analyzing && (
        <div className="mt-8 p-6 bg-[#161616] rounded-xl border border-[#222222]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[#F9F6EE] flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#B4916C]" />
              Processing Document
            </h2>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setAnalyzing(false)}
              className="text-sm text-[#B4916C] font-medium flex items-center gap-1"
            >
              Skip this step <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 