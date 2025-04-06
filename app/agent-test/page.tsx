'use client';

import { useState, useEffect } from 'react';
import { sendMessageToAgent, testAgentConnection, AgentMessage } from '../lib/agent-api';

export default function AgentTestPage() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  // Test connection on component mount
  useEffect(() => {
    async function checkConnection() {
      try {
        const isConnected = await testAgentConnection();
        setConnectionStatus(isConnected ? 'connected' : 'error');
        if (!isConnected) {
          setError('Failed to connect to agent API. Check console for details.');
        }
      } catch (err) {
        setConnectionStatus('error');
        setError('Error testing connection: ' + String(err));
        console.error('Connection test error:', err);
      }
    }
    
    checkConnection();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage: AgentMessage = { role: 'user', content: message };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    setMessage('');

    try {
      const response = await sendMessageToAgent({
        mode: 'create',
        messages: [...messages, userMessage],
      });

      setMessages((prev) => [...prev, response.message]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to get response: ' + String(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">AI Agent Test</h1>

      {/* Connection status */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Connection Status:</h2>
        {connectionStatus === 'checking' && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3">
            Checking connection to agent API...
          </div>
        )}
        {connectionStatus === 'connected' && (
          <div className="bg-green-100 border-l-4 border-green-500 p-3">
            ✅ Connected to agent API successfully!
          </div>
        )}
        {connectionStatus === 'error' && (
          <div className="bg-red-100 border-l-4 border-red-500 p-3">
            ❌ Failed to connect to agent API. Check browser console for details.
          </div>
        )}
      </div>

      {/* Message exchange */}
      <div className="bg-gray-100 p-4 rounded-lg mb-4 h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center mt-20">
            Send a message to start the conversation
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-100 ml-12'
                    : 'bg-white mr-12'
                }`}
              >
                <div className="font-semibold mb-1">
                  {msg.role === 'user' ? 'You' : 'Agent'}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="bg-white p-3 rounded-lg mr-12 animate-pulse">
                <div className="font-semibold mb-1">Agent</div>
                <div>Thinking...</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 p-3 mb-4">
          <div className="font-semibold">Error:</div>
          <div>{error}</div>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded-md"
          disabled={isLoading || connectionStatus !== 'connected'}
        />
        <button
          type="submit"
          disabled={isLoading || !message.trim() || connectionStatus !== 'connected'}
          className="bg-blue-500 text-white px-4 py-2 rounded-md disabled:bg-gray-300"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
} 