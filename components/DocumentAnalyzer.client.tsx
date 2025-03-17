"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart2, PieChart, LineChart, List, AlertCircle, FileText } from 'lucide-react';

interface Document {
  id: string;
  fileName: string;
  createdAt: Date;
}

interface DocumentAnalyzerProps {
  documents: Document[];
}

export default function DocumentAnalyzer({ documents }: DocumentAnalyzerProps) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  // Function to handle document analysis
  const handleAnalyze = async () => {
    if (!selectedDocumentId) {
      setError("Please select a document to analyze");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResults(null);

    try {
      const response = await fetch('/api/document/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: selectedDocumentId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze document');
      }

      const data = await response.json();
      setAnalysisResults(data.analysis);
    } catch (error) {
      console.error('Error analyzing document:', error);
      setError(`Analysis error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div>
      {/* Document Selection */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select a Document to Analyze
        </label>
        <div className="flex gap-4">
          <select 
            className="flex-1 bg-black border border-gray-700 rounded-md p-2.5 text-gray-300 focus:ring-[#B4916C] focus:border-[#B4916C]"
            value={selectedDocumentId}
            onChange={(e) => setSelectedDocumentId(e.target.value)}
          >
            <option value="">Select a document...</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>{doc.fileName}</option>
            ))}
          </select>
          <Button 
            className="bg-[#B4916C] hover:bg-[#A3815C] text-white"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !selectedDocumentId}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
      </div>

      {/* Error message if any */}
      {error && (
        <Alert className="mb-6 bg-red-900/20 border-red-900/30">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-300">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Analytics Tabs */}
      {!analysisResults && !isAnalyzing && (
        <Alert className="mb-6 bg-[#B4916C]/10 border-[#B4916C]/20 text-[#B4916C]">
          <AlertCircle className="h-4 w-4 text-[#B4916C]" />
          <AlertDescription className="text-gray-300">
            Select a document and click "Analyze" to generate insights. Our AI will process the document and extract meaningful information.
          </AlertDescription>
        </Alert>
      )}

      {isAnalyzing && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#B4916C] mb-4"></div>
          <p className="text-gray-300">Analyzing your document. This may take a moment...</p>
        </div>
      )}

      {analysisResults && (
        <Tabs defaultValue="content" className="mb-6">
          <TabsList className="bg-black border border-gray-800 mb-6">
            <TabsTrigger value="content" className="data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              Content Analysis
            </TabsTrigger>
            <TabsTrigger value="sentiment" className="data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              Sentiment Analysis
            </TabsTrigger>
            <TabsTrigger value="information" className="data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              Key Information
            </TabsTrigger>
            <TabsTrigger value="summary" className="data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              Summary
            </TabsTrigger>
          </TabsList>
          
          {/* Content Analysis Tab */}
          <TabsContent value="content" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Content Distribution Chart */}
              <Card className="border border-gray-800 bg-black/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#B4916C]">Content Distribution</CardTitle>
                  <CardDescription className="text-gray-500">
                    Breakdown of document content by category
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-80 flex items-center justify-center">
                    {/* Placeholder for PieChart - In a real implementation, use a charting library */}
                    <div className="w-64 h-64 rounded-full border-8 border-[#B4916C]/30 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#B4916C]">
                            {analysisResults.contentAnalysis.contentDistribution[0].value}%
                          </div>
                          <div className="text-xs text-gray-400">
                            {analysisResults.contentAnalysis.contentDistribution[0].name}
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-0 right-0 w-6 h-6 rounded-full bg-[#B4916C]"></div>
                      <div className="absolute top-1/4 right-0 w-5 h-5 rounded-full bg-[#B4916C]/80"></div>
                      <div className="absolute bottom-1/4 right-0 w-4 h-4 rounded-full bg-[#B4916C]/60"></div>
                      <div className="absolute bottom-0 right-1/4 w-4 h-4 rounded-full bg-[#B4916C]/40"></div>
                      <div className="absolute bottom-0 left-1/4 w-3 h-3 rounded-full bg-[#B4916C]/20"></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {analysisResults.contentAnalysis.contentDistribution.map((item: any, index: number) => (
                      <div key={index} className="flex items-center">
                        <div className={`w-3 h-3 rounded-full bg-[#B4916C]/${90 - index * 15} mr-2`}></div>
                        <div className="text-sm">
                          <span className="text-gray-300">{item.name}</span>
                          <span className="text-[#B4916C] ml-2">{item.value}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Top Keywords */}
              <Card className="border border-gray-800 bg-black/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#B4916C]">Top Keywords</CardTitle>
                  <CardDescription className="text-gray-500">
                    Most frequent terminology in your document
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-80 p-4 bg-black/30 rounded-lg border border-gray-800 flex flex-wrap items-center justify-center gap-3">
                    {analysisResults.contentAnalysis.topKeywords.map((keyword: any, index: number) => (
                      <div 
                        key={index} 
                        className="px-3 py-1.5 rounded-full bg-[#B4916C]/20 text-[#B4916C] border border-[#B4916C]/30"
                        style={{ fontSize: `${0.8 + (keyword.value / 10)}rem` }}
                      >
                        {keyword.text}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Sentiment Analysis Tab */}
          <TabsContent value="sentiment" className="mt-0">
            <Card className="border border-gray-800 bg-black/20 shadow-lg mb-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#B4916C]">Document Sentiment Score</CardTitle>
                <CardDescription className="text-gray-500">
                  Overall sentiment analysis of your document content
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-center py-8">
                  <div className="relative w-48 h-48">
                    <div className="absolute inset-0 rounded-full border-8 border-gray-800"></div>
                    <div 
                      className="absolute inset-0 rounded-full border-8 border-[#B4916C]"
                      style={{ 
                        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)', 
                        clip: 'rect(0px, 96px, 192px, 0px)' 
                      }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <div className="text-4xl font-bold text-[#B4916C]">
                        {analysisResults.sentimentAnalysis.overallScore.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-400">Positive Sentiment</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 mt-2">
                  <div className="text-white font-medium mb-2">Sentiment by Section</div>
                  {analysisResults.sentimentAnalysis.sentimentBySection.map((item: any, index: number) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{item.section}</span>
                        <span className="text-[#B4916C]">{item.score.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div 
                          className="bg-[#B4916C] h-2 rounded-full" 
                          style={{ width: `${item.score * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-gray-800 bg-black/20 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#B4916C]">Emotional Tone Analysis</CardTitle>
                <CardDescription className="text-gray-500">
                  Distribution of emotional tone throughout the document
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border border-gray-800 p-6 bg-black/30">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 rounded-lg bg-green-900/20 border border-green-800/40">
                      <div className="text-2xl font-bold text-green-500">
                        {analysisResults.sentimentAnalysis.emotionalTone.professional}%
                      </div>
                      <div className="text-sm text-gray-400">Professional</div>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-800/40">
                      <div className="text-2xl font-bold text-blue-500">
                        {analysisResults.sentimentAnalysis.emotionalTone.confident}%
                      </div>
                      <div className="text-sm text-gray-400">Confident</div>
                    </div>
                    <div className="p-4 rounded-lg bg-purple-900/20 border border-purple-800/40">
                      <div className="text-2xl font-bold text-purple-500">
                        {analysisResults.sentimentAnalysis.emotionalTone.innovative}%
                      </div>
                      <div className="text-sm text-gray-400">Innovative</div>
                    </div>
                    <div className="p-4 rounded-lg bg-orange-900/20 border border-orange-800/40">
                      <div className="text-2xl font-bold text-orange-500">
                        {analysisResults.sentimentAnalysis.emotionalTone.cautious}%
                      </div>
                      <div className="text-sm text-gray-400">Cautious</div>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-gray-800">
                    <div className="text-white font-medium mb-3">Key Findings</div>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-start">
                        <div className="text-green-500 mr-2">•</div>
                        Document maintains a consistently professional tone appropriate for business contexts
                      </li>
                      <li className="flex items-start">
                        <div className="text-blue-500 mr-2">•</div>
                        Strong confident language in experience and achievements sections
                      </li>
                      <li className="flex items-start">
                        <div className="text-purple-500 mr-2">•</div>
                        Some innovative language when discussing projects and technologies
                      </li>
                      <li className="flex items-start">
                        <div className="text-orange-500 mr-2">•</div>
                        Minimal cautious language, primarily in legal or compliance contexts
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Key Information Tab */}
          <TabsContent value="information" className="mt-0">
            <Card className="border border-gray-800 bg-black/20 shadow-lg mb-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#B4916C]">Key Entities</CardTitle>
                <CardDescription className="text-gray-500">
                  Organizations, people, locations, and other entities mentioned
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border border-gray-800 bg-black/30 divide-y divide-gray-800">
                  {analysisResults.keyInformation.entities.map((entity: any, index: number) => (
                    <div key={index} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="text-gray-300">{entity.name}</span>
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-400">{entity.type}</span>
                      </div>
                      <div className="text-[#B4916C]">
                        Mentioned {entity.count} {entity.count === 1 ? 'time' : 'times'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border border-gray-800 bg-black/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#B4916C]">Document Timeline</CardTitle>
                  <CardDescription className="text-gray-500">
                    Key dates and time periods mentioned
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="relative pl-8 space-y-6 before:absolute before:inset-0 before:h-full before:w-[2px] before:bg-gray-800 before:left-3 py-4">
                    {analysisResults.keyInformation.timeline.map((item: any, index: number) => (
                      <div key={index} className="relative">
                        <div className={`absolute left-[-30px] w-5 h-5 rounded-full bg-[#B4916C]/${100 - index * 20}`}></div>
                        <div className="text-white font-medium">{item.period}</div>
                        <div className="text-sm text-gray-400">{item.entity}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-gray-800 bg-black/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-[#B4916C]">Skill Assessment</CardTitle>
                  <CardDescription className="text-gray-500">
                    Skills mentioned and their prominence
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {analysisResults.keyInformation.skills.map((skill: any, index: number) => (
                      <div key={index}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-white">{skill.name}</span>
                          <span className="text-[#B4916C]">{skill.level}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div 
                            className="bg-[#B4916C] h-2 rounded-full" 
                            style={{ width: `${skill.score}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Summary Tab */}
          <TabsContent value="summary" className="mt-0">
            <Card className="border border-gray-800 bg-black/20 shadow-lg mb-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#B4916C]">Document Summary</CardTitle>
                <CardDescription className="text-gray-500">
                  AI-generated summary of the key points and content
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border border-gray-800 bg-black/30 p-4 text-gray-300">
                  <p>{analysisResults.summary.text}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-gray-800 bg-black/20 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-[#B4916C]">Document Insights</CardTitle>
                <CardDescription className="text-gray-500">
                  Key takeaways and improvement suggestions
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-6">
                  <div className="rounded-lg border border-gray-800 bg-black/30 p-4">
                    <h3 className="text-[#B4916C] font-medium mb-2 flex items-center">
                      <BarChart2 className="h-4 w-4 mr-2" />
                      Key Strengths
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-300">
                      {analysisResults.summary.strengths.map((strength: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <div className="text-green-500 mr-2">•</div>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="rounded-lg border border-gray-800 bg-black/30 p-4">
                    <h3 className="text-[#B4916C] font-medium mb-2 flex items-center">
                      <LineChart className="h-4 w-4 mr-2" />
                      Improvement Suggestions
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-300">
                      {analysisResults.summary.improvements.map((improvement: string | { improvement: string; impact?: string }, index: number) => (
                        <li key={index} className="flex items-start">
                          <div className="text-amber-500 mr-2">•</div>
                          {typeof improvement === 'object' && improvement !== null 
                            ? (improvement.improvement || 'Improvement needed') + 
                              (improvement.impact ? ` - Impact: ${improvement.impact}` : '')
                            : improvement}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="rounded-lg border border-gray-800 bg-black/30 p-4">
                    <h3 className="text-[#B4916C] font-medium mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Document Readability
                    </h3>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-400">Overall Score</span>
                      <span className="text-lg font-medium text-[#B4916C]">{analysisResults.summary.readability.score}/100</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3 mb-4">
                      <div 
                        className="bg-[#B4916C] h-3 rounded-full" 
                        style={{ width: `${analysisResults.summary.readability.score}%` }}
                      ></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Sentence Structure</span>
                        <span className="text-white">{analysisResults.summary.readability.sentenceStructure}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Vocabulary</span>
                        <span className="text-white">{analysisResults.summary.readability.vocabulary}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Grammar</span>
                        <span className="text-white">{analysisResults.summary.readability.grammar}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Formatting</span>
                        <span className="text-white">{analysisResults.summary.readability.formatting}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
} 