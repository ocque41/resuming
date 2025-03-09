"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Building, MapPin, Clock, Briefcase, DollarSign, ChevronRight, 
  List, Map, Search, Layers, PercentCircle, Filter, Compass, ListFilter, ChevronDown, BarChart3, Star, StarHalf,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from '@/components/ui/input';
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

// Create our own ComboboxPopover component since it's not exported
interface ComboboxItem {
  id: string;
  label: string;
  value: any;
}

interface ComboboxPopoverProps {
  items: ComboboxItem[];
  onSelect: (item: ComboboxItem) => void;
  placeholder: string;
  emptyText: string;
  buttonText: string;
  className?: string;
}

function ComboboxPopover({ 
  items, 
  onSelect, 
  placeholder, 
  emptyText, 
  buttonText, 
  className 
}: ComboboxPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className={`relative ${className}`}>
      <Button 
        variant="outline" 
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        {buttonText}
        <ChevronDown className="ml-2 h-4 w-4" />
      </Button>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-[#050505] border border-muted rounded-md shadow-lg">
          <Input
            placeholder={placeholder}
            className="border-b border-muted rounded-t-md rounded-b-none"
          />
          
          <div className="max-h-60 overflow-auto py-1">
            {items.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              items.map(item => (
                <div
                  key={item.id}
                  className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                  onClick={() => {
                    onSelect(item);
                    setIsOpen(false);
                  }}
                >
                  {item.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Use a more flexible CV type that can work with the actual DB schema
interface JobsCardCV {
  id: string;
  userId: string;
  fileName: string;
  filePath?: string;    // Handle both versions
  filepath?: string;    // Support both casing versions
  createdAt: Date;
  rawText?: string | null;
  metadata?: {
    [key: string]: any;
  };
}

interface JobsCardProps {
  cvs: JobsCardCV[];
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary?: string;
  description: string;
  url: string;
  source: string;
  postedAt: string;
  compatibilityScore: number;
  latitude: number;
  longitude: number;
}

// Keywords extracted from CV
interface ExtractedKeywords {
  keywords: string[];
  jobTypes: string[];
  locations: string[];
  experience: string;
}

export default function JobsCard({ cvs }: JobsCardProps) {
  const [activeTab, setActiveTab] = useState("list");
  const [selectedCV, setSelectedCV] = useState<JobsCardCV | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [extractedKeywords, setExtractedKeywords] = useState<ExtractedKeywords | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile on component mount
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Listen for window resize events
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const handleCVSelect = useCallback(async (cv: JobsCardCV) => {
    setIsLoading(true);
    setSelectedCV(cv);
    setJobs([]);
    setFilteredJobs([]);
    setPage(1);
    setHasMore(true);
    setExtractedKeywords(null);

    try {
      // Extract keywords from CV
      const extractResponse = await fetch('/api/jobs/extract-keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvId: cv.id }),
      });
      
      if (!extractResponse.ok) {
        throw new Error('Failed to extract keywords from CV');
      }
      
      const extractData = await extractResponse.json();
      setExtractedKeywords(extractData);
      
      // Use the extracted keywords to search for jobs
      if (extractData.keywords.length > 0) {
        setSearchQuery(extractData.keywords.slice(0, 3).join(', '));
        
        if (extractData.locations.length > 0) {
          setLocationQuery(extractData.locations[0]);
        }
      }
    } catch (error) {
      console.error('Error extracting keywords:', error);
      // Set some default values if extraction fails
      setSearchQuery('');
      setLocationQuery('');
    }
    
    setIsLoading(false);
  }, []);

  const renderComingSoonCard = () => (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
      <div className="text-center p-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#B4916C]/20 mb-4">
          <AlertCircle className="h-8 w-8 text-[#B4916C]" />
        </div>
        <h3 className="text-xl font-bold text-[#B4916C] mb-2">Coming Soon</h3>
        <p className="text-gray-300 mb-4">Job matching feature is currently in development.</p>
        <p className="text-gray-400 text-sm">Automatically find jobs that match your CV.</p>
      </div>
    </div>
  );

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Card className="w-full shadow-lg border-0 relative">
          <CardHeader className="bg-[#121212] text-white rounded-t-lg">
            <CardTitle className="text-[#B4916C] flex items-center gap-2">
              <span>Find Matching Jobs</span>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Search for jobs that match your CV
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 relative">
            {renderComingSoonCard()}
            
            <Tabs 
              defaultValue="list" 
              value={activeTab}
              onValueChange={setActiveTab}
              className="opacity-40 pointer-events-none"
            >
              <div className="flex items-center justify-between mb-4">
                <TabsList className="grid grid-cols-2 h-9">
                  <TabsTrigger value="list" className="text-xs">
                    <List className="mr-1 h-4 w-4" />
                    List View
                  </TabsTrigger>
                  <TabsTrigger value="map" className="text-xs">
                    <Map className="mr-1 h-4 w-4" />
                    Map View
                  </TabsTrigger>
                </TabsList>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-1" />
                  <span className="text-xs">Filters</span>
                </Button>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Job title, keywords"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                <div className="relative">
                  <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Location"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              
              {(cvs.length > 0) && (
                <div className="mb-6">
                  <div className="text-sm font-medium mb-2">Select CV for Job Matching</div>
                  <ComboboxPopover
                    items={cvs.map(cv => ({ id: cv.id, label: cv.fileName, value: cv }))}
                    onSelect={(item) => handleCVSelect(item.value)}
                    placeholder="Search CVs"
                    emptyText="No CVs found"
                    buttonText={selectedCV ? selectedCV.fileName : "Select a CV"}
                    className="w-full"
                  />
                </div>
              )}
              
              {showFilters && (
                <div className="space-y-3 mb-4 p-3 border border-border rounded-md bg-card">
                  <div className="text-sm font-medium">Additional Filters</div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="justify-start">
                      <Clock className="mr-2 h-3 w-3" />
                      <span className="text-xs">Date Posted</span>
                    </Button>
                    
                    <Button variant="outline" size="sm" className="justify-start">
                      <Briefcase className="mr-2 h-3 w-3" />
                      <span className="text-xs">Job Type</span>
                    </Button>
                    
                    <Button variant="outline" size="sm" className="justify-start">
                      <Building className="mr-2 h-3 w-3" />
                      <span className="text-xs">Company</span>
                    </Button>
                    
                    <Button variant="outline" size="sm" className="justify-start">
                      <DollarSign className="mr-2 h-3 w-3" />
                      <span className="text-xs">Salary</span>
                    </Button>
                  </div>
                </div>
              )}
              
              <TabsContent value="list" className="mt-0">
                <div className="space-y-4">
                  {isLoading ? (
                    // Loading skeletons for jobs
                    Array(3).fill(0).map((_, i) => (
                      <div key={i} className="p-4 border border-border rounded-md">
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/4 mb-4" />
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-5/6" />
                      </div>
                    ))
                  ) : jobs.length > 0 ? (
                    // Render jobs
                    <div>Jobs would display here</div>
                  ) : (
                    // No jobs found or no search performed yet
                    <div className="text-center py-10">
                      <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Jobs Found</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Select a CV and search for jobs to see matches.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="map" className="mt-0">
                <div className="rounded-md border border-border h-[300px] flex items-center justify-center bg-card/50">
                  <div className="text-center">
                    <Map className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Map view will display job locations</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          
          <CardFooter className="bg-[#121212] text-[#B4916C] p-4 rounded-b-lg border-t border-[#B4916C]/20 opacity-40 pointer-events-none">
            <div className="text-xs text-gray-400">
              <div className="flex items-center justify-center w-full">
                <PercentCircle className="h-4 w-4 mr-1" />
                <span>ATS match analysis and job compatibility scoring</span>
              </div>
            </div>
          </CardFooter>
        </Card>
      </HoverCardTrigger>
      <HoverCardContent className="w-full max-w-md p-0 border border-[#B4916C]/20 bg-black">
        <div className="p-4">
          <div className="flex items-center mb-3">
            <AlertCircle className="h-5 w-5 text-[#B4916C] mr-2" />
            <h3 className="text-lg font-semibold text-[#B4916C]">Job Matching Coming Soon</h3>
          </div>
          <p className="text-gray-300 mb-3">
            Our intelligent job matching feature will help you find positions that align perfectly with your CV.
          </p>
          <ul className="space-y-2 mb-3">
            <li className="flex items-start">
              <span className="text-[#B4916C] mr-2">•</span>
              <span className="text-gray-400">AI-powered keyword extraction</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#B4916C] mr-2">•</span>
              <span className="text-gray-400">Location-based job search</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#B4916C] mr-2">•</span>
              <span className="text-gray-400">Compatibility scoring and match analysis</span>
            </li>
          </ul>
          <p className="text-sm text-gray-500">
            We're working hard to bring this feature to you soon.
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
} 