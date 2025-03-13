"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, ChevronDown, FileText } from "lucide-react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [eyeState, setEyeState] = useState<'normal' | 'yawning' | 'stressed'>('normal');
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
    
    // Random eye animations
    const animationInterval = setInterval(() => {
      const randomNum = Math.random();
      if (randomNum < 0.05) {
        setEyeState('yawning');
        setTimeout(() => setEyeState('normal'), 1000);
      } else if (randomNum < 0.1) {
        setEyeState('stressed');
        setTimeout(() => setEyeState('normal'), 800);
      }
    }, 3000);
    
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
  
  const handleSelectDocument = (fileName: string) => {
    setSelectedDocument(fileName);
    
    // Add a message about the selected document
    setMessages(prev => [
      ...prev, 
      { 
        role: "assistant", 
        content: `I've selected "${fileName}" as your reference document. How would you like to enhance it?` 
      }
    ]);
    
    // Show happy eyes briefly when selecting a document
    setEyeState('yawning');
    setTimeout(() => setEyeState('normal'), 800);
  };
  
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOC, DOCX, TXT, or MD file.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploading(true);
    setEyeState('stressed');
    
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload file to server
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload document');
      }
      
      const data = await response.json();
      
      // Add new document to the list
      const newDocument = {
        id: data.id,
        fileName: file.name,
        createdAt: new Date()
      };
      
      setDocuments(prev => [newDocument, ...prev]);
      setSelectedDocument(file.name);
      
      // Show success message
      toast({
        title: "Document uploaded",
        description: `${file.name} has been successfully uploaded.`,
      });
      
      // Add a message about the uploaded document
      setMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: `I've received your document "${file.name}". How would you like to enhance it?` 
        }
      ]);
      
      // Show happy eyes
      setEyeState('yawning');
      setTimeout(() => setEyeState('normal'), 800);
      
    } catch (error) {
      console.error('Error uploading document:', error);
      
      // Show error message
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document. Please try again.",
        variant: "destructive"
      });
      
      // Show stressed eyes for longer
      setEyeState('stressed');
      setTimeout(() => setEyeState('normal'), 1500);
      
    } finally {
      setIsUploading(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div className="w-full flex flex-col items-center justify-center min-h-screen py-10 px-4">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.txt,.md"
        aria-label="Upload document"
      />
      
      {/* Main Content Container */}
      <div className="w-full max-w-4xl flex flex-col items-center">
        {/* Logo and Title */}
        <div className="w-full text-center mb-8 md:mb-12">
          <div className="flex justify-center mb-6">
            <div 
              ref={logoRef}
              className="h-16 w-16 bg-[#222222] rounded-full flex items-center justify-center relative overflow-hidden"
              aria-hidden="true"
            >
              {eyeState === 'normal' && (
                <>
                  <div 
                    className="h-2 w-2 bg-white rounded-full absolute transition-all duration-200 ease-out"
                    style={{ 
                      left: `calc(50% - 4px + ${eyePosition.x}px)`, 
                      top: `calc(50% + ${eyePosition.y}px)`,
                      transform: 'translateX(-50%)'
                    }}
                  ></div>
                  <div 
                    className="h-2 w-2 bg-white rounded-full absolute transition-all duration-200 ease-out"
                    style={{ 
                      left: `calc(50% + 4px + ${eyePosition.x}px)`, 
                      top: `calc(50% + ${eyePosition.y}px)`,
                      transform: 'translateX(-50%)'
                    }}
                  ></div>
                </>
              )}
              
              {eyeState === 'yawning' && (
                <>
                  <div className="h-2 w-2 bg-white rounded-full absolute" style={{ left: 'calc(50% - 4px)', top: 'calc(50% - 3px)' }}></div>
                  <div className="h-2 w-2 bg-white rounded-full absolute" style={{ left: 'calc(50% + 4px)', top: 'calc(50% - 3px)' }}></div>
                  <div className="h-1 w-4 bg-white rounded-full absolute" style={{ left: 'calc(50% - 2px)', top: 'calc(50% + 3px)' }}></div>
                </>
              )}
              
              {eyeState === 'stressed' && (
                <>
                  <div className="h-1 w-3 bg-white absolute" style={{ left: 'calc(50% - 5px)', top: 'calc(50%)', transform: 'rotate(45deg)' }}></div>
                  <div className="h-1 w-3 bg-white absolute" style={{ left: 'calc(50% - 5px)', top: 'calc(50%)', transform: 'rotate(-45deg)' }}></div>
                  <div className="h-1 w-3 bg-white absolute" style={{ left: 'calc(50% + 2px)', top: 'calc(50%)', transform: 'rotate(45deg)' }}></div>
                  <div className="h-1 w-3 bg-white absolute" style={{ left: 'calc(50% + 2px)', top: 'calc(50%)', transform: 'rotate(-45deg)' }}></div>
                </>
              )}
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white">Let's make a document</h1>
        </div>
        
        {/* Search Container */}
        <div className="w-full">
          <div className="bg-[#1A1A1A] rounded-2xl p-4 md:p-6 shadow-xl border border-[#333333]">
            {/* Search Input */}
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Describe the document you want to create..."
              className="w-full bg-[#1A1A1A] border-none text-white text-base md:text-lg resize-none min-h-[60px] md:min-h-[80px] focus:outline-none focus:ring-0 placeholder-gray-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              aria-label="Document description"
            />
            
            {/* Button Row */}
            <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-6">
              {/* Left Buttons */}
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="bg-[#B4916C] hover:bg-[#A3815C] text-white rounded-full px-3 md:px-4 h-9 md:h-10 flex items-center text-sm md:text-base"
                      aria-label="Select document"
                    >
                      <FileText className="h-4 w-4 mr-1 md:mr-2" />
                      <span>{selectedDocument || "Documents"}</span>
                      <ChevronDown className="h-3 w-3 md:h-4 md:w-4 ml-1 md:ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-[#2A2A2A] border-[#444444] text-white">
                    {documents.length > 0 ? (
                      documents.map((doc) => (
                        <DropdownMenuItem 
                          key={doc.id}
                          onClick={() => handleSelectDocument(doc.fileName)}
                          className="hover:bg-[#3A3A3A] cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{doc.fileName}</span>
                            <span className="text-xs text-gray-400">
                              {format(doc.createdAt, 'MMM d, yyyy')}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled className="text-gray-500">
                        No documents available
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Right Buttons */}
              <div className="ml-auto flex items-center space-x-2">
                <Button
                  variant="ghost"
                  className="bg-[#222222] hover:bg-[#333333] text-white rounded-full p-2 h-9 w-9 md:h-10 md:w-10 flex items-center justify-center"
                  aria-label="Attach file"
                  onClick={handleFileUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <div className="h-4 w-4 md:h-5 md:w-5 border-2 border-t-transparent border-white rounded-full animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4 md:h-5 md:w-5" />
                  )}
                </Button>
                
                <Button
                  onClick={handleSendMessage}
                  variant="ghost"
                  className="bg-[#222222] hover:bg-[#333333] text-white rounded-full p-2 h-9 w-9 md:h-10 md:w-10 flex items-center justify-center"
                  aria-label="Submit"
                >
                  <Send className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Messages area */}
          {messages.length > 0 && (
            <div className="mt-6 md:mt-8 space-y-3 md:space-y-4 px-1 md:px-2">
              {messages.map((message, index) => (
                <div 
                  key={index} 
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div 
                    className={`max-w-[90%] rounded-lg p-2 md:p-3 text-sm md:text-base ${
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