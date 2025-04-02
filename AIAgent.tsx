import React, { useState } from 'react';

interface AIAgentProps {
  documentKey?: string;
  documentId?: string;
}

const AIAgent: React.FC<AIAgentProps> = ({ documentKey, documentId }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          documentKey,
          documentId,
        }),
      });
      
      if (!result.ok) {
        const errorData = await result.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }
      
      const data = await result.json();
      setResponse(data.response);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white">
      <h2 className="text-xl font-bold mb-4">AI Document Assistant</h2>
      
      <form onSubmit={handleSubmit} className="mb-4">
        <textarea
          className="w-full p-2 border rounded-md"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask about your document or request assistance..."
          disabled={loading}
        />
        
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-blue-300"
        >
          {loading ? 'Processing...' : 'Submit'}
        </button>
      </form>
      
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded-md mb-4">
          {error}
        </div>
      )}
      
      {response && (
        <div className="p-4 bg-gray-50 rounded-md">
          <h3 className="font-medium mb-2">Response:</h3>
          <div className="whitespace-pre-wrap">{response}</div>
        </div>
      )}
    </div>
  );
};

export default AIAgent; 