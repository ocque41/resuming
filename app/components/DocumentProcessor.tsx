"use client";

import { useState } from 'react';
import { FileUpload } from './FileUpload';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Loader2, FileText, RefreshCw } from 'lucide-react';
import { useToast } from './ui/use-toast';
import OpenAIAgentClient from './OpenAIAgentClient';

type ProcessorMode = 'analyze' | 'edit' | 'create';

type DocumentInfo = {
  fileId: string;
  fileKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

export default function DocumentProcessor() {
  const [activeMode, setActiveMode] = useState<ProcessorMode>('analyze');
  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const { toast } = useToast();
  
  const handleFileUploaded = (fileInfo: DocumentInfo) => {
    setDocument(fileInfo);
    setShowChat(false);
  };
  
  const handleProcessDocument = async () => {
    if (!document) return;
    
    setIsProcessing(true);
    
    try {
      // Here you'd typically make a call to your backend to process the document
      // For now, we'll just simulate a delay and then show the chat
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setShowChat(true);
      toast({
        title: "Document ready",
        description: "You can now chat with the AI about your document",
      });
      
    } catch (error) {
      console.error("Error processing document:", error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: "Unable to process the document. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleStartOver = () => {
    setDocument(null);
    setShowChat(false);
  };

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Document Processor</CardTitle>
          <CardDescription>
            Upload a document and chat with the AI about it
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs 
            defaultValue="analyze" 
            value={activeMode}
            onValueChange={(value) => setActiveMode(value as ProcessorMode)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analyze">Analyze</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="create">Create</TabsTrigger>
            </TabsList>
            
            <TabsContent value="analyze" className="mt-4">
              {!document && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload a document to analyze its content with AI.
                  </p>
                  <FileUpload onFileUploaded={handleFileUploaded} />
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="edit" className="mt-4">
              {!document && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload a document to edit or improve its content with AI.
                  </p>
                  <FileUpload onFileUploaded={handleFileUploaded} />
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="create" className="mt-4">
              {!document && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Start from scratch or upload a reference document to create new content.
                  </p>
                  <FileUpload onFileUploaded={handleFileUploaded} />
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          {document && !showChat && (
            <div className="mt-6">
              <div className="flex items-center p-4 border rounded-lg">
                <FileText className="h-6 w-6 text-primary mr-3" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{document.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {(document.fileSize / 1024).toFixed(1)} KB • {document.fileType}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleStartOver}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Change
                </Button>
              </div>
              
              <div className="mt-4 flex justify-center">
                <Button 
                  onClick={handleProcessDocument}
                  disabled={isProcessing}
                  className="w-full max-w-xs"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Chat with AI about this document
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {document && showChat && (
            <div className="mt-6">
              <OpenAIAgentClient 
                documentId={document.fileId}
                mode={activeMode}
                documentKey={document.fileKey}
                className="h-[500px]"
              />
            </div>
          )}
        </CardContent>
        
        {document && showChat && (
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={handleStartOver}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
} 