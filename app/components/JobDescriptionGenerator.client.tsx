'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Loader2, CheckCircle, Copy, Download } from "lucide-react";
import { toast } from "app/components/ui/use-toast";

const experienceLevels = [
  "Entry Level",
  "Junior",
  "Mid-Level",
  "Senior",
  "Lead",
  "Manager",
  "Director",
  "Executive"
];

interface JobDescriptionResult {
  title?: string;
  overview?: string;
  aboutCompany?: string;
  responsibilities?: string[];
  requirements?: {
    essential: string[];
    preferred: string[];
  };
  skills?: {
    technical: string[];
    soft: string[];
  };
  experienceEducation?: string;
  benefits?: string[];
  applicationProcess?: string;
  fullDescription?: string;
}

export default function JobDescriptionGenerator() {
  const [loading, setLoading] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [industry, setIndustry] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [keySkills, setKeySkills] = useState('');
  const [location, setLocation] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState<JobDescriptionResult | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const generateJobDescription = async () => {
    if (!jobTitle.trim()) {
      toast({
        title: "Job title required",
        description: "Please enter a job title to generate a description",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/job-description/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle,
          industry,
          experienceLevel,
          keySkills,
          location,
          companyDescription,
          additionalDetails
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.jobDescription) {
        throw new Error(data.error || 'Failed to generate job description');
      }

      // Convert plain text response to our structure
      let descriptionObj: JobDescriptionResult = {
        fullDescription: data.jobDescription,
        title: jobTitle
      };
      
      // Try to extract sections from text
      try {
        const sections = extractSectionsFromText(data.jobDescription);
        descriptionObj = { ...descriptionObj, ...sections };
      } catch (parseError) {
        console.error('Error parsing sections:', parseError);
        // Still use the raw text even if parsing failed
      }
      
      setGeneratedDescription(descriptionObj);
      
      toast({
        title: "Success!",
        description: "Job description has been generated successfully",
      });
    } catch (error) {
      console.error('Error generating job description:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate job description",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to extract structured data from text description
  const extractSectionsFromText = (text: string): Partial<JobDescriptionResult> => {
    const result: Partial<JobDescriptionResult> = {};
    
    // Try to extract Overview/Summary
    const overviewMatch = text.match(/(?:Overview|Summary):(.*?)(?:\n\n|\n(?=[A-Z]))/s);
    if (overviewMatch) result.overview = overviewMatch[1].trim();
    
    // Try to extract About Company
    const companyMatch = text.match(/(?:About|About the Company|Company):(.*?)(?:\n\n|\n(?=[A-Z]))/s);
    if (companyMatch) result.aboutCompany = companyMatch[1].trim();
    
    // Try to extract Responsibilities
    const responsibilitiesMatch = text.match(/Responsibilities:(.*?)(?:\n\n|\n(?=[A-Z]))/s);
    if (responsibilitiesMatch) {
      result.responsibilities = responsibilitiesMatch[1]
        .trim()
        .split(/\n(?=[-•*])/)
        .map(item => item.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
    }
    
    // Try to extract Requirements
    const requirementsMatch = text.match(/(?:Requirements|Qualifications):(.*?)(?:\n\n|\n(?=[A-Z]))/s);
    if (requirementsMatch) {
      const reqItems = requirementsMatch[1]
        .trim()
        .split(/\n(?=[-•*])/)
        .map(item => item.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
      
      // Simple heuristic: first half essential, rest preferred
      const halfIndex = Math.ceil(reqItems.length / 2);
      result.requirements = {
        essential: reqItems.slice(0, halfIndex),
        preferred: reqItems.slice(halfIndex)
      };
    }
    
    // Try to extract Benefits
    const benefitsMatch = text.match(/(?:Benefits|Benefits\/Perks|Perks):(.*?)(?:\n\n|\n(?=[A-Z]))/s);
    if (benefitsMatch) {
      result.benefits = benefitsMatch[1]
        .trim()
        .split(/\n(?=[-•*])/)
        .map(item => item.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
    }
    
    // Try to extract How to Apply
    const applyMatch = text.match(/(?:How to Apply|Application Process):(.*?)(?:\n\n|\n(?=[A-Z])|$)/s);
    if (applyMatch) result.applicationProcess = applyMatch[1].trim();
    
    return result;
  };
  
  const copyToClipboard = () => {
    if (!generatedDescription) return;
    
    navigator.clipboard.writeText(generatedDescription.fullDescription || '');
    toast({
      title: "Copied",
      description: "Job description copied to clipboard",
      variant: "default"
    });
  };

  const downloadAsText = () => {
    if (!generatedDescription) return;
    
    const blob = new Blob([generatedDescription.fullDescription || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jobTitle.replace(/\s+/g, '-').toLowerCase()}-job-description.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderListSection = (title: string, items: string[] = []) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2 text-[#B4916C]">{title}</h3>
      {items.length > 0 ? (
        <ul className="list-disc pl-5 space-y-1">
          {items.map((item, index) => (
            <li key={index} className="text-white">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400">No data available</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="bg-[#333333] border-none text-white">
        <CardHeader>
          <CardTitle className="text-xl">Job Description Generator</CardTitle>
          <CardDescription className="text-gray-300">
            Generate detailed job descriptions to match your CV against
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title*</Label>
            <Input 
              id="jobTitle" 
              value={jobTitle} 
              onChange={(e) => setJobTitle(e.target.value)} 
              placeholder="e.g. Frontend Developer"
              className="bg-[#1D1D1D] border-[#444444] text-white"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input 
                id="industry" 
                value={industry} 
                onChange={(e) => setIndustry(e.target.value)} 
                placeholder="e.g. Technology"
                className="bg-[#1D1D1D] border-[#444444] text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="experienceLevel">Experience Level</Label>
              <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                <SelectTrigger className="bg-[#1D1D1D] border-[#444444] text-white">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent className="bg-[#1D1D1D] border-[#444444] text-white">
                  {experienceLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="keySkills">Key Skills</Label>
            <Textarea 
              id="keySkills" 
              value={keySkills} 
              onChange={(e) => setKeySkills(e.target.value)} 
              placeholder="e.g. React, TypeScript, Node.js"
              className="bg-[#1D1D1D] border-[#444444] text-white h-20"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input 
              id="location" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
              placeholder="e.g. Remote, New York, London"
              className="bg-[#1D1D1D] border-[#444444] text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="companyDescription">Company Description</Label>
            <Textarea 
              id="companyDescription" 
              value={companyDescription} 
              onChange={(e) => setCompanyDescription(e.target.value)} 
              placeholder="Brief description of the company"
              className="bg-[#1D1D1D] border-[#444444] text-white h-20"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="additionalDetails">Additional Details</Label>
            <Textarea 
              id="additionalDetails" 
              value={additionalDetails} 
              onChange={(e) => setAdditionalDetails(e.target.value)} 
              placeholder="Any other details you'd like to include"
              className="bg-[#1D1D1D] border-[#444444] text-white h-20"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full bg-[#B4916C] hover:bg-[#9a7b5c] text-white" 
            onClick={generateJobDescription} 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Job Description'
            )}
          </Button>
        </CardFooter>
      </Card>

      {generatedDescription && (
        <Card className="bg-[#333333] border-none text-white">
          <CardHeader>
            <CardTitle className="text-xl">{generatedDescription.title}</CardTitle>
            <CardDescription className="text-gray-300">
              <div className="flex justify-between items-center">
                <span>Generated job description</span>
                <div className="space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-[#1D1D1D] hover:bg-[#2a2a2a]"
                    onClick={copyToClipboard}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-[#1D1D1D] hover:bg-[#2a2a2a]"
                    onClick={downloadAsText}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showFullDescription ? (
              <div className="whitespace-pre-wrap">{generatedDescription.fullDescription}</div>
            ) : (
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-[#B4916C]">Overview</h3>
                  <p className="text-white">{generatedDescription.overview}</p>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-[#B4916C]">About Company</h3>
                  <p className="text-white">{generatedDescription.aboutCompany}</p>
                </div>
                
                {renderListSection("Responsibilities", generatedDescription.responsibilities)}
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-[#B4916C]">Requirements</h3>
                  <div className="mb-2">
                    <h4 className="font-medium text-white">Essential:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {generatedDescription.requirements?.essential.map((item, index) => (
                        <li key={index} className="text-white">{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Preferred:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {generatedDescription.requirements?.preferred.map((item, index) => (
                        <li key={index} className="text-white">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-[#B4916C]">Skills</h3>
                  <div className="mb-2">
                    <h4 className="font-medium text-white">Technical:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {generatedDescription.skills?.technical.map((item, index) => (
                        <li key={index} className="text-white">{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Soft Skills:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {generatedDescription.skills?.soft.map((item, index) => (
                        <li key={index} className="text-white">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-[#B4916C]">Experience & Education</h3>
                  <p className="text-white">{generatedDescription.experienceEducation}</p>
                </div>
                
                {renderListSection("Benefits", generatedDescription.benefits)}
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-[#B4916C]">How to Apply</h3>
                  <p className="text-white">{generatedDescription.applicationProcess}</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="link"
              onClick={() => setShowFullDescription(!showFullDescription)}
              className="text-[#B4916C]"
            >
              {showFullDescription ? "Show Formatted View" : "Show Full Description"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
} 