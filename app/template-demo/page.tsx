'use client';

import React, { useState } from 'react';
import CVDocumentTemplateSelector from '@/components/CVDocumentTemplateSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TemplateDemo() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('professional');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [cvText, setCvText] = useState<string>('');
  
  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template);
    console.log('Selected template:', template);
  };
  
  const handleGenerateDocx = async () => {
    if (!cvText.trim()) {
      alert('Please enter some CV text first');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      console.log(`Generating DOCX with template: ${selectedTemplate}`);
      
      const response = await fetch('/api/cv/optimize-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: '123', // This would be a real CV ID in production
          optimizedText: cvText,
          template: selectedTemplate
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate document');
      }
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Document generation started with template: ${selectedTemplate}`);
        
        // In a real application, you would now poll for the document status
        // and provide a download link when ready
      } else {
        throw new Error('Failed to start document generation');
      }
    } catch (error) {
      console.error('Error generating document:', error);
      alert(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center mb-8">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center h-10 w-10 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold text-[#B4916C]">Document Template Selector Demo</h1>
        </header>
        
        <div className="grid grid-cols-1 gap-8">
          <Card className="bg-[#121212] border-gray-800">
            <CardHeader>
              <CardTitle className="text-[#B4916C]">Step 1: Enter CV Text</CardTitle>
              <CardDescription>Paste your CV text or optimized content here</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea 
                className="w-full h-40 p-3 bg-[#1A1A1A] border border-gray-700 rounded-md text-gray-300"
                placeholder="Paste your CV text here..."
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
              />
            </CardContent>
          </Card>
          
          <Card className="bg-[#121212] border-gray-800">
            <CardHeader>
              <CardTitle className="text-[#B4916C]">Step 2: Select Document Template</CardTitle>
              <CardDescription>Choose a template style for your document</CardDescription>
            </CardHeader>
            <CardContent>
              <CVDocumentTemplateSelector 
                onSelect={handleTemplateSelect}
                selectedTemplate={selectedTemplate}
              />
            </CardContent>
          </Card>
          
          <Card className="bg-[#121212] border-gray-800">
            <CardHeader>
              <CardTitle className="text-[#B4916C]">Step 3: Generate Document</CardTitle>
              <CardDescription>Create your document with the selected template</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end">
                <Button
                  onClick={handleGenerateDocx}
                  disabled={isGenerating || !cvText.trim()}
                  className="bg-[#B4916C] hover:bg-[#A27D59] text-white"
                >
                  {isGenerating ? (
                    <>
                      <span className="animate-spin mr-2">◠</span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Generate DOCX
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <div className="mt-8 text-sm text-gray-400">
            <h3 className="text-white font-medium mb-2">How It Works</h3>
            <p className="mb-2">
              This demo showcases the template selection UI and document generation process.
              In a real application, the following would happen:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>User enters or selects optimized CV content</li>
              <li>User selects a template from the available options</li>
              <li>The frontend sends a request to the <code className="bg-black px-1 rounded">/api/cv/optimize-docx</code> endpoint</li>
              <li>The backend processes the request and generates a DOCX file with the selected template</li>
              <li>The frontend polls for completion and provides a download link when ready</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
} 