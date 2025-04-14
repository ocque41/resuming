import os
import sys
import json
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from dotenv import load_dotenv
from openai import OpenAI
from openai._agents import Agent

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client with API key
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class JobApplicationAgent:
    """Agent that applies to LinkedIn jobs based on a CV."""
    
    def __init__(self, cv_text: str, job_count: int = 25):
        """
        Initialize the agent with CV text and desired job count.
        
        Args:
            cv_text: The text content of the CV to use for job matching
            job_count: The number of jobs to apply for (default: 25)
        """
        self.cv_text = cv_text
        self.job_count = job_count
        self.agent = self._create_agent()
        
    def _create_agent(self) -> Agent:
        """Create and configure the OpenAI agent."""
        
        # Define system instructions for the agent
        system_instructions = """
        You are a job application agent that helps users apply to jobs that match their CV.
        Follow these steps:
        1. Analyze the user's CV to extract key skills, experience, and qualifications.
        2. Search for relevant job postings on LinkedIn.
        3. Evaluate each job posting for fit with the user's CV.
        4. For jobs with a good fit, generate a tailored cover letter.
        5. Apply to the top-matching jobs, up to the specified limit.
        6. Report back with a summary of actions taken.
        
        You have access to these tools:
        - analyze_cv: Extract key information from the user's CV
        - search_jobs: Search for job postings on LinkedIn
        - evaluate_job: Evaluate a job posting for fit with the user's CV
        - generate_cover_letter: Generate a tailored cover letter for a job
        - apply_to_job: Apply to a job with the CV and cover letter
        """
        
        # Create the agent
        agent = client.beta.agents.create(
            name="Job Application Agent",
            description="Applies to LinkedIn jobs matching a user's CV",
            model="gpt-4o-mini",
            instructions=system_instructions,
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "analyze_cv",
                        "description": "Extracts key information from the user's CV",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "cv_text": {
                                    "type": "string",
                                    "description": "The text content of the CV"
                                }
                            },
                            "required": ["cv_text"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "search_jobs",
                        "description": "Searches for job postings on LinkedIn",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "keywords": {
                                    "type": "string",
                                    "description": "Keywords to search for"
                                },
                                "location": {
                                    "type": "string",
                                    "description": "Location to search in"
                                },
                                "limit": {
                                    "type": "integer",
                                    "description": "Maximum number of jobs to return"
                                }
                            },
                            "required": ["keywords"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "evaluate_job",
                        "description": "Evaluates a job posting for fit with the user's CV",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "job": {
                                    "type": "object",
                                    "description": "The job posting to evaluate"
                                },
                                "cv_analysis": {
                                    "type": "object",
                                    "description": "The analysis of the user's CV"
                                }
                            },
                            "required": ["job", "cv_analysis"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "generate_cover_letter",
                        "description": "Generates a tailored cover letter for a job",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "job": {
                                    "type": "object",
                                    "description": "The job posting"
                                },
                                "cv_analysis": {
                                    "type": "object",
                                    "description": "The analysis of the user's CV"
                                }
                            },
                            "required": ["job", "cv_analysis"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "apply_to_job",
                        "description": "Applies to a job with the CV and cover letter",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "job_id": {
                                    "type": "string",
                                    "description": "The ID of the job posting"
                                },
                                "cover_letter": {
                                    "type": "string",
                                    "description": "The cover letter to include with the application"
                                }
                            },
                            "required": ["job_id", "cover_letter"]
                        }
                    }
                }
            ]
        )
        
        return agent
    
    def run(self) -> Dict:
        """
        Run the job application process.
        
        Returns:
            A dictionary containing the results of the job application process
        """
        # Create a thread for the conversation
        thread = client.beta.threads.create()
        
        # Add the CV to the thread
        client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=f"""
            Please apply to {self.job_count} LinkedIn jobs that match my CV:
            
            {self.cv_text}
            """
        )
        
        # Run the agent
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            agent_id=self.agent.id,
        )
        
        # Poll for completion
        while run.status in ["queued", "in_progress"]:
            run = client.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            )
        
        # Get the results
        messages = client.beta.threads.messages.list(
            thread_id=thread.id
        )
        
        # Process results
        job_applications = []
        for message in messages.data:
            if message.role == "assistant":
                # Extract job applications from the message
                # This would need to be parsed from the message content
                # For now, we'll just use the message content as-is
                job_applications.append({
                    "message": message.content[0].text.value if message.content else "",
                    "timestamp": message.created_at
                })
        
        # Clean up
        client.beta.agents.delete(agent_id=self.agent.id)
        
        # Return results
        return {
            "status": "completed",
            "jobs_applied": self.job_count,
            "job_applications": job_applications,
            "timestamp": datetime.now().isoformat()
        }

