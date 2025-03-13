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
    setEyeState('happy');
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
    setEyeState('surprised');
    
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
        description: `${file.name} has been uploaded successfully.`,
      });
      
      // Show happy eyes briefly
      setEyeState('happy');
      setTimeout(() => setEyeState('normal'), 1000);
      
      // Add a message about the uploaded document
      setMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: `I've uploaded "${file.name}" for you. How would you like to enhance it?` 
        }
      ]);
    } catch (error) {
      console.error('Error uploading document:', error);
      
      // Show error message
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document.",
        variant: "destructive"
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
    <div className="flex flex-col items-center justify-center min-h-screen py-8 px-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-6">Let's make a document</h1>
        
        <div className="bg-[#111111] rounded-xl shadow-lg overflow-hidden w-full max-w-2xl">
          {/* Logo with animated eyes */}
          <div className="flex justify-center my-4">
            <div 
              ref={logoRef}
              className="relative h-14 w-14 bg-[#B4916C] rounded-full flex items-center justify-center"
            >
              {/* Eyes */}
              {eyeState === 'normal' && (
                <>
                  <div className="absolute h-2.5 w-2.5 bg-black rounded-full" 
                    style={{ 
                      left: `calc(35% + ${eyePosition.x}px)`, 
                      top: `calc(40% + ${eyePosition.y}px)` 
                    }}
                  />
                  <div className="absolute h-2.5 w-2.5 bg-black rounded-full" 
                    style={{ 
                      right: `calc(35% - ${eyePosition.x}px)`, 
                      top: `calc(40% + ${eyePosition.y}px)` 
                    }}
                  />
                </>
              )}
              
              {/* Yawning eyes */}
              {eyeState === 'yawning' && (
                <>
                  <div className="absolute h-0.5 w-2.5 bg-black rounded-full" 
                    style={{ left: '35%', top: '40%' }}
                  />
                  <div className="absolute h-0.5 w-2.5 bg-black rounded-full" 
                    style={{ right: '35%', top: '40%' }}
                  />
                  <div className="absolute h-2 w-4 bg-black rounded-full"
                    style={{ bottom: '30%', left: '50%', transform: 'translateX(-50%)' }}
                  />
                </>
              )}
              
              {/* Stressed eyes */}
              {eyeState === 'stressed' && (
                <>
                  <div className="absolute h-2.5 w-2.5 flex items-center justify-center"
                    style={{ left: '35%', top: '40%' }}
                  >
                    <div className="h-3 w-0.5 bg-black absolute rotate-45" />
                    <div className="h-3 w-0.5 bg-black absolute -rotate-45" />
                  </div>
                  <div className="absolute h-2.5 w-2.5 flex items-center justify-center"
                    style={{ right: '35%', top: '40%' }}
                  >
                    <div className="h-3 w-0.5 bg-black absolute rotate-45" />
                    <div className="h-3 w-0.5 bg-black absolute -rotate-45" />
                  </div>
                </>
              )}
              
              {/* Happy eyes */}
              {eyeState === 'happy' && (
                <>
                  <div className="absolute h-2.5 w-2.5 border-b-2 border-black rounded-full" 
                    style={{ left: '35%', top: '40%' }}
                  />
                  <div className="absolute h-2.5 w-2.5 border-b-2 border-black rounded-full" 
                    style={{ right: '35%', top: '40%' }}
                  />
                  <div className="absolute h-1 w-4 bg-black rounded-full"
                    style={{ bottom: '35%', left: '50%', transform: 'translateX(-50%) rotate(10deg)' }}
                  />
                </>
              )}
              
              {/* Winking eye */}
              {eyeState === 'wink' && (
                <>
                  <div className="absolute h-0.5 w-2.5 bg-black rounded-full" 
                    style={{ left: '35%', top: '40%' }}
                  />
                  <div className="absolute h-2.5 w-2.5 bg-black rounded-full" 
                    style={{ right: '35%', top: '40%' }}
                  />
                </>
              )}
              
              {/* Surprised eyes */}
              {eyeState === 'surprised' && (
                <>
                  <div className="absolute h-3 w-3 bg-black rounded-full" 
                    style={{ left: '35%', top: '40%', transform: 'translate(-15%, -15%)' }}
                  />
                  <div className="absolute h-3 w-3 bg-black rounded-full" 
                    style={{ right: '35%', top: '40%', transform: 'translate(15%, -15%)' }}
                  />
                  <div className="absolute h-2 w-2 bg-black rounded-full"
                    style={{ bottom: '30%', left: '50%', transform: 'translateX(-50%)' }}
                  />
                </>
              )}
            </div>
          </div>
          
          {/* Input area */}
          <div className="p-3 md:p-4">
            <input 
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt,.md"
            />
            
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Describe the document you want to create..."
              className="w-full bg-[#1A1A1A] border-none text-white text-sm md:text-base resize-none min-h-[50px] md:min-h-[60px] focus:outline-none focus:ring-0 placeholder-gray-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              aria-label="Document description"
            />
            
            {/* Button Row */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Left Buttons */}
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="bg-[#B4916C] hover:bg-[#A3815C] text-white rounded-full px-2 md:px-3 h-8 md:h-9 flex items-center text-xs md:text-sm"
                      aria-label="Select document"
                    >
                      <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                      <span className="truncate max-w-[100px] md:max-w-[150px]">{selectedDocument || "Documents"}</span>
                      <ChevronDown className="h-3 w-3 ml-1" />
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