/**
 * Agent API connector for the AI Document Agent
 * Handles communication with the backend agent service
 * This is currently a mock implementation as we transition to a new backend
 */

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

/**
 * Send a message to the agent
 */
export async function sendMessageToAgent(
  request: AgentRequest
): Promise<AgentResponse> {
  console.log('[MOCK MODE] Using mock agent response');
  
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

/**
 * Send a message to the agent with streaming response
 */
export async function streamMessageFromAgent(
  request: AgentRequest,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  console.log('[MOCK MODE] Using mock agent streaming response');
  
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

/**
 * Test the connection to the agent API
 */
export async function testAgentConnection(): Promise<boolean> {
  console.log('[MOCK MODE] Agent connection test always returns true');
  await new Promise(resolve => setTimeout(resolve, 500));
  return true;
} 