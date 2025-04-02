'use client';

import React, { useState } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

/**
 * Simple component to test the AI Document Agent
 * This component doesn't require a document and sends messages in "create" mode
 */
export default function SimpleAITest() {
  const [messages, setMessages] = useState<Array<Message>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    // Add user message to the conversation
    const newUserMessage: Message = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Call the API endpoint
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: newUserMessage.content,
          mode: 'create',
          // No documentId or s3Key to test simple messages
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add assistant response to the conversation
      setMessages(prev => [...prev, { 
        role: 'assistant' as const, 
        content: data.response || 'No response received' 
      }]);
    } catch (error) {
      console.error('Error calling AI agent:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="max-w-md mx-auto p-4 bg-gray-50 rounded-md shadow-md">
      <h2 className="text-xl font-bold mb-4">AI Agent Test</h2>
      
      <div className="h-80 overflow-y-auto mb-4 p-3 bg-white border border-gray-200 rounded">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center mt-32">Send a message to start the conversation</p>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index}
              className={`mb-3 p-2 rounded ${
                msg.role === 'user' 
                  ? 'bg-blue-100 text-right' 
                  : 'bg-gray-100'
              }`}
            >
              <span className="font-medium">{msg.role === 'user' ? 'You' : 'AI'}: </span>
              {msg.content}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="text-center p-2 bg-gray-100 rounded">
            <span className="inline-block animate-pulse">AI is thinking...</span>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}
      
      <div className="flex">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 border border-gray-300 rounded-l"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={isLoading}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded-r disabled:bg-blue-300"
        >
          Send
        </button>
      </div>
      
      <p className="mt-4 text-xs text-gray-500">
        This component is designed to test the AI Agent API without requiring a document.
        It always uses "create" mode for testing.
      </p>
    </div>
  );
} 