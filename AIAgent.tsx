import React, { useState, useEffect } from 'react';
import { Send, Paperclip, Loader } from 'lucide-react';

interface AIAgentProps {
  documentId?: string;
  documentKey?: string;
  initialMode?: 'analyze' | 'edit' | 'create';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const AIAgent: React.FC<AIAgentProps> = ({ 
  documentId, 
  documentKey,
  initialMode = 'analyze'
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'analyze' | 'edit' | 'create'>(initialMode);

  // Function to detect if a message is a simple greeting
  const isSimpleGreeting = (message: string): boolean => {
    return /^(hello|hi|hey|greetings|howdy)(\s.*)?$/i.test(message.trim());
  };

  // Automatically switch to create mode if no document is selected
  useEffect(() => {
    if (!documentId && !documentKey && mode !== 'create') {
      setMode('create');
    }
  }, [documentId, documentKey, mode]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const trimmedInput = inputValue.trim();
    const shouldUseCreateMode = mode === 'create' || 
      (!documentId && !documentKey) || 
      isSimpleGreeting(trimmedInput);
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmedInput,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Use create mode for greetings or when no document is available
      const effectiveMode = shouldUseCreateMode ? 'create' : mode;
      
      // Determine if we should use documentId or documentKey (S3 key)
      const payload: any = {
        message: userMessage.content,
        mode: effectiveMode,
      };
      
      // Only add document references if not a simple greeting and we have them
      if (!isSimpleGreeting(trimmedInput)) {
        // Add either documentId or s3Key depending on what's available
        if (documentId) {
          payload.documentId = documentId;
        } else if (documentKey) {
          payload.s3Key = documentKey;
        }
      }
      
      console.log('Sending request to agent:', {
        message: trimmedInput.substring(0, 20) + (trimmedInput.length > 20 ? '...' : ''),
        mode: effectiveMode,
        hasDocumentId: !!payload.documentId,
        hasS3Key: !!payload.s3Key,
        isSimpleGreeting: isSimpleGreeting(trimmedInput)
      });
      
      // Call API endpoint
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response from agent');
      }
      
      const data = await response.json();
      
      // Add assistant message to chat
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || 'I couldn\'t process that request.',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error communicating with agent:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">AI Document Assistant</h3>
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 rounded text-sm ${mode === 'analyze' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setMode('analyze')}
            disabled={!documentId && !documentKey}
            title={!documentId && !documentKey ? 'Requires a document' : 'Analyze document'}
          >
            Analyze
          </button>
          <button
            className={`px-3 py-1 rounded text-sm ${mode === 'edit' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setMode('edit')}
            disabled={!documentId && !documentKey}
            title={!documentId && !documentKey ? 'Requires a document' : 'Edit document'}
          >
            Edit
          </button>
          <button
            className={`px-3 py-1 rounded text-sm ${mode === 'create' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setMode('create')}
          >
            Create
          </button>
        </div>
      </div>
      
      <div className="h-64 overflow-y-auto mb-4 p-3 border border-gray-200 rounded bg-white">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center mt-24">
            {!documentId && !documentKey 
              ? "No document selected. You can still say 'Hello' or ask for help."
              : "Start a conversation with the AI Assistant"
            }
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={`mb-3 p-2 rounded-lg max-w-[80%] ${
                msg.role === 'user' 
                  ? 'bg-blue-100 ml-auto' 
                  : 'bg-gray-100'
              }`}
            >
              <div className="text-sm font-medium mb-1">
                {msg.role === 'user' ? 'You' : 'AI Assistant'}
              </div>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex items-center justify-center mt-4">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            <span className="ml-2 text-sm text-gray-500">Thinking...</span>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      
      <div className="flex items-center">
        <input
          type="text"
          className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={!documentId && !documentKey 
            ? "Type 'Hello' or ask a question..." 
            : `Ask a question or give instructions (${mode} mode)...`
          }
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={isLoading}
        />
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-md disabled:opacity-50"
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isLoading}
        >
          {isLoading ? (
            <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
};

export default AIAgent; 