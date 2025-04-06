import os
import logging
from typing import Dict, Any, Optional, List, AsyncGenerator
from agents import Agent, set_default_openai_key, Runner
from pydantic import BaseModel, Field
from functools import lru_cache

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get OpenAI API key from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.error("OPENAI_API_KEY environment variable is not set")
    raise ValueError("OPENAI_API_KEY environment variable must be set")

# Configure the agents SDK
set_default_openai_key(OPENAI_API_KEY)

# Define agent instructions
DOCUMENT_ANALYZER_INSTRUCTIONS = """
You are a document analysis assistant that helps users understand, summarize, and extract insights from documents.

Your capabilities:
1. Summarize documents concisely
2. Extract key information and insights
3. Answer questions about the document content
4. Identify main themes, topics, and arguments
5. Analyze document structure and organization
6. Detect tone, sentiment, and writing style

Guidelines:
- Always base your responses on the document content provided
- When answering questions, cite specific parts of the document
- If information isn't in the document, clearly state that
- Be objective in your analysis unless asked for opinions
- Format your responses clearly with headings and bullet points when appropriate
"""

DOCUMENT_EDITOR_INSTRUCTIONS = """
You are a document editing assistant that helps users improve their documents.

Your capabilities:
1. Fix grammar, spelling, and punctuation errors
2. Improve clarity, conciseness, and coherence
3. Suggest better phrasing and word choices
4. Restructure sentences and paragraphs for better flow
5. Format documents according to style guidelines
6. Adapt tone and style based on the document purpose

Guidelines:
- Preserve the original meaning and intent of the text
- Explain significant changes you suggest
- When possible, provide both the original and your suggested revision
- Consider the document's purpose and audience
- Be specific in your recommendations
- Focus on substantive improvements, not just surface-level edits
"""

DOCUMENT_CREATOR_INSTRUCTIONS = """
You are a document creation assistant that helps users generate new documents.

Your capabilities:
1. Draft documents based on user specifications
2. Create outlines and structure for new documents
3. Generate content for specific sections
4. Write in different styles, tones, and formats
5. Adapt content for different audiences and purposes
6. Create templates for future use

Guidelines:
- Ask for clarification on document requirements if needed
- Organize content logically with appropriate headings and structure
- Tailor your writing to the specified audience and purpose
- Provide explanations for your organizational choices when helpful
- Be creative while staying within the user's guidelines
- Suggest improvements or alternatives when appropriate
"""

# Define models for document processing tools
class DocumentPart(BaseModel):
    content: str = Field(..., description="Content of the document part")
    section: str = Field(..., description="Section or heading for this part")

# Define tool functions
def summarize_document(section: Optional[str] = None, length: str = "brief") -> str:
    """
    Summarize the document or a specified section.
    
    Args:
        section: Optional section to summarize. If not provided, summarize the entire document.
        length: Length of summary: brief (1-2 paragraphs) or detailed (3-5 paragraphs)
        
    Returns:
        A summary of the document or section
    """
    return ""  # This will be implemented by the Agent

def extract_key_points(max_points: int, section: Optional[str] = None) -> List[str]:
    """
    Extract key points from the document.
    
    Args:
        max_points: Maximum number of key points to extract
        section: Optional section to extract from. If not provided, extract from the entire document.
        
    Returns:
        A list of key points
    """
    return []  # This will be implemented by the Agent

def edit_section(section: str, new_content: str, edit_reason: str) -> str:
    """
    Edit a section of the document.
    
    Args:
        section: Section to edit
        new_content: New content for the section
        edit_reason: Reason for the edit
        
    Returns:
        A confirmation message
    """
    return ""  # This will be implemented by the Agent

def create_section(section_title: str, content: str, position: str) -> str:
    """
    Create a new section for the document.
    
    Args:
        section_title: Title for the new section
        content: Content for the new section
        position: Position in the document (start, end, or after a specific section)
        
    Returns:
        A confirmation message
    """
    return ""  # This will be implemented by the Agent

class AgentFactory:
    """Factory class for creating and managing different types of OpenAI Agents."""
    
    _agents = {}
    
    @classmethod
    @lru_cache(maxsize=3)  # Cache the agents for better performance
    def get_agent(cls, mode: str) -> Optional[Agent]:
        """
        Get or create an agent for the specified mode.
        
        Args:
            mode: The mode of operation (analyze, edit, create)
            
        Returns:
            Agent for the specified mode or None if mode is invalid
        """
        if mode in cls._agents:
            return cls._agents[mode]
        
        try:
            if mode == "analyze":
                agent = cls._create_analyzer_agent()
            elif mode == "edit":
                agent = cls._create_editor_agent()
            elif mode == "create":
                agent = cls._create_creator_agent()
            else:
                logger.warning(f"Invalid agent mode: {mode}")
                return None
                
            cls._agents[mode] = agent
            return agent
            
        except Exception as e:
            logger.error(f"Error creating agent for mode {mode}: {str(e)}")
            return None
    
    @staticmethod
    def _create_analyzer_agent() -> Agent:
        """Create an agent for document analysis."""
        logger.info("Creating document analyzer agent")
        return Agent(
            name="document_analyzer",
            instructions=DOCUMENT_ANALYZER_INSTRUCTIONS,
            tools=[summarize_document, extract_key_points]
        )
    
    @staticmethod
    def _create_editor_agent() -> Agent:
        """Create an agent for document editing."""
        logger.info("Creating document editor agent")
        return Agent(
            name="document_editor",
            instructions=DOCUMENT_EDITOR_INSTRUCTIONS,
            tools=[edit_section]
        )
    
    @staticmethod
    def _create_creator_agent() -> Agent:
        """Create an agent for document creation."""
        logger.info("Creating document creator agent")
        return Agent(
            name="document_creator",
            instructions=DOCUMENT_CREATOR_INSTRUCTIONS,
            tools=[create_section]
        )
        
    @classmethod
    def reset_agents(cls):
        """Reset all cached agents."""
        cls._agents = {} 