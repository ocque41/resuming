import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DirectAPITesterProps {
  onResult: (result: any) => void;
}

const DirectAPITester: React.FC<DirectAPITesterProps> = ({ onResult }) => {
  const [documentId, setDocumentId] = useState('debug-document');
  const [fileName, setFileName] = useState('sample-document.pdf');
  const [analysisType, setAnalysisType] = useState('general');
  const [apiEndpoint, setApiEndpoint] = useState('/api/document-analysis');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleAPICall = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      console.log(`Making direct API call to ${apiEndpoint}`, {
        documentId,
        fileName,
        type: analysisType
      });

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          fileName,
          type: analysisType
        })
      });

      // Get the full response text for logging
      const responseText = await response.text();
      console.log(`API response status: ${response.status}, content length: ${responseText.length}`);

      try {
        // Try to parse the response as JSON
        const jsonResult = JSON.parse(responseText);
        console.log('API response parsed successfully:', {
          status: response.status,
          keys: Object.keys(jsonResult)
        });

        setResponse(jsonResult);
        onResult(jsonResult);
      } catch (parseError: unknown) {
        console.error('Failed to parse API response:', parseError);
        setError(`Failed to parse response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        setResponse({ raw: responseText.substring(0, 500) + '...' });
      }
    } catch (fetchError: unknown) {
      console.error('API call failed:', fetchError);
      setError(`API call failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mt-4 border-purple-800 bg-gray-900">
      <CardHeader>
        <CardTitle className="text-gray-300">Direct API Tester</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-gray-400">Document ID</Label>
              <Input
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-300"
                placeholder="e.g. doc_123"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400">File Name</Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="bg-gray-800 border-gray-700 text-gray-300"
                placeholder="e.g. document.pdf"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-gray-400">Analysis Type</Label>
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-300">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="resume">Resume</SelectItem>
                  <SelectItem value="cover-letter">Cover Letter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400">API Endpoint</Label>
              <Select value={apiEndpoint} onValueChange={setApiEndpoint}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-300">
                  <SelectValue placeholder="Select endpoint" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="/api/document-analysis">Production API</SelectItem>
                  <SelectItem value="/api/document-analysis/debug-generate">Debug API</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleAPICall}
            disabled={isLoading}
            className="w-full bg-purple-800 hover:bg-purple-700 text-white"
          >
            {isLoading ? 'Calling API...' : 'Make Direct API Call'}
          </Button>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}

          {response && (
            <div className="p-3 bg-gray-800 border border-gray-700 rounded-md text-gray-300 text-sm">
              <div className="font-semibold mb-1">Response:</div>
              <div className="text-green-400">
                {Object.keys(response).length} fields received
              </div>
              <div className="mt-2 text-xs">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-purple-400 border-purple-800 hover:bg-purple-900/30"
                  onClick={() => console.log('Full API response:', response)}
                >
                  Log Full Response
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DirectAPITester; 