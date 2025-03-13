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
  
  const handleDeselectDocument = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from opening
    setSelectedDocument(null);
    setSelectedDocumentId(null);
    
    // Add a message about deselecting the document
    setMessages(prev => [
      ...prev, 
      { 
        role: "assistant", 
        content: "I've removed the reference document. What would you like to create now?" 
      }
    ]);
    
    // Show surprised eyes briefly when deselecting a document
    setEyeState('surprised');
    setTimeout(() => setEyeState('normal'), 600);
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
      
      // Add the new document to the list
      const newDocument = {
        id: data.id,
        fileName: data.fileName,
        createdAt: new Date(data.createdAt)
      };
      
      setDocuments(prev => [newDocument, ...prev]);
      
      // Select the newly uploaded document
      setSelectedDocument(data.fileName);
      setSelectedDocumentId(data.id);
      
      // Show success message
      toast({
        title: "Document uploaded",
        description: `${data.fileName} has been uploaded successfully.`,
      });
      
      // Add a message about the uploaded document
      setMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: `I've uploaded "${data.fileName}" for you. How would you like to enhance it?` 
        }
      ]);
      
      // Show happy eyes when upload is successful
      setEyeState('happy');
      setTimeout(() => setEyeState('normal'), 1000);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive"
      });
      
      // Show stressed eyes when upload fails
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
    <div className="flex flex-col items-center justify-center min-h-screen py-10 px-4">
      <div className="w-full max-w-md mx-auto">
        {/* Character above title */}
        <div className="flex justify-center mb-4">
          <div 
            ref={logoRef}
            className="relative w-16 h-16 bg-[#B4916C] rounded-full flex items-center justify-center"
          >
            {/* Eyes */}
            <div className="absolute" style={{ 
              top: '35%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              width: '70%',
              height: '30%',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              {/* Left Eye */}
              <div className="relative w-4 h-4 bg-white rounded-full overflow-hidden">
                {eyeState === 'normal' && (
                  <div 
                    className="absolute w-2 h-2 bg-black rounded-full"
                    style={{ 
                      top: `calc(50% + ${eyePosition.y}px)`, 
                      left: `calc(50% + ${eyePosition.x}px)`, 
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                )}
                {eyeState === 'yawning' && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-1 bg-black rounded-full" />
                )}
                {eyeState === 'stressed' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-black text-xs font-bold">×</div>
                  </div>
                )}
                {eyeState === 'happy' && (
                  <div className="absolute bottom-0 w-full h-2 bg-white rounded-t-full" />
                )}
                {eyeState === 'wink' && (
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-black" />
                )}
                {eyeState === 'surprised' && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-black rounded-full" />
                )}
              </div>
              
              {/* Right Eye */}
              <div className="relative w-4 h-4 bg-white rounded-full overflow-hidden">
                {eyeState === 'normal' && (
                  <div 
                    className="absolute w-2 h-2 bg-black rounded-full"
                    style={{ 
                      top: `calc(50% + ${eyePosition.y}px)`, 
                      left: `calc(50% + ${eyePosition.x}px)`, 
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                )}
                {eyeState === 'yawning' && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-1 bg-black rounded-full" />
                )}
                {eyeState === 'stressed' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-black text-xs font-bold">×</div>
                  </div>
                )}
                {eyeState === 'happy' && (
                  <div className="absolute bottom-0 w-full h-2 bg-white rounded-t-full" />
                )}
                {eyeState === 'wink' && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-black rounded-full" />
                )}
                {eyeState === 'surprised' && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-black rounded-full" />
                )}
              </div>
            </div>
            
            {/* Mouth */}
            <div className="absolute" style={{ top: '65%', left: '50%', transform: 'translateX(-50%)' }}>
              {eyeState === 'yawning' && (
                <div className="w-4 h-4 bg-black rounded-full" />
              )}
              {eyeState === 'happy' && (
                <div className="w-6 h-3 border-b-2 border-black rounded-b-full" />
              )}
              {eyeState === 'surprised' && (
                <div className="w-3 h-3 bg-black rounded-full" />
              )}
            </div>
          </div>
        </div>
        
        {/* Title */}
        <h1 className="text-xl md:text-2xl font-bold text-center text-white mb-4">
          Let's make a document
        </h1>
        
        <div className="bg-[#111111] rounded-lg shadow-lg p-4 md:p-5">
          <div className="space-y-3">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={handleFileChange}
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
                      <span className="truncate max-w-[100px] md:max-w-[150px]">
                        {selectedDocument || "Documents"}
                      </span>
                      {selectedDocument ? (
                        <X 
                          className="h-3 w-3 ml-1 hover:text-gray-300" 
                          onClick={handleDeselectDocument}
                          aria-label="Deselect document"
                        />
                      ) : (
                        <ChevronDown className="h-3 w-3 ml-1" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-[#2A2A2A] border-[#444444] text-white">
                    {documents.length > 0 ? (
                      documents.map((doc) => (
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