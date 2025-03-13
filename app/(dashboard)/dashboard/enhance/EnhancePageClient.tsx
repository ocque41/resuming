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

// Update the eye state type to include all animation states
type EyeState = 'normal' | 'blink' | 'excited' | 'thinking' | 'happy' | 'look-around' | 'wink';

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
    playAnimationSequence('messageSend');
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
        
        {/* Search container - exactly matching image layout */}
        <div className="w-full max-w-2xl bg-[#0A0A0A] rounded-3xl p-6">
          {/* Input field - styled exactly like image */}
          <div className="relative mb-6">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={placeholders[placeholderIndex]}
              className="w-full bg-[#1A1A1A] rounded-2xl px-6 py-5 
                focus:outline-none focus:ring-1 focus:ring-[#2D2D2D]
                transition-all duration-300
                placeholder-gray-500 text-lg"
              style={{ 
                opacity: placeholderOpacity, 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
              }}
            />
          </div>
          
          {/* Controls - positioned exactly as in image */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Speed button with dropdown */}
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-[#050505] hover:bg-[#1A1A1A] rounded-xl px-4 py-2 
                  flex items-center justify-center border border-[#2D2D2D]
                  transition-all duration-300"
              >
                <svg className="h-5 w-5 text-[#B4916C] mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 5L21 12L13 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Speed</span>
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
              />
              
              {/* Search button */}
              <Button
                onClick={() => setIsDropdownOpen(true)}
                className="bg-[#1D1D1D] hover:bg-[#2D2D2D] rounded-xl px-4 py-2
                  flex items-center justify-center
                  transition-all duration-300"
              >
                <svg className="h-5 w-5 text-[#B4916C] mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Search</span>
              </Button>
              
              {/* Document selection popover */}
              <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <PopoverContent className="w-[250px] p-0 rounded-xl border-[#2D2D2D] bg-[#050505]">
                  <div className="max-h-[300px] overflow-y-auto">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between px-4 py-2 hover:bg-[#1D1D1D] cursor-pointer"
                        onClick={(e) => handleDocumentSelect(doc, e)}
                      >
                        <span className="text-white">{doc.fileName}</span>
                        {selectedDocument?.id === doc.id && (
                          <button
                            onClick={handleDocumentDeselect}
                            className="p-1 hover:bg-[#2D2D2D] rounded-xl"
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
            
            {/* Action buttons on the right - exactly as in image */}
            <div className="flex items-center space-x-2">
              <Button
                className="bg-transparent hover:bg-[#1A1A1A] rounded-full w-10 h-10
                  flex items-center justify-center
                  transition-all duration-300"
              >
                <Paperclip className="h-5 w-5 text-[#B4916C]" />
              </Button>
              
              <Button
                className="bg-transparent hover:bg-[#1A1A1A] rounded-full w-10 h-10
                  flex items-center justify-center
                  transition-all duration-300"
              >
                <svg className="h-5 w-5 text-[#B4916C]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M5 12L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 