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
  const [eyeState, setEyeState] = useState<'normal' | 'blink'>('normal');
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
  
  // Simple blinking animation
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setEyeState('blink');
      setTimeout(() => setEyeState('normal'), 200);
    }, 3000);
    
    return () => clearInterval(blinkInterval);
  }, []);
  
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const newMessage: Message = {
      role: "user",
      content: inputMessage,
    };
    
    setMessages((prev) => [...prev, newMessage]);
    setInputMessage("");
    
    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        role: "assistant",
        content: "I'm processing your request. This is a placeholder response.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
  };
  
  const handleSelectDocument = (id: string, fileName: string) => {
    setSelectedDocument(fileName);
    setSelectedDocumentId(id);
  };
  
  const handleDeselectDocument = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDocument(null);
    setSelectedDocumentId(null);
  };
  
  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type
    const supportedTypes = [
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
    
    if (!supportedTypes.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a supported document type.",
        variant: "destructive",
      });
      return;
    }
    
    // Check file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/document/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
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
      setSelectedDocument(data.fileName);
      setSelectedDocumentId(data.fileId);
      
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded successfully.",
      });
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your document.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
      {/* Logo and title */}
      <div ref={logoRef} className="w-16 h-16 bg-[#111111] rounded-full flex items-center justify-center mb-4">
        <div className="relative w-8 h-3">
          <div 
            className={`absolute w-3 h-3 bg-white rounded-full left-0 transform ${
              eyeState === 'blink' ? 'scale-y-[0.1]' : ''
            }`}
            style={{
              transform: `translate(${eyePosition.x * 2}px, ${eyePosition.y * 2}px) ${eyeState === 'blink' ? 'scaleY(0.1)' : ''}`,
            }}
          />
          <div 
            className={`absolute w-3 h-3 bg-white rounded-full right-0 transform ${
              eyeState === 'blink' ? 'scale-y-[0.1]' : ''
            }`}
            style={{
              transform: `translate(${eyePosition.x * 2}px, ${eyePosition.y * 2}px) ${eyeState === 'blink' ? 'scaleY(0.1)' : ''}`,
            }}
          />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-white mb-6">Let's Create</h1>
      
      {/* Main card */}
      <div className="w-full bg-[#1A1A1A] rounded-2xl p-4">
        {/* Input area */}
        <div className="space-y-4">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask a question..."
            className="w-full bg-[#111111] border-none text-white resize-none rounded-xl focus:ring-1 focus:ring-[#B4916C] focus-visible:ring-[#B4916C] focus-visible:ring-1"
            rows={3}
          />
          
          {/* Document selection and buttons */}
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className={`rounded-full text-xs px-3 py-1 h-auto border-[#B4916C]/30 ${
                    selectedDocument ? 'bg-[#B4916C]/20 text-[#B4916C]' : 'bg-transparent text-gray-400 hover:bg-[#B4916C]/10'
                  }`}
                >
                  {selectedDocument ? (
                    <div className="flex items-center">
                      <FileText className="h-3 w-3 mr-1" />
                      <span className="truncate max-w-[120px]">{selectedDocument}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 rounded-full hover:bg-[#B4916C]/20 p-0"
                        onClick={handleDeselectDocument}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <FileText className="h-3 w-3 mr-1" />
                      <span>Documents</span>
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-[#222222] border-[#333333] text-white">
                {documents.length > 0 ? (
                  documents.map((doc) => (
                    <DropdownMenuItem
                      key={doc.id}
                      onClick={() => handleSelectDocument(doc.id, doc.fileName)}
                      className="flex items-center py-2 px-3 hover:bg-[#333333] cursor-pointer"
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
  );
} 