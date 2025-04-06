"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Paperclip,
  Send,
  Globe,
  FileText,
  Link as LinkIcon,
  Check,
  ChevronDown
} from "lucide-react";
import AIAgent from "@/AIAgent";
import FileUploader from "../../../../FileUploader";
import { Button } from "@/components/ui/button";
import { sendMessageToAgent, streamMessageFromAgent, AgentMessage, AgentMode } from '@/lib/agent-api';

interface DocumentData {
  id: string;
  name: string;
  type: "document" | "cv";
  createdAt: string;
}

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
}

interface EnhancePageClientProps {
  documentsData?: DocumentData[];
}

export default function EnhancePageClient({
  documentsData: initialDocumentsData = []  // Provide a default value
}: EnhancePageClientProps) {
  // State management
  const [documentsData, setDocumentsData] = useState<DocumentData[]>(initialDocumentsData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDocumentsDropdownOpen, setIsDocumentsDropdownOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isMessageSending, setIsMessageSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [useAIAgentComponent, setUseAIAgentComponent] = useState(true);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  // Refs for input fields and auto-scrolling
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  
  // Backend Integration: fetch documents dynamically from API on mount
  useEffect(() => {
    async function fetchDocuments() {
      try {
        const response = await fetch("/api/documents");
        if (!response.ok) {
          console.error("API response not ok:", response.status, response.statusText);
          return;
        }
        const data = await response.json();
        // Log for debugging
        console.log("Fetched documents:", data);
        setDocumentsData(data.documents || []);
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      }
    }
    fetchDocuments();
  }, []);
  
  // Scroll to the bottom every time new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);
  
  // Focus on the appropriate input based on conversation state
  useEffect(() => {
    if (conversationStarted) {
      chatInputRef.current?.focus();
    } else {
      searchInputRef.current?.focus();
    }
  }, [conversationStarted]);
  
  // Handler to send a message
  const handleSendRequest = async () => {
    if (!searchQuery.trim() || isMessageSending) {
      return;
    }
    
    setChatError(null);
    
    // Create a new user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: searchQuery,
      role: "user",
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    const query = searchQuery;
    setSearchQuery('');
    setConversationStarted(true);
    setIsMessageSending(true);
    
    // Create a placeholder for the assistant's response
    const assistantMessageId = (Date.now() + 1).toString();
    setChatMessages(prev => [
      ...prev, 
      {
        id: assistantMessageId,
        content: "",
        role: "assistant",
        timestamp: new Date().toISOString()
      }
    ]);
    
    try {
      // Connect to the OpenAI Agent backend
      const response = await fetch("/api/agent/enhance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: query,
          documentId: selectedDocument?.id || null,
          mode: selectedDocument ? "edit" : "create",
          stream: true // Enable streaming
        })
      });
      
      if (!response.ok) {
        throw new Error(`API returned status code ${response.status}`);
      }
      
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to get reader from response");
        
        const decoder = new TextDecoder();
        let responseText = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          responseText += chunk;
          
          // Update the message content with the cumulative text
          setChatMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessageId
                ? { ...msg, content: responseText }
                : msg
            )
          );
        }
      } else {
        // Handle regular JSON response
        const data = await response.json();
        
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessageId
              ? { ...msg, content: data.response || "Sorry, I couldn't process your request." }
              : msg
          )
        );
      }
    } catch (error: any) {
      console.error("Error sending message to agent:", error);
      setChatError("Failed to get response. Please try again.");
      
      // Update the message to show error
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId
            ? { ...msg, content: "Sorry, I encountered an error while processing your request." }
            : msg
        )
      );
    }
    
    setIsMessageSending(false);
  };
  
  // Handler for file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    console.log("File selected:", file.name);
    
    const newDocument: DocumentData = {
      id: `upload-${Date.now()}`,
      name: file.name,
      type: file.name.endsWith('.pdf') ? 'document' : 'cv',
      createdAt: new Date().toISOString()
    };
    
    setDocumentsData(prev => [...prev, newDocument]);
    
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      content: `File "${file.name}" uploaded successfully. You can now ask questions or edit this document.`,
      role: "assistant",
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, systemMessage]);
  };
  
  // Handler for S3 upload completion
  const handleUploadComplete = async (s3Key: string) => {
    console.log("File uploaded to S3:", s3Key);
    
    try {
      // Extract file name and type from s3Key
      const fileName = s3Key.split('/').pop() || 'Unknown file';
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
      
      // Map extension to MIME type
      const mimeTypeMap: { [key: string]: string } = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'txt': 'text/plain'
      };
      
      const fileType = mimeTypeMap[fileExtension] || 'application/octet-stream';
      
      // Create a new document in the database using API
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          s3Key,
          fileName,
          fileType,
          metadata: {
            uploadedVia: 'enhance-page',
            uploadedAt: new Date().toISOString()
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save document: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.document) {
        throw new Error('Invalid response from server when creating document');
      }
      
      // Refresh the documents list
      setDocumentsData(prevDocs => [data.document, ...prevDocs]);
      
      // Select the new document
      setSelectedDocument(data.document);
      
      // Show success message in chat
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        content: `File "${fileName}" uploaded and saved successfully. You can now ask questions about this document.`,
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, systemMessage]);
      
    } catch (error) {
      console.error('Error saving document to database:', error);
      
      // Show error message in chat
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        content: `Error: Document was uploaded to storage but could not be saved to database. ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: "assistant",
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };
  
  const createDocument = async (prompt: string, template: string = 'blank') => {
    try {
      setLoading(true);
      const response = await fetch('/api/agent/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          role: 'creator',
          document: {
            template,
            title: 'New Document',
            content: '',
            type: 'markdown'
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create document');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // Variants for animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };
  
  // Create a simple toggle function
  const toggleChatImplementation = () => {
    setUseAIAgentComponent(prev => !prev);
  };
  
  /**
   * Send a message to the agent and handle the response
   */
  const sendMessage = async (content: string, mode: AgentMode = 'edit') => {
    if (!content.trim() || isAgentLoading) return;

    const userMessage: AgentMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsAgentLoading(true);
    setAgentError(null);

    try {
      // Use either the document ID from state or undefined
      const documentId = selectedDocument ? selectedDocument.id : undefined;

      // Option 1: Non-streaming response
      const response = await sendMessageToAgent({
        mode,
        messages: [...messages, userMessage],
        documentId
      });

      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: response.message
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Option 2: Streaming response (uncomment to use)
      /*
      let streamedContent = '';
      
      await streamMessageFromAgent(
        {
          mode,
          messages: [...messages, userMessage],
          documentId
        },
        (chunk) => {
          streamedContent += chunk;
          
          // Update UI with partial response
          setMessages(prev => {
            const newMessages = [...prev];
            // If we already have an assistant message, update it
            if (newMessages[newMessages.length - 1]?.role === 'assistant') {
              newMessages[newMessages.length - 1].content = streamedContent;
            } else {
              // Otherwise add a new assistant message
              newMessages.push({
                role: 'assistant',
                content: streamedContent
              });
            }
            return newMessages;
          });
        },
        (fullResponse) => {
          // Update is complete
          console.log('Streaming complete', fullResponse);
        },
        (error) => {
          console.error('Streaming error:', error);
          setAgentError(`Error: ${error.message}`);
        }
      );
      */
    } catch (error) {
      console.error('Error sending message:', error);
      setAgentError(`Failed to get response: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAgentLoading(false);
    }
  };
  
    return (
    <div className="flex flex-col w-full h-full min-h-screen">
      {/* Header section - keep unchanged */}
      <header className="border-b border-[#222222] py-6 px-6 flex justify-between items-center bg-[#0A0A0A]">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-[#B4916C] hover:text-[#D2B48C] transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl text-[#F9F6EE] font-safiro">Document Enhancer</h1>
        </div>
        <div className="flex items-center space-x-2">
          {/* If we want to add any header controls or info */}
        </div>
      </header>
      
      {/* Main content - keep structure but conditionally render either AIAgent or custom implementation */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Document selection sidebar - keep unchanged */}
        <div className="w-full md:w-80 lg:w-96 border-r border-[#222222] bg-[#0A0A0A] p-4 overflow-hidden flex flex-col">
          {/* Keep existing document selection sidebar implementation */}
          {/* ... */}
        </div>
        
        {/* Chat interface - conditionally render AIAgent or original implementation */}
        <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden relative">
          {useAIAgentComponent ? (
            // Use AIAgent component
            <div className="flex-1 p-4 overflow-auto">
              <AIAgent 
                documentId={selectedDocument?.id}
                initialMode={selectedDocument ? "analyze" : "create"}
              />
              
              {/* Optional debug toggle - can remove in production */}
              <div className="mt-4 text-xs text-gray-500">
                <button 
                  onClick={toggleChatImplementation}
                  className="text-[#B4916C] hover:text-[#D2B48C] underline"
                >
                  Switch to classic interface
                </button>
              </div>
                      </div>
          ) : (
            // Original chat implementation
            <div className="flex-1 flex flex-col p-6">
              {/* Existing chat interface - keep unchanged */}
              {/* ... */}
              
              {/* Optional debug toggle - can remove in production */}
              <div className="mt-4 text-xs text-gray-500">
                <button 
                  onClick={toggleChatImplementation}
                  className="text-[#B4916C] hover:text-[#D2B48C] underline"
                >
                  Switch to AIAgent interface
                </button>
                  </div>
            </div>
        )}
      </div>
        </div>
      </div>
    );
}