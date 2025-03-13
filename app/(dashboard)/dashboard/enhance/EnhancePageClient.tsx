"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, ChevronDown, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// Define props interface with serializable types
interface EnhancePageClientProps {
  documentsData: {
    id: string;
    fileName: string;
    createdAt: string; // ISO string format
  }[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function EnhancePageClient({ documentsData }: EnhancePageClientProps) {
  const [inputMessage, setInputMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [eyeState, setEyeState] = useState<'normal' | 'yawning' | 'stressed' | 'happy' | 'wink' | 'surprised'>('normal');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState(documentsData.map(doc => ({
    id: doc.id,
    fileName: doc.fileName,
    createdAt: new Date(doc.createdAt)
  })));
  const { toast } = useToast();
  
  // Scroll to bottom of messages when new ones are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Handle mouse movement for eye tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (logoRef.current) {
        const logoRect = logoRef.current.getBoundingClientRect();
        const logoCenterX = logoRect.left + logoRect.width / 2;
        const logoCenterY = logoRect.top + logoRect.height / 2;
        
        // Calculate distance from cursor to logo center
        const deltaX = e.clientX - logoCenterX;
        const deltaY = e.clientY - logoCenterY;
        
        // Limit eye movement to a small range
        const maxMove = 3;
        const moveX = Math.max(-maxMove, Math.min(maxMove, deltaX / 20));
        const moveY = Math.max(-maxMove, Math.min(maxMove, deltaY / 20));
        
        setEyePosition({ x: moveX, y: moveY });
      }
    };
    
    // Enhanced random eye animations with more variety
    const animationInterval = setInterval(() => {
      const randomNum = Math.random();
      if (randomNum < 0.03) {
        setEyeState('yawning');
        setTimeout(() => setEyeState('normal'), 1000);
      } else if (randomNum < 0.06) {
        setEyeState('stressed');
        setTimeout(() => setEyeState('normal'), 800);
      } else if (randomNum < 0.09) {
        setEyeState('happy');
        setTimeout(() => setEyeState('normal'), 1200);
      } else if (randomNum < 0.11) {
        setEyeState('wink');
        setTimeout(() => setEyeState('normal'), 600);
      } else if (randomNum < 0.13) {
        setEyeState('surprised');
        setTimeout(() => setEyeState('normal'), 700);
      }
    }, 2500);
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(animationInterval);
    };
  }, []);
  
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { role: "user", content: inputMessage }]);
    
    // Simulate assistant response
    setTimeout(() => {
      let response = selectedDocument 
        ? `I'll help you create this document based on "${selectedDocument}". What specific content would you like to include?`
        : "I'll help you create this document. What specific content would you like to include?";
      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    }, 1000);
    
    setInputMessage("");
    
    // Show stressed eyes briefly when sending a message
    setEyeState('stressed');
    setTimeout(() => setEyeState('normal'), 500);
  };
  
  const handleSelectDocument = (fileName: string, id: string) => {
    setSelectedDocument(fileName);
    setSelectedDocumentId(id);
    
    // Show happy eyes briefly when selecting a document
    setEyeState('happy');
    setTimeout(() => setEyeState('normal'), 800);
    
    // Add assistant message about document selection
    setMessages(prev => [...prev, { 
      role: "assistant", 
      content: `I'll use "${fileName}" as a reference. How would you like to enhance this document?` 
    }]);
  };
  
  const handleDeselectDocument = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from opening
    setSelectedDocument(null);
    setSelectedDocumentId(null);
    
    // Show surprised eyes briefly when deselecting a document
    setEyeState('surprised');
    setTimeout(() => setEyeState('normal'), 600);
    
    // Add assistant message about document deselection
    setMessages(prev => [...prev, { 
      role: "assistant", 
      content: "I've removed the document reference. What kind of document would you like to create now?" 
    }]);
  };
  
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Supported file types
    const SUPPORTED_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'image/jpeg',
      'image/png',
      'application/rtf',
    ];
    
    // Maximum file size (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    
    // Validate file type
    if (!SUPPORTED_TYPES.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF, Word, Excel, PowerPoint, text, or image file.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    setEyeState('stressed');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Use the existing document upload API endpoint
      const response = await fetch('/api/document/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload document');
      }
      
      const data = await response.json();
      
      // Add the new document to the list
      const newDocument = {
        id: data.fileId,
        fileName: data.fileName,
        createdAt: new Date(),
      };
      
      setDocuments(prev => [newDocument, ...prev]);
      
      // Select the newly uploaded document
      handleSelectDocument(newDocument.fileName, newDocument.id);
      
      toast({
        title: "Document uploaded",
        description: `${file.name} has been uploaded successfully.`,
      });
      
      // Show happy eyes briefly
      setEyeState('happy');
      setTimeout(() => setEyeState('normal'), 1000);
      
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
      
      // Show stressed eyes briefly
      setEyeState('stressed');
      setTimeout(() => setEyeState('normal'), 800);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-6 px-4 bg-black">
      <div className="w-full max-w-3xl mx-auto">
        {/* Logo and Title */}
        <div className="flex flex-col items-center mb-6">
          {/* Character Logo */}
          <div 
            ref={logoRef}
            className="w-16 h-16 bg-[#333333] rounded-full flex items-center justify-center mb-4"
          >
            <div className="relative w-8 h-3">
              {/* Left Eye */}
              <div 
                className={`absolute w-3 h-3 bg-white rounded-full left-0 top-0`}
                style={{ 
                  transform: eyeState === 'normal' 
                    ? `translate(${eyePosition.x}px, ${eyePosition.y}px)` 
                    : eyeState === 'yawning' || eyeState === 'stressed'
                      ? 'scale(0.7)'
                      : eyeState === 'wink'
                        ? 'scale(0.1)'
                        : eyeState === 'surprised'
                          ? 'scale(1.2)'
                          : 'translate(0, 0)'
                }}
              />
              
              {/* Right Eye */}
              <div 
                className={`absolute w-3 h-3 bg-white rounded-full right-0 top-0`}
                style={{ 
                  transform: eyeState === 'normal' 
                    ? `translate(${eyePosition.x}px, ${eyePosition.y}px)` 
                    : eyeState === 'yawning' || eyeState === 'stressed'
                      ? 'scale(0.7)'
                      : eyeState === 'happy'
                        ? 'scale(0.7) translate(0, 1px)'
                        : eyeState === 'surprised'
                          ? 'scale(1.2)'
                          : 'translate(0, 0)'
                }}
              />
            </div>
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Let's Make a Document</h1>
        </div>
        
        {/* Chat Interface */}
        <div className="bg-[#1A1A1A] rounded-lg shadow-lg p-4 md:p-6">
          {/* Input Area */}
          <div className="bg-[#222222] rounded-lg p-2 md:p-3">
            <div className="flex flex-col">
              {/* Document Selection */}
              <div className="flex items-center mb-2 md:mb-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="h-8 px-2 text-xs md:text-sm text-white bg-[#B4916C]/20 hover:bg-[#B4916C]/30 rounded flex items-center"
                    >
                      {selectedDocument ? (
                        <div className="flex items-center">
                          <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                          <span className="truncate max-w-[120px] md:max-w-[150px]">{selectedDocument}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 ml-1 hover:bg-[#B4916C]/40 rounded-full p-0"
                            onClick={handleDeselectDocument}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span>Select Document</span>
                          <ChevronDown className="h-3 w-3 md:h-4 md:w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-[#2A2A2A] border border-[#444444] text-white">
                    {documents.length > 0 ? (
                      documents.map(doc => (
                        <DropdownMenuItem 
                          key={doc.id}
                          onClick={() => handleSelectDocument(doc.fileName, doc.id)}
                          className="hover:bg-[#3A3A3A] cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-sm truncate max-w-[200px]">{doc.fileName}</span>
                            <span className="text-xs text-gray-400">
                              {format(doc.createdAt, 'MMM d, yyyy')}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled className="text-gray-500 text-sm">
                        No documents available
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Text Input */}
              <div className="flex items-end">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-white resize-none h-10 min-h-[40px] py-2 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.rtf,.jpg,.jpeg,.png"
                />
                
                {/* Right Buttons */}
                <div className="ml-auto flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    className="bg-[#222222] hover:bg-[#333333] text-white rounded-full p-1 h-8 w-8 md:h-9 md:w-9 flex items-center justify-center"
                    aria-label="Attach file"
                    onClick={handleFileUpload}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <div className="h-3 w-3 md:h-4 md:w-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                    ) : (
                      <Paperclip className="h-3 w-3 md:h-4 md:w-4" />
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleSendMessage}
                    variant="ghost"
                    className="bg-[#222222] hover:bg-[#333333] text-white rounded-full p-1 h-8 w-8 md:h-9 md:w-9 flex items-center justify-center"
                    aria-label="Submit"
                  >
                    <Send className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Messages area */}
          {messages.length > 0 && (
            <div className="mt-4 space-y-2 md:space-y-3 px-1 md:px-2 max-h-[300px] overflow-y-auto">
              {messages.map((message, index) => (
                <div 
                  key={index} 
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div 
                    className={`max-w-[90%] rounded-lg p-2 text-xs md:text-sm ${
                      message.role === "user" 
                        ? "bg-[#2A2A2A] text-white" 
                        : "bg-[#B4916C]/10 text-white border border-[#B4916C]/20"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 