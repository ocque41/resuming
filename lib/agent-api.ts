/**
 * Agent API connector for the AI Document Agent
 * Handles communication with the backend agent service
 */

// API configuration
const API_URL = process.env.NEXT_PUBLIC_AGENT_API_URL || 'https://api.resuming.ai/agent';
const API_KEY = process.env.NEXT_PUBLIC_AGENT_API_KEY || 'default-key';

// Enable debug mode for development
const DEBUG = process.env.NODE_ENV === 'development';

// Types
export type AgentMode = 'analyze' | 'edit' | 'create';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
}

export interface AgentRequest {
  mode: AgentMode;
  messages: AgentMessage[];
  documentId?: string;
  instruction?: string;
  stream?: boolean;
}

export interface AgentResponse {
  message: AgentMessage;
  document?: any;
}

// Mock implementation for local development and testing
const mockResponses = {
  greetings: [
    "Hello! I'm your AI document assistant. How can I help you today?",
    "Hi there! I'm ready to help with your documents. What would you like to do?",
    "Greetings! I'm your document agent. How may I assist you?",
  ],
  create: [
    "I'd be happy to help you create a new document. What type of document are you looking to create?",
    "Let's create a document together. Could you tell me what kind of document you need?",
    "I can help you draft something new. What document did you have in mind?",
  ],
  edit: [
    "I can help you edit your document. What changes would you like to make?",
    "I'm ready to assist with editing. What aspects of the document should we focus on?",
    "Let's improve your document together. What would you like to enhance?",
  ],
  analyze: [
    "I'll analyze this document for you. Give me a moment...",
    "I'm examining the document now. What specific aspects would you like me to focus on?",
    "I'll review this document and provide you with insights shortly.",
  ],
};

function getMockResponse(mode: AgentMode, message: string): string {
  // Simple keyword matching for demo purposes
  const lowercaseMsg = message.toLowerCase();
  
  // Check for greetings
  if (lowercaseMsg.includes('hello') || 
      lowercaseMsg.includes('hi') || 
      lowercaseMsg.includes('hey')) {
    return mockResponses.greetings[Math.floor(Math.random() * mockResponses.greetings.length)];
  }
  
  // Mode-specific responses
  if (mode === 'create') {
    return mockResponses.create[Math.floor(Math.random() * mockResponses.create.length)];
  } else if (mode === 'edit') {
    return mockResponses.edit[Math.floor(Math.random() * mockResponses.edit.length)];
  } else if (mode === 'analyze') {
    return mockResponses.analyze[Math.floor(Math.random() * mockResponses.analyze.length)];
  }
  
  // Default response
  return "I understand. How else can I assist you with your document?";
}

// Check if we should use mock mode
const shouldUseMockMode = () => {
  return process.env.NEXT_PUBLIC_MOCK_BACKEND === 'true' || 
         process.env.NEXT_PUBLIC_FORCE_MOCK === 'true';
};

/**
 * Send a message to the agent
 */
export async function sendMessageToAgent(
  request: AgentRequest
): Promise<AgentResponse> {
  // Use mock mode in development or if configured
  if (shouldUseMockMode()) {
    if (DEBUG) console.log('[MOCK MODE] Using mock agent response');
    
    // Get the last user message
    const lastUserMessage = [...request.messages].reverse()
      .find(msg => msg.role === 'user')?.content || '';
    
    // Generate mock response
    const mockContent = getMockResponse(request.mode, lastUserMessage);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      message: {
        role: 'assistant',
        content: mockContent,
        id: `mock-${Date.now()}`
      }
    };
  }

  try {
    if (DEBUG) console.log('Sending request to agent API:', request);
    
    // Use CORS proxy for development if needed
    let apiUrl = `${API_URL}/message`;
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_CORS_PROXY === 'true') {
      apiUrl = `https://cors-anywhere.herokuapp.com/${apiUrl}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        messages: request.messages,
        document_id: request.documentId,
        instruction: request.instruction,
        mode: request.mode,
        stream: false
      }),
    });

    if (!response.ok) {
      let errorMessage = `Agent API error (${response.status}): ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = `Agent API error (${response.status}): ${
          errorData.message || errorData.error || errorData.detail || response.statusText
        }`;
      } catch (e) {
        // If JSON parsing fails, use the original error message
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    if (DEBUG) console.error('Error sending message to agent:', error);
    
    // Fall back to mock mode if configured and an error occurred
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_MODE_FALLBACK === 'true') {
      console.warn('Falling back to mock mode due to API error');
      
      // Get the last user message
      const lastUserMessage = [...request.messages].reverse()
        .find(msg => msg.role === 'user')?.content || '';
      
      // Generate mock response
      const mockContent = getMockResponse(request.mode, lastUserMessage);
      
      return {
        message: {
          role: 'assistant',
          content: mockContent,
          id: `mock-fallback-${Date.now()}`
        }
      };
    }
    
    throw error;
  }
}

