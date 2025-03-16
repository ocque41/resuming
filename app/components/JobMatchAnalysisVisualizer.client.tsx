'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, BarChart4, AlertCircle, CheckCircle, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Progress,
  ProgressIndicator,
} from "@/components/ui/progress";

interface MatchedKeyword {
  keyword: string;
  relevance: number;
  frequency: number;
  placement: string;
}

interface MissingKeyword {
  keyword: string;
  importance: number;
  suggestedPlacement: string;
}

interface SectionAnalysis {
  score: number;
  feedback: string;
}

interface DimensionalScores {
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  industryFit: number;
  overallCompatibility: number;
  keywordDensity: number;
  formatCompatibility: number;
  contentRelevance: number;
}

interface JobMatchAnalysisResult {
  score: number;
  matchedKeywords: MatchedKeyword[];
  missingKeywords: MissingKeyword[];
  recommendations: string[];
  skillGap: string;
  dimensionalScores: DimensionalScores;
  detailedAnalysis: string;
  improvementPotential: number;
  sectionAnalysis: {
    profile: SectionAnalysis;
    skills: SectionAnalysis;
    experience: SectionAnalysis;
    education: SectionAnalysis;
    achievements: SectionAnalysis;
  };
}

export default function JobMatchAnalysisVisualizer() {
  const { toast } = useToast();
  const [cvText, setCvText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<JobMatchAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const analyzeJobMatch = async () => {
    if (!cvText.trim()) {
      toast({
        title: "CV text required",
        description: "Please enter your CV text for analysis",
        variant: "destructive"
      });
      return;
    }

    if (!jobDescription.trim()) {
      toast({
        title: "Job description required",
        description: "Please enter a job description to match against",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/cv/job-match-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvText, jobDescription }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to analyze job match');
      }

      setAnalysis(data.analysis);
      toast({
        title: "Analysis Complete",
        description: "Your CV has been analyzed against the job description",
        variant: "default"
      });
    } catch (error) {
      console.error('Error analyzing job match:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const renderScoreCard = (title: string, score: number, icon: React.ReactNode) => (
    <Card className="bg-[#1D1D1D] border-none text-white">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {icon}
            <span>{title}</span>
          </div>
          <span className={`text-xl font-bold ${getScoreColor(score)}`}>{score}%</span>
        </div>
        <Progress className="h-2 bg-gray-700">
          <ProgressIndicator className={`${getProgressColor(score)}`} style={{ width: `${score}%` }} />
        </Progress>
      </CardContent>
    </Card>
  );

  const renderSectionAnalysis = (title: string, analysis: SectionAnalysis) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-white">{title}</h3>
        <span className={`font-bold ${getScoreColor(analysis.score)}`}>{analysis.score}%</span>
      </div>
      <Progress className="h-2 mb-3 bg-gray-700">
        <ProgressIndicator className={`${getProgressColor(analysis.score)}`} style={{ width: `${analysis.score}%` }} />
      </Progress>
      <p className="text-gray-300">{analysis.feedback}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="bg-[#333333] border-none text-white">
        <CardHeader>
          <CardTitle className="text-xl">CV to Job Match Analyzer</CardTitle>
          <CardDescription className="text-gray-300">
            Analyze how well your CV matches a job description
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="cv-text">
              CV Text
            </label>
            <Textarea
              id="cv-text"
              placeholder="Paste your CV text here..."
              className="bg-[#1D1D1D] border-[#444444] text-white h-40"
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="job-description">
              Job Description
            </label>
            <Textarea
              id="job-description"
              placeholder="Paste the job description here..."
              className="bg-[#1D1D1D] border-[#444444] text-white h-40"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full bg-[#B4916C] hover:bg-[#9a7b5c] text-white" 
            onClick={analyzeJobMatch} 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze Match'
            )}
          </Button>
        </CardFooter>
      </Card>

      {analysis && (
        <Card className="bg-[#333333] border-none text-white">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span className="text-xl">Match Analysis Results</span>
              <span className={`ml-auto text-2xl font-bold ${getScoreColor(analysis.score)}`}>
                {analysis.score}%
              </span>
            </CardTitle>
            <CardDescription className="text-gray-300">
              Your CV compatibility with the job description
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab} value={activeTab}>
              <TabsList className="grid grid-cols-5 bg-[#1D1D1D]">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="scores">Scores</TabsTrigger>
                <TabsTrigger value="keywords">Keywords</TabsTrigger>
                <TabsTrigger value="sections">Sections</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="pt-4">
                <div className="space-y-4">
                  <div className="rounded-lg bg-[#1D1D1D] p-4">
                    <h3 className="text-lg font-medium text-[#B4916C] mb-2">Overall Match</h3>
                    <div className="mb-4">
                      <Progress className="h-3 bg-gray-700">
                        <ProgressIndicator className={`${getProgressColor(analysis.score)}`} style={{ width: `${analysis.score}%` }} />
                      </Progress>
                    </div>
                    <p className="text-gray-300">{analysis.detailedAnalysis}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg bg-[#1D1D1D] p-4">
                      <h3 className="text-lg font-medium text-[#B4916C] mb-2">Top Strengths</h3>
                      <ul className="space-y-2">
                        {analysis.matchedKeywords.slice(0, 3).map((keyword, index) => (
                          <li key={index} className="flex items-center">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-white">{keyword.keyword}</span>
                            <span className="ml-auto text-green-500 font-medium">{keyword.relevance}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="rounded-lg bg-[#1D1D1D] p-4">
                      <h3 className="text-lg font-medium text-[#B4916C] mb-2">Key Gaps</h3>
                      <ul className="space-y-2">
                        {analysis.missingKeywords.slice(0, 3).map((keyword, index) => (
                          <li key={index} className="flex items-center">
                            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                            <span className="text-white">{keyword.keyword}</span>
                            <span className="ml-auto text-red-500 font-medium">{keyword.importance}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <div className="rounded-lg bg-[#1D1D1D] p-4">
                    <h3 className="text-lg font-medium text-[#B4916C] mb-2">Skill Gap Analysis</h3>
                    <p className="text-gray-300">{analysis.skillGap}</p>
                  </div>
                  
                  <div className="rounded-lg bg-[#1D1D1D] p-4">
                    <h3 className="text-lg font-medium text-[#B4916C] mb-2">Improvement Potential</h3>
                    <div className="mb-4">
                      <Progress className="h-3 bg-gray-700">
                        <ProgressIndicator className="bg-blue-500" style={{ width: `${analysis.improvementPotential}%` }} />
                      </Progress>
                    </div>
                    <p className="text-gray-300">
                      With targeted improvements, you could increase your match score by up to {analysis.improvementPotential}%.
                    </p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="scores" className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {renderScoreCard("Skills Match", analysis.dimensionalScores.skillsMatch, <FileText className="h-4 w-4" />)}
                  {renderScoreCard("Experience Match", analysis.dimensionalScores.experienceMatch, <FileText className="h-4 w-4" />)}
                  {renderScoreCard("Education Match", analysis.dimensionalScores.educationMatch, <FileText className="h-4 w-4" />)}
                  {renderScoreCard("Industry Fit", analysis.dimensionalScores.industryFit, <FileText className="h-4 w-4" />)}
                  {renderScoreCard("Overall Compatibility", analysis.dimensionalScores.overallCompatibility, <FileText className="h-4 w-4" />)}
                  {renderScoreCard("Keyword Density", analysis.dimensionalScores.keywordDensity, <FileText className="h-4 w-4" />)}
                  {renderScoreCard("Format Compatibility", analysis.dimensionalScores.formatCompatibility, <FileText className="h-4 w-4" />)}
                  {renderScoreCard("Content Relevance", analysis.dimensionalScores.contentRelevance, <FileText className="h-4 w-4" />)}
                </div>
              </TabsContent>
              
              <TabsContent value="keywords" className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-lg bg-[#1D1D1D] p-4">
                    <h3 className="text-lg font-medium text-[#B4916C] mb-4">Matched Keywords</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      {analysis.matchedKeywords.map((keyword, index) => (
                        <div key={index} className="border-b border-gray-700 pb-2">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-white">{keyword.keyword}</span>
                            <span className={`${getScoreColor(keyword.relevance)}`}>{keyword.relevance}%</span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-400">
                            <span>Frequency: {keyword.frequency}</span>
                            <span>Placement: {keyword.placement}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="rounded-lg bg-[#1D1D1D] p-4">
                    <h3 className="text-lg font-medium text-[#B4916C] mb-4">Missing Keywords</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      {analysis.missingKeywords.map((keyword, index) => (
                        <div key={index} className="border-b border-gray-700 pb-2">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-white">{keyword.keyword}</span>
                            <span className="text-red-500">{keyword.importance}% importance</span>
                          </div>
                          <div className="text-sm text-gray-400">
                            <span>Suggested placement: {keyword.suggestedPlacement}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="sections" className="pt-4">
                <div className="space-y-6">
                  {renderSectionAnalysis("Profile/Summary", analysis.sectionAnalysis.profile)}
                  {renderSectionAnalysis("Skills", analysis.sectionAnalysis.skills)}
                  {renderSectionAnalysis("Experience", analysis.sectionAnalysis.experience)}
                  {renderSectionAnalysis("Education", analysis.sectionAnalysis.education)}
                  {renderSectionAnalysis("Achievements", analysis.sectionAnalysis.achievements)}
                </div>
              </TabsContent>
              
              <TabsContent value="recommendations" className="pt-4">
                <div className="rounded-lg bg-[#1D1D1D] p-4">
                  <h3 className="text-lg font-medium text-[#B4916C] mb-4">Improvement Recommendations</h3>
                  <ul className="space-y-3">
                    {analysis.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start">
                        <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 