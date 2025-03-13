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
import { interactWithAssistant, streamWithAssistant } from '@/app/lib/agents/openai-agent';

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// Update the eye state type to include all animation states
type EyeState = 'normal' | 'blink' | 'excited' | 'thinking' | 'happy' | 'look-around' | 'wink';

interface DocumentItem {
  id: string;
  fileName?: string;
  name?: string;
  type?: string;
  createdAt?: string;
}

interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
}

interface EnhancePageClientProps {
  documentsData: DocumentData[];
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export default function EnhancePageClient({ documentsData = [] }: EnhancePageClientProps) {
  const [inputMessage, setInputMessage] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [eyePosition, setEyePosition] = useState({ x: 0, y: 0 });
  const [eyeState, setEyeState] = useState<EyeState>('normal');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>(documentsData.map(data => ({
    id: data.id,
    name: data.name,
    type: data.type,
    createdAt: data.createdAt
  })));
  const { toast } = useToast();
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [placeholderOpacity, setPlaceholderOpacity] = useState(1);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholders = [
    "Transform your PDF into an engaging presentation...",
    "Convert complex Excel data into a clear report...",
    "Enhance your Word document with professional formatting...",
    "Create compelling slides from your document...",
    "Optimize your spreadsheet for better readability..."
  ];
  const [title, setTitle] = useState("Let's Create");
  
  const animationPresets = {
    documentSelect: {
      eyes: 'excited' as EyeState,
      duration: 1000,
      sequence: ['look-around', 'excited', 'normal'] as EyeState[]
    },
    documentUpload: {
      eyes: 'thinking' as EyeState,
      duration: 1500,
      sequence: ['excited', 'thinking', 'happy', 'normal'] as EyeState[]
    },
    messageSend: {
      eyes: 'thinking' as EyeState,
      duration: 800,
      sequence: ['excited', 'thinking', 'normal'] as EyeState[]
    }
  };

  const playAnimationSequence = (preset: keyof typeof animationPresets) => {
    const { sequence, duration } = animationPresets[preset];
    
    sequence.forEach((animation, index) => {
      setTimeout(() => {
        setEyeState(animation);
      }, (duration / sequence.length) * index);
    });
  };
  
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
  
  // Enhanced placeholder rotation with fade effect
  useEffect(() => {
    // Simulate initial loading
    setTimeout(() => setIsLoading(false), 1500);

    const rotatePlaceholder = () => {
      setPlaceholderOpacity(0);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        setPlaceholderOpacity(1);
      }, 200);
    };

    const interval = setInterval(rotatePlaceholder, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Update title when mode changes
  useEffect(() => {
    setTitle(mode === 'edit' ? "Let's Edit" : "Let's Create");
  }, [mode]);
  
  // Add error state
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Initialize with welcome message
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: 'Hello! I can help you create, edit, and analyze documents. What would you like to do today?',
        timestamp: new Date()
      }
    ]);
  }, []);
  
  // Handle sending messages
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsProcessing(true);
    
    try {
      // Get context for the assistant
      const context = {
        selectedDocument: selectedDocument ? {
          id: selectedDocument.id,
          name: selectedDocument.fileName
        } : null
      };
      
      // Create message history for the assistant
      const messageHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add a temporary message for streaming
      const tempMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, tempMessage]);
      
      // Stream the response
      await streamWithAssistant(
        userMessage.content,
        context,
        messageHistory,
        (chunk) => {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content += chunk;
            }
            return newMessages;
          });
        }
      );
      
      setIsProcessing(false);
    } catch (error) {
      console.error('Error getting response from assistant:', error);
      setError('Failed to get a response. Please try again.');
      setIsProcessing(false);
    }
  };
  
  const handleSelectDocument = (id: string, fileName: string) => {
    setSelectedDocument(documents.find(doc => doc.id === id) || null);
    setSelectedDocumentId(id);
    
    // Show happy animation when selecting document
    playAnimationSequence('documentSelect');
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
      const newDoc: DocumentItem = {
        id: Date.now().toString(), // Temporary ID
        fileName: file.name,
        createdAt: new Date().toISOString(),
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
  const handleDocumentSelect = (doc: DocumentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDocument(doc);
    setMode('edit');
    playAnimationSequence('documentSelect');
  };

  const handleDocumentDeselect = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDocument(null);
    setMode('create');
  };
  
  const getEyeStyle = () => {
    // Return styles without transform property
    switch (eyeState) {
      case 'blink':
        return { height: '0px', transition: 'height 0.1s ease-in-out' };
      case 'excited':
        return { height: '4px', width: '4px', transition: 'all 0.2s ease-in-out' };
      case 'thinking':
        return { height: '1px', transition: 'height 0.2s ease-in-out' };
      case 'happy':
        return { height: '1px', borderRadius: '0 0 100% 100%', transition: 'all 0.2s ease-in-out' };
      case 'look-around':
        // No transform here, handled separately
        return { transition: 'all 0.3s ease-in-out' };
      case 'wink':
        return { height: eyePosition.x % 2 === 0 ? '0px' : '2px', transition: 'height 0.1s ease-in-out' };
      default:
        return { transition: 'all 0.2s ease-in-out' };
    }
  };

  // Add random eye animations
  useEffect(() => {
    // Random blinks
    const blinkInterval = setInterval(() => {
      if (eyeState === 'normal') {
        setEyeState('blink');
        setTimeout(() => setEyeState('normal'), 150);
      }
    }, Math.random() * 3000 + 2000);
    
    // Random winks
    const winkInterval = setInterval(() => {
      if (eyeState === 'normal') {
        setEyeState('wink');
        setTimeout(() => setEyeState('normal'), 300);
      }
    }, Math.random() * 15000 + 10000);
    
    // Random look around
    const lookAroundInterval = setInterval(() => {
      if (eyeState === 'normal') {
        setEyeState('look-around');
        setTimeout(() => setEyeState('normal'), 1200);
      }
    }, Math.random() * 8000 + 5000);
    
    return () => {
      clearInterval(blinkInterval);
      clearInterval(winkInterval);
      clearInterval(lookAroundInterval);
    };
  }, [eyeState]);

  // Add a state to track if documents are loading
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  
  // Handle empty documents state
  useEffect(() => {
    if (documentsData.length === 0 && !error) {
      setError("No documents found. Try uploading a document using the paperclip button.");
    }
  }, [documentsData, error]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-t-2 border-[#B4916C] rounded-full animate-spin" />
            <div className="absolute inset-1 border-t-2 border-[#B4916C] rounded-full animate-spin-slow" />
          </div>
          <p className="text-[#B4916C] animate-pulse">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 md:p-8">
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-md p-3 mb-4 max-w-3xl mx-auto">
          <p className="text-red-400">{error}</p>
        </div>
      )}
      
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
        {/* Character/Logo with eyes - exactly as in image */}
        <div 
          ref={characterRef}
          className="mb-10 relative w-16 h-16 bg-[#1A1A1A] rounded-full flex items-center justify-center"
        >
          <div className="flex space-x-4">
            <div 
              className="w-2 h-2 bg-white rounded-full"
              style={{
                transform: `translate(${eyePosition.x}px, ${eyePosition.y}px)`,
                ...getEyeStyle()
              }}
            />
            <div 
              className="w-2 h-2 bg-white rounded-full"
              style={{
                transform: `translate(${eyePosition.x}px, ${eyePosition.y}px)`,
                ...getEyeStyle()
              }}
            />
          </div>
        </div>
        
        {/* Title - exactly as in image */}
        <h1 className="text-5xl font-bold mb-16 text-center">
          {title}
        </h1>
        
        {/* Chat messages */}
        <div className="w-full max-w-2xl mb-6 max-h-[50vh] overflow-y-auto">
          {messages.map((message, index) => (
            <div 
              key={index}
              className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
            >
              <div 
                className={`inline-block px-4 py-2 rounded-xl ${
                  message.role === 'user' 
                    ? 'bg-[#B4916C] text-white' 
                    : 'bg-[#1A1A1A] text-white'
                }`}
              >
                {message.content}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="text-left mb-4">
              <div className="inline-block px-4 py-2 rounded-xl bg-[#1A1A1A]">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-[#B4916C] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#B4916C] rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-[#B4916C] rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Input field - styled exactly like image */}
        <div className="w-full max-w-2xl">
          <div className="relative mb-6">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={placeholders[placeholderIndex]}
              className="w-full bg-[#1A1A1A] rounded-2xl px-6 py-5 
                focus:outline-none focus:ring-1 focus:ring-[#2D2D2D]
                text-white placeholder-gray-500"
            />
          </div>
          
          {/* Controls below input */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Documents dropdown button */}
              <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isDropdownOpen}
                    className="bg-[#050505] hover:bg-[#1A1A1A] rounded-xl px-4 py-2 
                      flex items-center justify-center border border-[#2D2D2D]
                      transition-all duration-300"
                    disabled={isDocumentsLoading || documents.length === 0}
                  >
                    <svg className="h-5 w-5 text-[#B4916C] mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13 5L21 12L13 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{isDocumentsLoading ? "Loading..." : "Documents"}</span>
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0 rounded-xl border-[#2D2D2D] bg-[#050505]">
                  <div className="max-h-[300px] overflow-y-auto">
                    {documents.length > 0 ? (
                      documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between px-4 py-2 hover:bg-[#1D1D1D] cursor-pointer"
                          onClick={(e) => handleDocumentSelect(doc, e)}
                        >
                          <span className="text-white">{doc.fileName || doc.name || "Untitled"}</span>
                          {selectedDocument?.id === doc.id && (
                            <button
                              onClick={handleDocumentDeselect}
                              className="p-1 hover:bg-[#2D2D2D] rounded-xl"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-400">
                        No documents found
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
              />
            </div>
            
            {/* Send button on the right */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-transparent hover:bg-[#1A1A1A] rounded-full w-10 h-10
                  flex items-center justify-center
                  transition-all duration-300"
              >
                <Paperclip className="h-5 w-5 text-[#B4916C]" />
              </Button>
              
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isProcessing}
                className="bg-transparent hover:bg-[#1A1A1A] rounded-full w-10 h-10
                  flex items-center justify-center
                  transition-all duration-300"
              >
                <Send className="h-5 w-5 text-[#B4916C]" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 