/**
 * Send a message to the agent with streaming response
 */
export async function streamMessageFromAgent(
  request: AgentRequest,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  // Use mock mode in development or if configured
  if (shouldUseMockMode()) {
    if (DEBUG) console.log('[MOCK MODE] Using mock agent streaming response');
    
    // Get the last user message
    const lastUserMessage = [...request.messages].reverse()
      .find(msg => msg.role === 'user')?.content || '';
    
    // Generate mock response
    const mockMessage = getMockResponse(request.mode, lastUserMessage);
    
    // Simulate streaming by sending chunks of the message
    const chunkSize = 10;
    let position = 0;
    
    const streamInterval = setInterval(() => {
      if (position >= mockMessage.length) {
        clearInterval(streamInterval);
        onComplete(mockMessage);
        return;
      }
      
      const chunk = mockMessage.slice(position, position + chunkSize);
      position += chunkSize;
      onChunk(chunk);
    }, 100);
    
    return;
  }

  try {
    if (DEBUG) console.log('Streaming request to agent API:', request);
    
    // Use CORS proxy for development if needed
    let apiUrl = `${API_URL}/message/stream`;
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_CORS_PROXY === 'true') {
      apiUrl = `https://cors-anywhere.herokuapp.com/${apiUrl}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        messages: request.messages,
        document_id: request.documentId,
        instruction: request.instruction,
        mode: request.mode,
        stream: true
      }),
    });

    if (!response.ok) {
      let errorMessage = `Agent API error (${response.status}): ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = `Agent API error (${response.status}): ${
          errorData.message || errorData.error || errorData.detail || response.statusText
        }`;
      } catch (e) {
        // If JSON parsing fails, use the original error message
      }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    // Read the stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;
      onChunk(chunk);
    }

    onComplete(fullResponse);
  } catch (error) {
    if (DEBUG) console.error('Error streaming message from agent:', error);
    
    // Fall back to mock mode if configured and an error occurred
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_MODE_FALLBACK === 'true') {
      console.warn('Falling back to mock streaming mode due to API error');
      
      // Get the last user message
      const lastUserMessage = [...request.messages].reverse()
        .find(msg => msg.role === 'user')?.content || '';
      
      // Generate mock response
      const mockMessage = getMockResponse(request.mode, lastUserMessage);
      
      // Simulate streaming by sending chunks of the message
      const chunkSize = 10;
      let position = 0;
      
      const streamInterval = setInterval(() => {
        if (position >= mockMessage.length) {
          clearInterval(streamInterval);
          onComplete(mockMessage);
          return;
        }
        
        const chunk = mockMessage.slice(position, position + chunkSize);
        position += chunkSize;
        onChunk(chunk);
      }, 100);
      
      return;
    }
    
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Test the agent connection with a health check
 */
export async function testAgentConnection(): Promise<boolean> {
  try {
    if (DEBUG) console.log('Testing connection to agent API...');
    
    // If mock mode is enabled, always return true
    if (shouldUseMockMode()) {
      if (DEBUG) console.log('[MOCK MODE] Using mock agent - connection test passed');
      return true;
    }
    
    // First try the health endpoint
    let apiUrl = `${API_URL}/health`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (DEBUG) console.log('Agent health check response:', data);
    
    if (data.status === 'ok') {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Agent connection test failed:', error);
    
    // Return true if fallback to mock mode is enabled
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_MODE_FALLBACK === 'true') {
      console.warn('Using mock mode fallback due to connection test failure');
      return true;
    }
    
    return false;
  }
} 