# Mock implementation of the agent's functions
def analyze_cv(cv_text: str) -> Dict:
    """
    Extract key information from the user's CV using GPT-4o mini.
    
    Args:
        cv_text: The text content of the CV
        
    Returns:
        A dictionary containing the extracted information
    """
    # In a real implementation, this would use GPT-4o mini to extract
    # information from the CV. For now, we'll just mock it.
    return {
        "skills": ["Python", "JavaScript", "React", "Node.js"],
        "experience": [
            {"title": "Software Engineer", "company": "Acme Inc.", "duration": "2 years"},
            {"title": "Web Developer", "company": "XYZ Corp", "duration": "1 year"}
        ],
        "education": [
            {"degree": "BS Computer Science", "institution": "Example University"}
        ],
        "job_titles": ["Software Engineer", "Web Developer", "Full Stack Developer"]
    }

def search_jobs(keywords: str, location: Optional[str] = None, limit: int = 50) -> List[Dict]:
    """
    Search for job postings on LinkedIn.
    
    Args:
        keywords: Keywords to search for
        location: Location to search in
        limit: Maximum number of jobs to return
        
    Returns:
        A list of job postings
    """
    # In a real implementation, this would use LinkedIn's API or web scraping
    # to search for jobs. For now, we'll just mock it.
    return [
        {
            "id": f"job-{i}",
            "title": f"Software Engineer {i}",
            "company": f"Company {i}",
            "location": location or "Remote",
            "description": f"Job description for Software Engineer {i}...",
            "url": f"https://linkedin.com/jobs/view/job-{i}"
        }
        for i in range(1, limit + 1)
    ]

def evaluate_job(job: Dict, cv_analysis: Dict) -> Dict:
    """
    Evaluate a job posting for fit with the user's CV.
    
    Args:
        job: The job posting to evaluate
        cv_analysis: The analysis of the user's CV
        
    Returns:
        An evaluation of the job posting
    """
    # In a real implementation, this would use GPT-4o mini to evaluate
    # the job posting against the CV. For now, we'll just mock it.
    score = 50 + (hash(job["id"]) % 50)  # Random score between 50 and 99
    
    return {
        "job_id": job["id"],
        "match_score": score,
        "strengths": ["Relevant experience", "Matching skills"],
        "weaknesses": ["Missing some required skills"],
        "overall_recommendation": "Apply" if score > 70 else "Consider"
    }

def generate_cover_letter(job: Dict, cv_analysis: Dict) -> str:
    """
    Generate a tailored cover letter for a job.
    
    Args:
        job: The job posting
        cv_analysis: The analysis of the user's CV
        
    Returns:
        A cover letter
    """
    # In a real implementation, this would use GPT-4o mini to generate
    # a cover letter. For now, we'll just mock it.
    return f"""
    Dear Hiring Manager,
    
    I am writing to express my interest in the {job['title']} position at {job['company']}.
    With my background in {cv_analysis['skills'][0]} and {cv_analysis['skills'][1]},
    I believe I would be a great fit for this role.
    
    During my time at {cv_analysis['experience'][0]['company']}, I developed...
    
    I look forward to the opportunity to discuss how my skills and experience align with your needs.
    
    Sincerely,
    [Applicant Name]
    """

def apply_to_job(job_id: str, cover_letter: str) -> Dict:
    """
    Apply to a job with the CV and cover letter.
    
    Args:
        job_id: The ID of the job posting
        cover_letter: The cover letter to include with the application
        
    Returns:
        The result of the application
    """
    # In a real implementation, this would use LinkedIn's API or web automation
    # to apply to the job. For now, we'll just mock it.
    success = hash(job_id) % 10 != 0  # 90% success rate
    
    return {
        "job_id": job_id,
        "success": success,
        "error": None if success else "Application form error",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    # Example usage
    if len(sys.argv) < 2:
        print("Usage: python agent.py <cv_file_path> [job_count]")
        sys.exit(1)
    
    cv_file_path = sys.argv[1]
    job_count = int(sys.argv[2]) if len(sys.argv) > 2 else 25
    
    # Read CV text from file
    with open(cv_file_path, "r") as f:
        cv_text = f.read()
    
    # Initialize agent
    agent = JobApplicationAgent(cv_text, job_count)
    
    # Run agent
    results = agent.run()
    
    # Output results
    print(json.dumps(results, indent=2)) 