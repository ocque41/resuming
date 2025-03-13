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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// Define the Document interface properly
interface Document {
  id: string;
  fileName: string;
  createdAt: Date;
  content?: string;
  filePath?: string;
  type?: string;
  size?: number;
}

interface EnhancePageClientProps {
  documentsData: Document[];
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// Update the eye state type to match the values we're using
type EyeState = 'normal' | 'blink' | 'excited' | 'thinking' | 'happy' | 'surprised' | 'blinking' | 'looking-left' | 'looking-right' | 'looking-up' | 'looking-down';

export default function EnhancePageClient({ documentsData }: EnhancePageClientProps) {
  const [inputMessage, setInputMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [eyeState, setEyeState] = useState<EyeState>('normal');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState(documentsData.map(doc => ({
    id: doc.id,
    fileName: doc.fileName,
    createdAt: new Date(doc.createdAt)
  })));
  const { toast } = useToast();
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
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
  
  // Random animations at intervals
  useEffect(() => {
    const animationStates: EyeState[] = [
      'blink', 'excited', 'thinking', 'happy'
    ];
    
    const randomAnimation = () => {
      const randomState = animationStates[Math.floor(Math.random() * animationStates.length)];
      setEyeState(randomState);
      
      // Reset to normal after animation
      setTimeout(() => {
        setEyeState('normal');
      }, randomState === 'blink' ? 200 : 1000);
    };
    
    // Trigger random animations periodically
    const animationInterval = setInterval(() => {
      randomAnimation();
    }, 5000);
    
    return () => clearInterval(animationInterval);
  }, []);
  
  // Initialize with the correct mode based on whether a document is selected
  useEffect(() => {
    // If a document is already selected (e.g., from props), set edit mode
    if (selectedDocument) {
      setMode('edit');
    } else {
      setMode('create');
    }
  }, []);
  
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const newMessage: Message = {
      role: "user",
      content: inputMessage,
    };
    
    setMessages([...messages, newMessage]);
    setInputMessage("");
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        role: "assistant",
        content: "I'm processing your request. This is a placeholder response.",
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
    
    // Show excited animation when sending message
    setEyeState('excited');
    setTimeout(() => setEyeState('normal'), 1000);
  };
  
  const handleSelectDocument = (id: string, fileName: string) => {
    setSelectedDocument(documentsData.find(doc => doc.id === id) || null);
    setSelectedDocumentId(id);
    
    // Show happy animation when selecting document
    setEyeState('happy');
    setTimeout(() => setEyeState('normal'), 1000);
  };
  
  const handleDeselectDocument = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from opening
    setSelectedDocument(null);
    setSelectedDocumentId(null);
  };
  
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Show thinking animation during upload
    setEyeState('thinking');
    
