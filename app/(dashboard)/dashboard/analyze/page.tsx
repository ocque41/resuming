import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, FileText, BarChart2, PieChart, LineChart, List, AlertCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function DocumentAnalysisPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    throw new Error("Team not found");
  }
  
  const documents = await getCVsForUser(user.id);
  
  // Sample data for visualizations
  const sampleData = {
    contentDistribution: [
      { name: 'Technical Content', value: 35 },
      { name: 'Business Information', value: 25 },
      { name: 'Personal Details', value: 15 },
      { name: 'Education', value: 15 },
      { name: 'Other', value: 10 },
    ],
    topKeywords: [
      { text: 'development', value: 25 },
      { text: 'engineering', value: 18 },
      { text: 'project', value: 15 },
      { text: 'experience', value: 12 },
      { text: 'management', value: 10 },
      { text: 'skills', value: 8 },
      { text: 'technical', value: 7 },
      { text: 'implementation', value: 6 },
    ],
    sentimentScores: [
      { section: 'Introduction', score: 0.85 },
      { section: 'Experience', score: 0.72 },
      { section: 'Education', score: 0.95 },
      { section: 'Skills', score: 0.88 },
      { section: 'References', score: 0.91 },
    ],
    keyEntities: [
      { type: 'Organization', name: 'Tech Innovations Inc.', count: 4 },
      { type: 'Organization', name: 'Stanford University', count: 2 },
      { type: 'Person', name: 'John Smith', count: 3 },
      { type: 'Date', name: 'January 2022', count: 1 },
      { type: 'Location', name: 'San Francisco', count: 3 },
      { type: 'Skill', name: 'JavaScript', count: 5 },
      { type: 'Skill', name: 'Machine Learning', count: 3 },
      { type: 'Skill', name: 'Project Management', count: 4 },
    ]
  };
  
  return (
    <>
      <header className="flex items-center justify-between p-4 mx-auto max-w-7xl">
        <div className="flex items-center">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center h-8 w-8 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg lg:text-xl font-medium text-white">
            Document Analysis
          </h1>
        </div>
      </header>
      
      <div className="flex flex-col space-y-6 mx-auto max-w-7xl px-4 pb-12">
        <Card className="border border-[#B4916C]/20 bg-black shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[#B4916C]">Advanced Document Analytics</CardTitle>
            <CardDescription className="text-gray-400">
              Extract insights and visualize data from your documents
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-4 md:p-6">
            <p className="mb-6 text-gray-300">
              Our AI-powered analytics engine extracts meaningful insights from your documents, 
              helping you better understand content, sentiment, and key information.
            </p>
            
            {/* Document Selection */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select a Document to Analyze
              </label>
              <div className="flex gap-4">
                <select 
                  className="flex-1 bg-black border border-gray-700 rounded-md p-2.5 text-gray-300 focus:ring-[#B4916C] focus:border-[#B4916C]"
                >
                  <option value="">Select a document...</option>
                  {documents.map((doc: any) => (
                    <option key={doc.id} value={doc.id}>{doc.fileName}</option>
                  ))}
                </select>
                <Button className="bg-[#B4916C] hover:bg-[#A3815C] text-white">
                  Analyze
                </Button>
              </div>
            </div>
            
            {/* Analytics Tabs */}
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
                <Alert className="mb-6 bg-[#B4916C]/10 border-[#B4916C]/20 text-[#B4916C]">
                  <AlertCircle className="h-4 w-4 text-[#B4916C]" />
                  <AlertDescription className="text-gray-300">
                    Select a document and click "Analyze" to see real content analysis. Showing sample data for demonstration.
                  </AlertDescription>
                </Alert>
                
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
                              <div className="text-2xl font-bold text-[#B4916C]">35%</div>
                              <div className="text-xs text-gray-400">Technical Content</div>
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
                        {sampleData.contentDistribution.map((item, index) => (
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
                        {sampleData.topKeywords.map((keyword, index) => (
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
                <Alert className="mb-6 bg-[#B4916C]/10 border-[#B4916C]/20 text-[#B4916C]">
                  <AlertCircle className="h-4 w-4 text-[#B4916C]" />
                  <AlertDescription className="text-gray-300">
                    Select a document and click "Analyze" to see real sentiment analysis. Showing sample data for demonstration.
                  </AlertDescription>
                </Alert>
                
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
                          <div className="text-4xl font-bold text-[#B4916C]">0.86</div>
                          <div className="text-sm text-gray-400">Positive Sentiment</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4 mt-2">
                      <div className="text-white font-medium mb-2">Sentiment by Section</div>
                      {sampleData.sentimentScores.map((item, index) => (
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
                          <div className="text-2xl font-bold text-green-500">68%</div>
                          <div className="text-sm text-gray-400">Professional</div>
                        </div>
                        <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-800/40">
                          <div className="text-2xl font-bold text-blue-500">22%</div>
                          <div className="text-sm text-gray-400">Confident</div>
                        </div>
                        <div className="p-4 rounded-lg bg-purple-900/20 border border-purple-800/40">
                          <div className="text-2xl font-bold text-purple-500">8%</div>
                          <div className="text-sm text-gray-400">Innovative</div>
                        </div>
                        <div className="p-4 rounded-lg bg-orange-900/20 border border-orange-800/40">
                          <div className="text-2xl font-bold text-orange-500">2%</div>
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
                <Alert className="mb-6 bg-[#B4916C]/10 border-[#B4916C]/20 text-[#B4916C]">
                  <AlertCircle className="h-4 w-4 text-[#B4916C]" />
                  <AlertDescription className="text-gray-300">
                    Select a document and click "Analyze" to extract key information. Showing sample data for demonstration.
                  </AlertDescription>
                </Alert>
                
                <Card className="border border-gray-800 bg-black/20 shadow-lg mb-8">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-[#B4916C]">Key Entities</CardTitle>
                    <CardDescription className="text-gray-500">
                      Organizations, people, locations, and other entities mentioned
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="rounded-lg border border-gray-800 bg-black/30 divide-y divide-gray-800">
                      {sampleData.keyEntities.map((entity, index) => (
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
                        <div className="relative">
                          <div className="absolute left-[-30px] w-5 h-5 rounded-full bg-[#B4916C]"></div>
                          <div className="text-white font-medium">January 2019 - Present</div>
                          <div className="text-sm text-gray-400">Tech Innovations Inc.</div>
                        </div>
                        
                        <div className="relative">
                          <div className="absolute left-[-30px] w-5 h-5 rounded-full bg-[#B4916C]/80"></div>
                          <div className="text-white font-medium">March 2015 - December 2018</div>
                          <div className="text-sm text-gray-400">Global Solutions Ltd.</div>
                        </div>
                        
                        <div className="relative">
                          <div className="absolute left-[-30px] w-5 h-5 rounded-full bg-[#B4916C]/60"></div>
                          <div className="text-white font-medium">September 2011 - May 2015</div>
                          <div className="text-sm text-gray-400">Stanford University</div>
                        </div>
                        
                        <div className="relative">
                          <div className="absolute left-[-30px] w-5 h-5 rounded-full bg-[#B4916C]/40"></div>
                          <div className="text-white font-medium">June 2010</div>
                          <div className="text-sm text-gray-400">First Industry Award</div>
                        </div>
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
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-white">JavaScript</span>
                            <span className="text-[#B4916C]">Advanced</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div className="bg-[#B4916C] h-2 rounded-full w-[85%]"></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-white">Machine Learning</span>
                            <span className="text-[#B4916C]">Intermediate</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div className="bg-[#B4916C] h-2 rounded-full w-[65%]"></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-white">Project Management</span>
                            <span className="text-[#B4916C]">Expert</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div className="bg-[#B4916C] h-2 rounded-full w-[95%]"></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-white">Python</span>
                            <span className="text-[#B4916C]">Advanced</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div className="bg-[#B4916C] h-2 rounded-full w-[80%]"></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-white">Cloud Infrastructure</span>
                            <span className="text-[#B4916C]">Intermediate</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div className="bg-[#B4916C] h-2 rounded-full w-[60%]"></div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              {/* Summary Tab */}
              <TabsContent value="summary" className="mt-0">
                <Alert className="mb-6 bg-[#B4916C]/10 border-[#B4916C]/20 text-[#B4916C]">
                  <AlertCircle className="h-4 w-4 text-[#B4916C]" />
                  <AlertDescription className="text-gray-300">
                    Select a document and click "Analyze" to generate an AI summary. Showing sample summary for demonstration.
                  </AlertDescription>
                </Alert>
                
                <Card className="border border-gray-800 bg-black/20 shadow-lg mb-8">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-[#B4916C]">Document Summary</CardTitle>
                    <CardDescription className="text-gray-500">
                      AI-generated summary of the key points and content
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="rounded-lg border border-gray-800 bg-black/30 p-4 text-gray-300 space-y-4">
                      <p>
                        This document is a professional resume for a technology professional with over 10 years of experience in software development and project management. The individual has worked at Tech Innovations Inc. since January 2019, where they lead development teams and manage product lifecycles.
                      </p>
                      <p>
                        Prior experience includes a role at Global Solutions Ltd. where they specialized in machine learning applications. Their educational background includes a Computer Science degree from Stanford University. The document emphasizes strong technical skills in JavaScript, Python, and machine learning, complemented by project management expertise.
                      </p>
                      <p>
                        The content maintains a professional tone throughout with confident language when describing achievements. Key accomplishments include leading a team that increased product performance by 35% and receiving an industry award in 2010.
                      </p>
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
                          <li className="flex items-start">
                            <div className="text-green-500 mr-2">•</div>
                            Strong quantifiable achievements with clear metrics
                          </li>
                          <li className="flex items-start">
                            <div className="text-green-500 mr-2">•</div>
                            Excellent balance of technical and management skills
                          </li>
                          <li className="flex items-start">
                            <div className="text-green-500 mr-2">•</div>
                            Clear progression of responsibilities through career
                          </li>
                        </ul>
                      </div>
                      
                      <div className="rounded-lg border border-gray-800 bg-black/30 p-4">
                        <h3 className="text-[#B4916C] font-medium mb-2 flex items-center">
                          <LineChart className="h-4 w-4 mr-2" />
                          Improvement Suggestions
                        </h3>
                        <ul className="space-y-2 text-sm text-gray-300">
                          <li className="flex items-start">
                            <div className="text-amber-500 mr-2">•</div>
                            Consider adding more industry-specific keywords
                          </li>
                          <li className="flex items-start">
                            <div className="text-amber-500 mr-2">•</div>
                            Expand on collaborative projects and team leadership
                          </li>
                          <li className="flex items-start">
                            <div className="text-amber-500 mr-2">•</div>
                            Add more details on specific technologies used in projects
                          </li>
                        </ul>
                      </div>
                      
                      <div className="rounded-lg border border-gray-800 bg-black/30 p-4">
                        <h3 className="text-[#B4916C] font-medium mb-2 flex items-center">
                          <FileText className="h-4 w-4 mr-2" />
                          Document Readability
                        </h3>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-gray-400">Overall Score</span>
                          <span className="text-lg font-medium text-[#B4916C]">92/100</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3 mb-4">
                          <div className="bg-[#B4916C] h-3 rounded-full w-[92%]"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Sentence Structure</span>
                            <span className="text-white">Excellent</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Vocabulary</span>
                            <span className="text-white">Professional</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Grammar</span>
                            <span className="text-white">Perfect</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Formatting</span>
                            <span className="text-white">Consistent</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 