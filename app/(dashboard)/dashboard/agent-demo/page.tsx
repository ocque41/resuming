import { Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import OpenAIAgentClientWrapper from './OpenAIAgentClientWrapper';

export const metadata: Metadata = {
  title: 'OpenAI Agent Demo',
  description: 'Demonstration of OpenAI Agents SDK integration',
};

export default function OpenAIAgentDemoPage() {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col items-center space-y-2 text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">OpenAI Agent Demo</h1>
        <p className="text-muted-foreground">
          Experience document analysis, editing, and creation with OpenAI Agents
        </p>
      </div>

      <Tabs defaultValue="agent" className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
          <TabsTrigger value="agent">Agent Demo</TabsTrigger>
          <TabsTrigger value="info">How It Works</TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="mt-6">
          <OpenAIAgentClientWrapper />
        </TabsContent>

        <TabsContent value="info" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About OpenAI Agents</CardTitle>
              <CardDescription>
                A powerful framework for building AI applications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">What are OpenAI Agents?</h3>
                <p className="text-muted-foreground mt-2">
                  OpenAI Agents is a comprehensive framework for building AI applications that can reason, plan, remember, 
                  and interact with the world. Agents enable developers to create AI systems that can use tools, call APIs, 
                  maintain state, and follow multi-step instructions.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold">Features Used in This Demo</h3>
                <ul className="list-disc pl-6 mt-2 space-y-2 text-muted-foreground">
                  <li>
                    <span className="font-medium">Document Analysis:</span> The agent can analyze documents, extracting key information and summarizing content.
                  </li>
                  <li>
                    <span className="font-medium">Document Editing:</span> Suggest improvements and edit existing documents with detailed explanations.
                  </li>
                  <li>
                    <span className="font-medium">Document Creation:</span> Generate new documents based on user specifications and requirements.
                  </li>
                  <li>
                    <span className="font-medium">Streaming Responses:</span> Get real-time streaming responses for a more interactive experience.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technical Implementation</CardTitle>
              <CardDescription>
                How this demo is built using Next.js and Python
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Architecture</h3>
                <p className="text-muted-foreground mt-2">
                  This demo uses a Next.js frontend with a Python FastAPI backend. The OpenAI Agents SDK is integrated 
                  in the Python backend, which handles document processing, agent management, and OpenAI API interactions.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold">Components</h3>
                <ul className="list-disc pl-6 mt-2 space-y-2 text-muted-foreground">
                  <li>
                    <span className="font-medium">Next.js Frontend:</span> Handles UI, user interactions, and API calls to the Python backend.
                  </li>
                  <li>
                    <span className="font-medium">FastAPI Backend:</span> Manages OpenAI Agents, document processing, and agent execution.
                  </li>
                  <li>
                    <span className="font-medium">Document Processing:</span> Extract text from various document formats including PDFs, DOCXs, and text files.
                  </li>
                  <li>
                    <span className="font-medium">OpenAI Agents:</span> Specialized agents for analysis, editing, and creation tasks.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 