import { NextResponse } from 'next/server';

// Mock API to return job listings based on CV keywords
export async function POST(req: Request) {
  try {
    const { keywords, location, page = 1, limit = 10 } = await req.json();
    
    // In a real implementation, this would:
    // 1. Call external APIs like Indeed, LinkedIn, ZipRecruiter
    // 2. Parse and normalize the responses
    // 3. Compute compatibility scores based on the CV keywords
    // 4. Return the combined results
    
    // For now, returning mock data
    const mockJobs = [
      {
        id: `indeed-${Date.now()}-1`,
        title: "Senior Frontend Developer",
        company: "TechCorp",
        location: "San Francisco, CA",
        remote: false,
        salary: "$120,000 - $150,000",
        description: "We're looking for an experienced frontend developer with React and TypeScript expertise.",
        url: "https://example.com/job1",
        source: "Indeed",
        postedAt: "2 days ago",
        compatibilityScore: 92,
        latitude: 37.7749,
        longitude: -122.4194
      },
      {
        id: `linkedin-${Date.now()}-2`,
        title: "Full Stack Engineer",
        company: "StartupXYZ",
        location: "New York, NY",
        remote: true,
        salary: "$130,000 - $160,000",
        description: "Join our fast-growing team as a full stack engineer working with Next.js and Node.",
        url: "https://example.com/job2",
        source: "LinkedIn",
        postedAt: "5 days ago",
        compatibilityScore: 87,
        latitude: 40.7128,
        longitude: -74.0060
      },
      {
        id: `ziprecruiter-${Date.now()}-3`,
        title: "Backend Developer",
        company: "Enterprise Solutions",
        location: "Austin, TX",
        remote: false,
        description: "Backend developer with experience in Python and cloud services needed.",
        url: "https://example.com/job3",
        source: "ZipRecruiter",
        postedAt: "1 week ago",
        compatibilityScore: 78,
        latitude: 30.2672,
        longitude: -97.7431
      },
      {
        id: `indeed-${Date.now()}-4`,
        title: "DevOps Engineer",
        company: "CloudTech",
        location: "Seattle, WA",
        remote: false,
        salary: "$140,000 - $180,000",
        description: "Looking for a skilled DevOps engineer to manage our infrastructure.",
        url: "https://example.com/job4",
        source: "Indeed",
        postedAt: "3 days ago",
        compatibilityScore: 65,
        latitude: 47.6062,
        longitude: -122.3321
      },
      {
        id: `linkedin-${Date.now()}-5`,
        title: "UI/UX Designer",
        company: "CreativeAgency",
        location: "Los Angeles, CA",
        remote: true,
        description: "Creative UI/UX designer needed for our digital products team.",
        url: "https://example.com/job5",
        source: "LinkedIn",
        postedAt: "4 days ago",
        compatibilityScore: 73,
        latitude: 34.0522,
        longitude: -118.2437
      }
    ];

    // Filter by keywords if provided
    let filteredJobs = mockJobs;
    if (keywords && keywords.length > 0) {
      const keywordsList = Array.isArray(keywords) ? keywords : [keywords];
      filteredJobs = mockJobs.filter(job => {
        return keywordsList.some(keyword => 
          job.title.toLowerCase().includes(keyword.toLowerCase()) || 
          job.description.toLowerCase().includes(keyword.toLowerCase())
        );
      });
    }

    // Filter by location if provided
    if (location) {
      filteredJobs = filteredJobs.filter(job => 
        job.location.toLowerCase().includes(location.toLowerCase()) || job.remote
      );
    }

    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

    // Return with pagination metadata
    return NextResponse.json({
      jobs: paginatedJobs,
      pagination: {
        total: filteredJobs.length,
        page,
        limit,
        totalPages: Math.ceil(filteredJobs.length / limit)
      }
    });
  } catch (error) {
    console.error('Error in job search API:', error);
    return NextResponse.json(
      { error: 'Failed to search for jobs' },
      { status: 500 }
    );
  }
} 