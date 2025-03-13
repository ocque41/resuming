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
        
        // Calculate distance from center (normalized)
        const distX = (e.clientX - logoCenterX) / (window.innerWidth / 2);
        const distY = (e.clientY - logoCenterY) / (window.innerHeight / 2);
        
        // Limit movement range
        const limitedX = Math.max(-0.5, Math.min(0.5, distX * 0.5));
        const limitedY = Math.max(-0.5, Math.min(0.5, distY * 0.5));
        
        setEyePosition({ x: limitedX, y: limitedY });
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  // Handle sending a message
  const handleSendMessage = () => {
    if (inputMessage.trim() === "") return;
    
    // Add user message
    const userMessage: Message = { role: "user", content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input
    setInputMessage("");
    
    // Trigger eye animation
    setEyeState('happy');
    setTimeout(() => setEyeState('normal'), 1000);
    
    // Simulate assistant response after a delay
    setTimeout(() => {
      let responseContent = "I'm here to help you enhance your documents. ";
      
      if (selectedDocument) {
        responseContent += `I see you've selected "${selectedDocument}". What would you like to do with it?`;
      } else {
        responseContent += "You can select a document from the dropdown or upload a new one to get started.";
      }
      
      const assistantMessage: Message = { role: "assistant", content: responseContent };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Trigger eye animation for response
      setEyeState('wink');
      setTimeout(() => setEyeState('normal'), 1000);
    }, 1000);
  };
  
  // Handle document selection
  const handleSelectDocument = (id: string, fileName: string) => {
    setSelectedDocument(fileName);
    setSelectedDocumentId(id);
    
    // Trigger eye animation
    setEyeState('surprised');
    setTimeout(() => setEyeState('normal'), 1000);
    
    // Add assistant message about document selection
    const assistantMessage: Message = { 
      role: "assistant", 
      content: `You've selected "${fileName}". What would you like me to help you with?` 
    };
    setMessages(prev => [...prev, assistantMessage]);
  };
  
  // Handle document deselection
  const handleDeselectDocument = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from opening
    setSelectedDocument(null);
    setSelectedDocumentId(null);
    
    // Trigger eye animation
    setEyeState('surprised');
    setTimeout(() => setEyeState('normal'), 1000);
    
    // Add assistant message about document deselection
    const assistantMessage: Message = { 
      role: "assistant", 
      content: "You've deselected the document. You can select another one or upload a new document." 
    };
    setMessages(prev => [...prev, assistantMessage]);
  };
  
  // Handle file upload button click
  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };
  
  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }
    
    // Check file type
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
    
    if (!SUPPORTED_TYPES.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF, Word, Excel, PowerPoint, text, or image file",
        variant: "destructive",
      });
      return;
    }
    
    // Set uploading state
    setIsUploading(true);
    setEyeState('stressed');
    
    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // Upload file
      const response = await fetch('/api/document/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload document');
      }
      
      const data = await response.json();
      
      // Add new document to list
      const newDocument = {
        id: data.fileId,
        fileName: data.fileName,
        createdAt: new Date(),
      };
      
      setDocuments(prev => [newDocument, ...prev]);
      
      // Select the newly uploaded document
      setSelectedDocument(data.fileName);
      setSelectedDocumentId(data.fileId);
      
      // Show success message
      toast({
        title: "Document uploaded",
        description: `${data.fileName} has been uploaded successfully`,
      });
      
      // Add assistant message
      const assistantMessage: Message = { 
        role: "assistant", 
        content: `I've uploaded "${data.fileName}" for you. What would you like to do with it?` 
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Change eye state to happy
      setEyeState('happy');
      setTimeout(() => setEyeState('normal'), 1000);
      
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
      
      // Change eye state to stressed
      setEyeState('stressed');
      setTimeout(() => setEyeState('normal'), 1000);
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4">
      {/* Character and title */}
      <div 
        ref={logoRef}
        className="w-16 h-16 bg-[#222222] rounded-full flex items-center justify-center mb-4"
      >
        <div className="relative w-full h-full">
          {/* Eyes */}
          <div 
            className="absolute left-1/3 top-1/2 w-2 h-2 bg-white rounded-full"
            style={{ 
              transform: `translate(${eyePosition.x * 4}px, ${eyePosition.y * 4 - 4}px)`,
              transition: eyeState === 'normal' ? 'transform 0.1s ease-out' : 'none'
            }}
          />
          <div 
            className="absolute right-1/3 top-1/2 w-2 h-2 bg-white rounded-full"
            style={{ 
              transform: `translate(${eyePosition.x * 4}px, ${eyePosition.y * 4 - 4}px)`,
              transition: eyeState === 'normal' ? 'transform 0.1s ease-out' : 'none'
            }}
          />
        </div>
      </div>
      
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Discover Smarter Search</h1>
      
      {/* Main card */}
      <div className="w-full max-w-3xl bg-[#111111] rounded-2xl p-4 md:p-6 shadow-lg">
        <div className="space-y-4">
          {/* Input area */}
          <div className="relative">
            <div className="rounded-2xl bg-[#1A1A1A] p-2 md:p-3">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask a question..."
                className="min-h-[80px] resize-none bg-transparent border-0 focus-visible:ring-0 text-white p-2 rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              
              {/* Document selection dropdown - moved below the input */}
              <div className="flex items-center mt-2 px-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="flex items-center justify-between bg-[#B4916C] hover:bg-[#A3815C] text-white text-xs md:text-sm h-8 px-3 rounded-full"
                    >
                      <div className="flex items-center">
                        <FileText className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                        <span className="max-w-[150px] truncate">
                          {selectedDocument || "Documents"}
                        </span>
                      </div>
                      {selectedDocument ? (
                        <X 
                          className="h-3 w-3 md:h-4 md:w-4 ml-2 hover:text-gray-200" 
                          onClick={handleDeselectDocument}
                        />
                      ) : (
                        <ChevronDown className="h-3 w-3 md:h-4 md:w-4 ml-2" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-[#222222] border border-[#333333] rounded-xl">
                    {documents.length > 0 ? (
                      documents.map((doc) => (
                        <DropdownMenuItem
                          key={doc.id}
                          onClick={() => handleSelectDocument(doc.id, doc.fileName)}
                          className="text-white hover:bg-[#333333] focus:bg-[#333333] rounded-lg cursor-pointer"
                        >
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-[#B4916C]" />
                            <div>
                              <div className="font-medium">{doc.fileName}</div>
                              <div className="text-xs text-gray-400">
                                {format(doc.createdAt, "MMM d, yyyy")}
                              </div>
                            </div>
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
                
                {/* File input (hidden) */}
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
                    className={`max-w-[90%] rounded-xl p-2 text-xs md:text-sm ${
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