    // Check file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      setEyeState('normal');
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
      'image/png'
    ];
    
    if (!SUPPORTED_TYPES.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF, Word, Excel, PowerPoint, text file, or image",
        variant: "destructive",
      });
      setEyeState('normal');
      return;
    }
    
    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
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
      
      // Auto-select the uploaded document
      setSelectedDocument(newDocument);
      setSelectedDocumentId(data.fileId);
      
      toast({
        title: "Document uploaded",
        description: `${data.fileName} has been uploaded successfully`,
      });
      
      // Show happy animation on success
      setEyeState('happy');
      setTimeout(() => setEyeState('normal'), 1000);
      
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
      
      // Show stressed animation on error
      setEyeState('thinking');
      setTimeout(() => setEyeState('normal'), 1000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Update the document selection handler
  const handleDocumentSelect = (documentId: string) => {
    const document = documentsData.find(doc => doc.id === documentId);
    if (document) {
      setSelectedDocument(document);
      setSelectedDocumentId(document.id);
      setMode('edit');
      
      // Add a message about the selected document
      setMessages(prev => [
        ...prev,
        {
          role: 'system',
          content: `Selected document: ${document.fileName}`
        },
        {
          role: 'assistant',
          content: `I've opened "${document.fileName}". What would you like to do with this document?`
        }
      ]);
      
      // Set happy eye state
      setEyeState('happy');
      setTimeout(() => setEyeState('normal'), 1000);
      
      // Scroll to bottom
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  };
  
  // Update the document deselection handler
  const handleDocumentDeselect = (e: React.MouseEvent) => {
    // Stop the event from propagating to the parent (which would select the document again)
    e.stopPropagation();
    
    // Only proceed if a document is actually selected
    if (!selectedDocument) return;
    
    setSelectedDocument(null);
    setSelectedDocumentId(null);
    setMode('create');
    
    // Add a message about deselecting the document
    setMessages(prev => [
      ...prev,
      {
        role: 'system',
        content: `Document deselected. You are now in create mode.`
      },
      {
        role: 'assistant',
        content: `I've closed the document. You're now in create mode. What would you like to create?`
      }
    ]);
    
    // Set eye state
    setEyeState('excited');
    setTimeout(() => setEyeState('normal'), 1000);
    
    // Scroll to bottom
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-3xl px-4">
        {/* Character */}
        <div className="flex justify-center mb-4">
          <div 
            ref={logoRef}
            className="w-16 h-16 bg-[#333333] rounded-full flex items-center justify-center"
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {eyeState === 'normal' && (
                <>
                  <div 
                    className="absolute w-2.5 h-2.5 bg-white rounded-full"
                    style={{ 
                      left: `calc(50% - 5px + ${eyePosition.x * 4}px)`,
                      top: `calc(50% + ${eyePosition.y * 4}px)`
                    }}
                  />
                  <div 
                    className="absolute w-2.5 h-2.5 bg-white rounded-full"
                    style={{ 
                      left: `calc(50% + 5px + ${eyePosition.x * 4}px)`,
                      top: `calc(50% + ${eyePosition.y * 4}px)`
                    }}
                  />
                </>
              )}
              
              {eyeState === 'blink' && (
                <>
                  <div className="absolute w-2.5 h-0.5 bg-white rounded-full" style={{ left: 'calc(50% - 5px)', top: '50%' }} />
                  <div className="absolute w-2.5 h-0.5 bg-white rounded-full" style={{ left: 'calc(50% + 5px)', top: '50%' }} />
                </>
              )}
              
              {eyeState === 'excited' && (
                <>
                  <div className="absolute w-2.5 h-2.5 bg-white rounded-full" style={{ left: 'calc(50% - 5px)', top: 'calc(50% - 2px)' }} />
                  <div className="absolute w-2.5 h-2.5 bg-white rounded-full" style={{ left: 'calc(50% + 5px)', top: 'calc(50% - 2px)' }} />
                </>
              )}
              
              {eyeState === 'thinking' && (
                <>
                  <div className="absolute w-2.5 h-2.5 bg-white rounded-full" style={{ left: 'calc(50% - 5px)', top: 'calc(50% + 2px)' }} />
                  <div className="absolute w-2 h-0.5 bg-white rounded-full" style={{ left: 'calc(50% + 5px)', top: '50%', transform: 'rotate(20deg)' }} />
                </>
              )}
              
              {eyeState === 'happy' && (
                <>
                  <div className="absolute w-2.5 h-1 bg-white rounded-full" style={{ left: 'calc(50% - 5px)', top: 'calc(50% - 1px)', transform: 'rotate(-10deg)' }} />
                  <div className="absolute w-2.5 h-1 bg-white rounded-full" style={{ left: 'calc(50% + 5px)', top: 'calc(50% - 1px)', transform: 'rotate(10deg)' }} />
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-center text-white mb-6">
          Let's Create
        </h1>
        
        {/* Main Card */}
        <div className="bg-[#1A1A1A] rounded-2xl p-4 md:p-6">
          {/* Input Area */}
          <div className="relative">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask a question..."
              className="min-h-[100px] w-full bg-[#111111] border-none text-white placeholder:text-gray-500 resize-none rounded-xl p-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            
            <div className="flex items-center mt-3">
              {/* Left Buttons */}
              <div className="flex items-center space-x-2">
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
              </div>
              
              {/* Document Dropdown (moved to the right) */}
              <div className="ml-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={`w-full justify-between bg-[#1D1D1D] border-[#333] text-white hover:bg-[#2D2D2D] hover:text-white ${
                        selectedDocument ? "bg-[#B4916C] hover:bg-[#A3815C] text-white" : "bg-[#222222] hover:bg-[#333333] text-white"
                      }`}
                    >
                      {selectedDocument ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate">{selectedDocument.fileName}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDocumentDeselect(e);
                            }}
                            className="ml-2 p-1 rounded-full hover:bg-[#333] transition-colors"
                            aria-label="Deselect document"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span>Documents</span>
                      )}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-[#1D1D1D] border-[#333] text-white">
                    <Command>
                      <CommandInput placeholder="Search documents..." className="bg-[#1D1D1D] text-white" />
                      <CommandEmpty>No documents found.</CommandEmpty>
                      <CommandGroup>
                        {documents.map((document) => (
                          <CommandItem
                            key={document.id}
                            value={document.id}
                            onSelect={() => handleDocumentSelect(document.id)}
                            className="cursor-pointer hover:bg-[#2D2D2D]"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedDocument === document ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">{document.fileName}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          
          {/* File input (hidden) */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.rtf,.jpg,.jpeg,.png"
          />
          
          {/* Messages area */}
          {messages.length > 0 && (
            <div 
              ref={messagesContainerRef}
              className="mt-4 space-y-2 md:space-y-3 px-1 md:px-2 max-h-[300px] overflow-y-auto"
            >
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