export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  date: string;
  readTime: string;
  image: string;
  fallbackImage: string;
  content?: string;
}

export const blogPosts: BlogPost[] = [
  {
    id: 1,
    title: "Optimizing Your CV for Applicant Tracking Systems",
    slug: "optimizing-cv-for-ats",
    category: "Career Tips",
    excerpt: "Learn how to optimize your CV to pass through ATS filters and increase your chances of getting interviews.",
    date: "July 15, 2023",
    readTime: "5 min read",
    image: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=2070&auto=format&fit=crop",
    fallbackImage: "/images/blog/cv-optimization.jpg",
    content: "Full article content here..."
  },
  {
    id: 2,
    title: "How AI is Transforming the Job Application Process",
    slug: "ai-transforming-job-application",
    category: "Industry Insights",
    excerpt: "Discover how artificial intelligence is changing the way companies hire and how you can leverage this to your advantage.",
    date: "August 3, 2023",
    readTime: "7 min read",
    image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=2070&auto=format&fit=crop",
    fallbackImage: "/images/blog/ai-hiring.jpg",
    content: "Full article content here..."
  },
  {
    id: 3,
    title: "The Power of Tailored CVs for Different Job Applications",
    slug: "tailored-cvs-job-applications",
    category: "CV Strategies",
    excerpt: "Why one-size-fits-all doesn't work in job applications and how to efficiently customize your CV for each opportunity.",
    date: "August 21, 2023",
    readTime: "6 min read",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop",
    fallbackImage: "/images/blog/custom-cv.jpg",
    content: "Full article content here..."
  },
  {
    id: 4,
    title: "5 Common CV Mistakes That Could Cost You the Job",
    slug: "common-cv-mistakes",
    category: "Career Tips",
    excerpt: "Avoid these crucial mistakes that recruiters immediately notice and that could prevent you from landing interviews.",
    date: "September 5, 2023",
    readTime: "4 min read",
    image: "https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?q=80&w=2076&auto=format&fit=crop",
    fallbackImage: "/images/blog/cv-mistakes.jpg",
    content: "Full article content here..."
  },
  {
    id: 5,
    title: "Leveraging Data Analysis to Improve Your Job Search Strategy",
    slug: "data-analysis-job-search",
    category: "Technology",
    excerpt: "How modern job seekers are using data insights to refine their approach and stand out in competitive markets.",
    date: "September 18, 2023",
    readTime: "8 min read",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop",
    fallbackImage: "/images/blog/data-analysis.jpg",
    content: "Full article content here..."
  },
  {
    id: 6,
    title: "The Future of Work: Skills That Will Matter Most in 2025",
    slug: "future-work-skills-2025",
    category: "Industry Insights",
    excerpt: "A deep dive into the emerging skills landscape and how to prepare yourself for the changing demands of employers.",
    date: "October 2, 2023",
    readTime: "9 min read",
    image: "https://images.unsplash.com/photo-1607988795691-3d0147b43231?q=80&w=2070&auto=format&fit=crop",
    fallbackImage: "/images/blog/future-skills.jpg",
    content: "Full article content here..."
  },
  {
    id: 7,
    title: "From Application to Offer: Mastering Each Stage of the Hiring Process",
    slug: "mastering-hiring-process",
    category: "Career Tips",
    excerpt: "A comprehensive guide to navigating the modern hiring process, from initial application to negotiating your offer.",
    date: "October 15, 2023",
    readTime: "10 min read",
    image: "https://images.unsplash.com/photo-1573496130141-209d200cebd8?q=80&w=2069&auto=format&fit=crop",
    fallbackImage: "/images/blog/hiring-process.jpg",
    content: "Full article content here..."
  },
  {
    id: 8,
    title: "How to Effectively Highlight Your Achievements in Your CV",
    slug: "highlight-achievements-cv",
    category: "CV Strategies",
    excerpt: "Learn the art of showcasing your professional accomplishments in a way that resonates with hiring managers.",
    date: "November 1, 2023",
    readTime: "6 min read",
    image: "https://images.unsplash.com/photo-1574887427561-d3d5d58c9273?q=80&w=2127&auto=format&fit=crop",
    fallbackImage: "/images/blog/achievements.jpg",
    content: "Full article content here..."
  },
  {
    id: 9,
    title: "The Psychology Behind Successful Job Applications",
    slug: "psychology-successful-applications",
    category: "Industry Insights",
    excerpt: "Understanding how recruiters think and make decisions can give you a significant advantage in your job search.",
    date: "November 20, 2023",
    readTime: "7 min read",
    image: "https://images.unsplash.com/photo-1565688534245-05d6b5be184a?q=80&w=2070&auto=format&fit=crop",
    fallbackImage: "/images/blog/psychology.jpg",
    content: "Full article content here..."
  }
]; 