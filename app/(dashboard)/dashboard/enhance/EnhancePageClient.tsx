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
import { Document } from '@/types/documents';

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// Update the eye state type to match the values we're using
type EyeState = 'normal' | 'blink' | 'excited' | 'thinking' | 'happy' | 'surprised' | 'blinking' | 'looking-left' | 'looking-right' | 'looking-up' | 'looking-down';

interface EnhancePageClientProps {
  documentsData: Array<Omit<Document, 'createdAt'> & { createdAt: string }>;
}

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
  const [documents, setDocuments] = useState<Document[]>(() => 
    documentsData.map(doc => ({
      ...doc,
      createdAt: new Date(doc.createdAt) // Convert string to Date
    }))
  );
  const { toast } = useToast();
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Scroll to bottom of messages when new ones are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Enhanced eye movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (characterRef.current && eyeState === 'normal') {
        const rect = characterRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Calculate distance from center
        const deltaX = e.clientX - centerX;
        const deltaY = e.clientY - centerY;
        
        // Limit eye movement range
        const maxMove = 3;
        const moveX = Math.min(Math.max(deltaX / 100, -maxMove), maxMove);
        const moveY = Math.min(Math.max(deltaY / 100, -maxMove), maxMove);
        
        // Smooth transition
        setEyePosition({
          x: moveX,
          y: moveY
        });
      }
    };

    // Random eye movement when mouse is not moving
    const randomEyeMovement = () => {
      if (eyeState === 'normal') {
        const randomX = (Math.random() - 0.5) * 4;
        const randomY = (Math.random() - 0.5) * 4;
        setEyePosition({ x: randomX, y: randomY });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    const interval = setInterval(randomEyeMovement, 3000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(interval);
    };
  }, [eyeState]);
  
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
    setSelectedDocument(documents.find(doc => doc.id === id) || null);
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
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setEyeState('thinking');

      // Create new document object
      const newDoc: Document = {
        id: Date.now().toString(), // Temporary ID
        fileName: file.name,
        createdAt: new Date(),
        size: file.size,
        type: file.type
      };

      // Add to documents list immediately for UI feedback
      setDocuments(prev => [newDoc, ...prev]);
      
      // Select the new document
      setSelectedDocument(newDoc);
      setMode('edit');

      // Reset states
      setIsUploading(false);
      setEyeState('happy');
      setTimeout(() => setEyeState('normal'), 1000);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
      setEyeState('normal');
    }
  };
  
  // Prevent dropdown from closing when selecting/deselecting
  const handleDocumentSelect = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDocument(doc);
    setMode('edit');
    // Don't close dropdown automatically
  };

  const handleDocumentDeselect = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDocument(null);
    setMode('create');
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
              <div ref={characterRef} className="relative">
                <div className="eyes-container">
                  <div className="eye" 
                    style={{
                      transform: `translate(${eyePosition.x}px, ${eyePosition.y}px)`,
                      transition: 'transform 0.3s ease-out'
                    }}>
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
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-[#B4916C] hover:bg-[#A3815C]"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
              
              {/* Document Dropdown (moved to the right) */}
              <div className="ml-auto">
                <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isDropdownOpen}
                      className="w-full justify-between"
                    >
                      {selectedDocument ? selectedDocument.fileName : "Select a document..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <div className="max-h-[300px] overflow-y-auto">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between px-4 py-2 hover:bg-[#1D1D1D] cursor-pointer"
                          onClick={(e) => handleDocumentSelect(doc, e)}
                        >
                          <span>{doc.fileName}</span>
                          {selectedDocument?.id === doc.id && (
                            <button
                              onClick={handleDocumentDeselect}
                              className="p-1 hover:bg-[#2D2D2D] rounded-full"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          
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