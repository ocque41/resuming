'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, FileText, User } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import DocumentSelector from './DocumentSelector';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

// Define types
type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
};

type AgentMode = 'analyze' | 'edit' | 'create';

export type Document = {
  id: string;
  name: string;
  type: string;
  s3Key?: string;
};

interface OpenAIAgentClientProps {
  documentId?: string;
  documentKey?: string;
  mode?: 'analyze' | 'edit' | 'create';
  className?: string;
}

export default function OpenAIAgentClient({
  documentId,
  documentKey,
  mode = 'analyze',
  className,
}: OpenAIAgentClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamData, setStreamData] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Add a welcome message when the component mounts
  useEffect(() => {
    const welcomeMessage = getWelcomeMessage(mode);
    setMessages([
      {
        id: 'welcome',
        content: welcomeMessage,
        role: 'assistant',
        createdAt: new Date(),
      },
    ]);
  }, [mode]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Process streaming data from the SSE connection
  const streamResponse = async (chatId: string) => {
    try {
      const eventSource = new EventSource(
        `/api/openai-agent?documentId=${documentId}&mode=${mode}`
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.content) {
            setStreamData((prev) => prev + data.content);
          }
        } catch (error) {
          console.error('Error parsing stream data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        setIsLoading(false);
      };

      eventSource.addEventListener('end', () => {
        eventSource.close();
        setIsLoading(false);
        
        // After streaming completes, add assistant message with complete response
        setMessages((prev) => [
          ...prev,
          {
            id: chatId,
            content: streamData,
            role: 'assistant',
            createdAt: new Date(),
          },
        ]);
        
        setStreamData('');
      });

      return () => {
        eventSource.close();
      };
    } catch (error: unknown) {
      console.error('Stream error:', error);
      setIsLoading(false);
      
      if (error instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Something went wrong during streaming',
        });
      }
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!documentId && mode !== 'create') {
      toast({
        variant: 'destructive',
        title: 'No document selected',
        description: 'Please select a document to chat about',
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      createdAt: new Date(),
    };

    // Update messages with user input
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // For non-streaming responses, use POST
      const response = await fetch('/api/openai-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          documentId,
          documentKey,
          mode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response from AI');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: Date.now().toString(),
        content: data.response,
        role: 'assistant',
        createdAt: new Date(),
      };

      // Add assistant response to messages
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      console.error('Error sending message:', error);
      
      if (error instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to get a response',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Get the appropriate welcome message based on the mode
  const getWelcomeMessage = (mode: string) => {
    switch (mode) {
      case 'analyze':
        return 'Hello! I can help you analyze your document. What would you like to know about it?';
      case 'edit':
        return 'Hello! I can help you edit and improve your document. What changes would you like to make?';
      case 'create':
        return 'Hello! I can help you create a new document. What would you like me to help you write?';
      default:
        return 'Hello! How can I assist you with your document today?';
    }
  };

  return (
    <div className={cn("flex flex-col h-[600px] rounded-md border", className)}>
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Avatar>
            <AvatarImage src="/bot-avatar.png" />
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium">OpenAI Agent</h3>
            <Badge variant="outline" className="text-xs">
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Badge>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start space-x-2",
                message.role === 'user' ? 'justify-end' : ''
              )}
            >
              {message.role === 'assistant' && (
                <Avatar className="mt-1">
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={cn(
                  "max-w-[80%] rounded-lg p-3",
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
              
              {message.role === 'user' && (
                <Avatar className="mt-1">
                  <AvatarFallback>
                    <User size={16} />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          
          {streamData && (
            <div className="flex items-start space-x-2">
              <Avatar className="mt-1">
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                <div className="whitespace-pre-wrap">{streamData}</div>
              </div>
            </div>
          )}
          
          {isLoading && !streamData && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t">
        <div className="flex items-end space-x-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 min-h-10 resize-none"
            rows={1}
            maxLength={4000}
            disabled={isLoading}
          />
          <Button 
            onClick={sendMessage} 
            size="icon" 
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 