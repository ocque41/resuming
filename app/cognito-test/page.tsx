'use client';

import { useState } from 'react';

export default function CognitoTestPage() {
  const [username, setUsername] = useState('30acd98c-2021-70b8-0a22-99c3547da50c');
  const [password, setPassword] = useState('Ocque031202@');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/auth/cognito-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error authenticating');
      console.error('Authentication error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Cognito Authentication Test</h1>
      
      <form onSubmit={handleSubmit} className="mb-6 max-w-md">
        <div className="mb-4">
          <label htmlFor="username" className="block mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="block mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Authenticating...' : 'Get Token'}
        </button>
      </form>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-3">Authentication Successful</h2>
          
          <div className="mb-4">
            <h3 className="font-bold">ID Token:</h3>
            <div className="bg-gray-100 p-3 rounded overflow-auto max-h-32">
              {result.idToken}
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-bold">Access Token:</h3>
            <div className="bg-gray-100 p-3 rounded overflow-auto max-h-32">
              {result.accessToken}
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-bold">Refresh Token:</h3>
            <div className="bg-gray-100 p-3 rounded overflow-auto max-h-32">
              {result.refreshToken}
            </div>
          </div>

          <div>
            <h3 className="font-bold">For API Gateway requests, use this header:</h3>
            <code className="bg-gray-100 p-3 rounded block mt-2">
              Authorization: {result.idToken}
            </code>
          </div>
        </div>
      )}
    </div>
  );
} 