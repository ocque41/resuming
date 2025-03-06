"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Building, MapPin, Clock, Briefcase, DollarSign, ChevronRight, 
  List, Map, Search, Layers, PercentCircle, Filter, Compass, ListFilter, ChevronDown, BarChart3, Star, StarHalf
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from '@/components/ui/input';

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
        body: JSON.stringify({
          cvId: cv.id,
          // If we had the raw text, we would send it here
        }),
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract keywords');
      }

      const keywordsData = await extractResponse.json();
      setExtractedKeywords(keywordsData);

      // Search for jobs based on keywords
      await searchJobs(keywordsData.keywords, keywordsData.locations[0] || '');
    } catch (error) {
      console.error('Error processing CV:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchJobs = async (keywords: string[] = [], location: string = '', pageNum: number = 1) => {
    setIsLoading(true);
    try {
      const searchResponse = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: keywords.length > 0 ? keywords : searchQuery ? [searchQuery] : [],
          location: location || locationQuery,
          page: pageNum,
          limit: 10,
        }),
      });

      if (!searchResponse.ok) {
        throw new Error('Failed to search jobs');
      }

      const searchData = await searchResponse.json();
      
      if (pageNum === 1) {
        setJobs(searchData.jobs);
        setFilteredJobs(searchData.jobs);
      } else {
        setJobs(prev => [...prev, ...searchData.jobs]);
        setFilteredJobs(prev => [...prev, ...searchData.jobs]);
      }
      
      setHasMore(searchData.pagination.page < searchData.pagination.totalPages);
      setPage(pageNum);
    } catch (error) {
      console.error('Error searching jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreJobs = () => {
    if (hasMore && !isLoading) {
      const nextPage = page + 1;
      searchJobs(
        extractedKeywords?.keywords || [],
        extractedKeywords?.locations[0] || '',
        nextPage
      );
    }
  };

  useEffect(() => {
    if (jobs.length === 0) return;

    const filtered = jobs.filter(job => {
      const matchesSearch = searchQuery 
        ? job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
          job.description.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const matchesLocation = locationQuery
        ? job.location.toLowerCase().includes(locationQuery.toLowerCase()) || job.remote
        : true;

      return matchesSearch && matchesLocation;
    });

    setFilteredJobs(filtered);
  }, [searchQuery, locationQuery, jobs]);

  useEffect(() => {
    if (activeTab === "map" && !isMapInitialized && filteredJobs.length > 0) {
      // In a real implementation, this would initialize a map library like Leaflet or Google Maps
      console.log('Initializing map with jobs:', filteredJobs);
      setIsMapInitialized(true);
    }
  }, [activeTab, isMapInitialized, filteredJobs]);

  const renderCVSelector = () => (
    <div className="mb-4">
      <ComboboxPopover
        items={cvs.map(cv => ({
          id: cv.id.toString(),
          label: cv.fileName,
          value: cv
        }))}
        onSelect={(item: ComboboxItem) => handleCVSelect(item.value as JobsCardCV)}
        placeholder="Select a CV..."
        emptyText="No CVs found"
        buttonText={selectedCV ? selectedCV.fileName : "Select a CV to find matching jobs"}
        className="w-full"
      />
    </div>
  );

  const renderCompatibilityScore = (score: number) => {
    const scoreColor = 
      score >= 90 ? 'bg-green-600' :
      score >= 75 ? 'bg-green-500' :
      score >= 60 ? 'bg-amber-500' :
      'bg-red-500';
    
    return (
      <div className="flex items-center gap-1.5">
        <div className={`${scoreColor} text-white px-2 py-0.5 rounded-md text-xs font-medium`}>
          {score}%
        </div>
        {score >= 90 ? (
          <Star size={14} className="text-yellow-500 fill-yellow-500" />
        ) : score >= 75 ? (
          <StarHalf size={14} className="text-yellow-500 fill-yellow-500" />
        ) : null}
      </div>
    );
  };

  const renderJobListings = () => {
    if (isLoading && jobs.length === 0) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-[#B4916C]/20 rounded-lg p-4 space-y-3 bg-[#0A0A0A]">
              <Skeleton className="h-6 w-2/3 bg-gray-800" />
              <Skeleton className="h-4 w-1/2 bg-gray-800" />
              <Skeleton className="h-4 w-1/3 bg-gray-800" />
              <div className="flex gap-2 mt-2">
                <Skeleton className="h-6 w-16 bg-gray-800" />
                <Skeleton className="h-6 w-16 bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (filteredJobs.length === 0 && !isLoading) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-400">No jobs found matching your criteria</p>
          {selectedCV && (
            <Button 
              variant="link" 
              onClick={() => handleCVSelect(selectedCV)}
              className="mt-2 text-[#B4916C]"
            >
              Reset search
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredJobs.map((job) => (
          <div key={job.id} className="border border-[#B4916C]/20 rounded-lg p-4 bg-[#0A0A0A] hover:border-[#B4916C]/50 transition-all duration-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-lg text-white">{job.title}</h3>
              {renderCompatibilityScore(job.compatibilityScore)}
            </div>
            
            <div className="flex items-center text-sm text-gray-400 mb-2">
              <Building size={14} className="mr-1" />
              <span className="mr-4">{job.company}</span>
              <MapPin size={14} className="mr-1" />
              <span>{job.location}</span>
              {job.remote && <Badge className="ml-2 bg-[#B4916C]/10 text-[#B4916C] border-[#B4916C]/20">Remote</Badge>}
            </div>
            
            {job.salary && (
              <div className="flex items-center text-sm text-gray-400 mb-2">
                <BarChart3 size={14} className="mr-1" />
                <span>{job.salary}</span>
              </div>
            )}
            
            <p className="text-sm text-gray-300 mb-3 line-clamp-2">{job.description}</p>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs flex items-center gap-1 text-gray-400 border-gray-700">
                  <Clock size={12} />
                  {job.postedAt}
                </Badge>
                <Badge variant="outline" className="text-xs text-gray-400 border-gray-700">
                  {job.source}
                </Badge>
              </div>
              
              <a 
                href={job.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#B4916C] hover:text-[#B4916C]/90 text-sm font-medium flex items-center"
              >
                View Job
                <ChevronRight size={16} />
              </a>
            </div>
          </div>
        ))}
        
        {hasMore && (
          <div className="text-center pt-2">
            <Button
              variant="outline"
              onClick={loadMoreJobs}
              disabled={isLoading}
              className="w-full text-[#B4916C] border-[#B4916C]/20 hover:bg-[#B4916C]/10"
            >
              {isLoading ? 'Loading...' : 'Load More Jobs'}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderJobMap = () => {
    if (isLoading && jobs.length === 0) {
      return <Skeleton className="h-[400px] w-full rounded-lg" />;
    }

    if (filteredJobs.length === 0 && !isLoading) {
      return (
        <div className="text-center py-8 border border-dashed rounded-lg h-[400px] flex items-center justify-center">
          <div>
            <p className="text-muted-foreground">No jobs found to display on map</p>
            {selectedCV && (
              <Button 
                variant="link" 
                onClick={() => handleCVSelect(selectedCV)}
                className="mt-2"
              >
                Reset search
              </Button>
            )}
          </div>
        </div>
      );
    }

    // In a real implementation, this would render a map with job markers
    return (
      <div className="border border-muted rounded-lg h-[500px] bg-[#050505] relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Compass size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Map View</p>
            <p className="text-sm text-muted-foreground">
              Showing {filteredJobs.length} jobs on the map
            </p>
            <p className="text-xs text-muted-foreground mt-4 max-w-[500px]">
              In a production environment, this would display an interactive map using a library like Leaflet, Google Maps, or Mapbox with markers for each job location.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg relative group">
      {/* Coming Soon Overlay - Always visible on mobile, visible on hover for desktop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-10 flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
        <div className="text-center p-6">
          <span className="inline-block px-4 py-2 bg-[#B4916C] text-black rounded-full text-lg font-bold mb-4">
            Coming Soon
          </span>
          <p className="text-white text-lg mb-2">Job search feature is under development</p>
          <p className="text-gray-300 text-sm max-w-md">
            We're working hard to bring you the best job matching experience. Stay tuned for updates!
          </p>
        </div>
      </div>

      <CardHeader className="bg-[#B4916C]/10 pb-4">
        <CardTitle className="text-xl font-bold text-[#B4916C]">Job Opportunities</CardTitle>
        <CardDescription className="text-gray-300">
          Find job openings matching your CV and skills
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6">
        {renderCVSelector()}

        {extractedKeywords && selectedCV && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {extractedKeywords.keywords.slice(0, 8).map((keyword, i) => (
                <Badge key={i} variant="custom" className="bg-[#B4916C]/10 text-[#B4916C] border-[#B4916C]/20">
                  {keyword}
                </Badge>
              ))}
              {extractedKeywords.keywords.length > 8 && (
                <Badge variant="outline" className="text-gray-400 border-gray-700">+{extractedKeywords.keywords.length - 8} more</Badge>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Briefcase size={12} />
                {extractedKeywords.jobTypes[0] || 'Any role'}
              </span>
              
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {extractedKeywords.locations.length > 0 ? extractedKeywords.locations[0] : 'Any location'}
              </span>
              
              <span>{extractedKeywords.experience}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search jobs..."
              className="pl-9 bg-[#0A0A0A] border border-[#B4916C]/20 rounded-md text-white py-2 px-3"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="relative flex-1">
            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Location..."
              className="pl-9 bg-[#0A0A0A] border border-[#B4916C]/20 rounded-md text-white py-2 px-3"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
            />
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            className="sm:w-auto w-full border-[#B4916C]/20 hover:bg-[#B4916C]/10 text-white"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} className="mr-2" />
            Filters
            <ChevronDown size={16} className="ml-2" />
          </Button>
        </div>

        {showFilters && (
          <div className="mb-4 p-3 border border-[#B4916C]/20 rounded-md bg-[#0A0A0A]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-white">Additional Filters</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-white hover:bg-[#B4916C]/10"
              >
                Close
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-400">Salary Range</label>
                <select className="w-full text-sm rounded-md border border-[#B4916C]/20 bg-[#050505] text-white p-2">
                  <option>Any salary</option>
                  <option>$50k - $80k</option>
                  <option>$80k - $100k</option>
                  <option>$100k - $130k</option>
                  <option>$130k+</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-400">Job Type</label>
                <select className="w-full text-sm rounded-md border border-[#B4916C]/20 bg-[#050505] text-white p-2">
                  <option>All types</option>
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                  <option>Remote</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-400">Date Posted</label>
                <select className="w-full text-sm rounded-md border border-[#B4916C]/20 bg-[#050505] text-white p-2">
                  <option>Any time</option>
                  <option>Today</option>
                  <option>Past 3 days</option>
                  <option>Past week</option>
                  <option>Past month</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full mb-4 bg-[#121212]">
            <TabsTrigger value="list" className="flex-1 data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              <ListFilter className="mr-2 h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="map" className="flex-1 data-[state=active]:bg-[#B4916C]/20 data-[state=active]:text-[#B4916C]">
              <MapPin className="mr-2 h-4 w-4" />
              Map View
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="mt-0">
            {renderJobListings()}
          </TabsContent>
          
          <TabsContent value="map" className="mt-0">
            {renderJobMap()}
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex justify-between border-t border-[#B4916C]/20 pt-4 text-xs text-gray-500">
        <div>Powered by multiple job search APIs</div>
        {jobs.length > 0 && (
          <div>{filteredJobs.length} jobs found</div>
        )}
      </CardFooter>
    </Card>
  );
} 