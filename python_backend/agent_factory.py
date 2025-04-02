import os
import logging
from typing import Dict, Any, Optional, List, AsyncGenerator
from openai_agents import Agent, AgentStream, Message, AgentState, OpenAITool
import openai
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

# Configure OpenAI client
openai_client = openai.AsyncClient(api_key=OPENAI_API_KEY)

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

# Define OpenAI tools
summarize_tool = OpenAITool(
    name="summarize_document",
    description="Summarize the document or a specified section",
    parameters={
        "type": "object",
        "properties": {
            "section": {
                "type": "string",
                "description": "Optional section to summarize. If not provided, summarize the entire document."
            },
            "length": {
                "type": "string",
                "enum": ["brief", "detailed"],
                "description": "Length of summary: brief (1-2 paragraphs) or detailed (3-5 paragraphs)"
            }
        },
        "required": ["length"]
    }
)

extract_key_points_tool = OpenAITool(
    name="extract_key_points",
    description="Extract key points from the document",
    parameters={
        "type": "object",
        "properties": {
            "section": {
                "type": "string",
                "description": "Optional section to extract from. If not provided, extract from the entire document."
            },
            "max_points": {
                "type": "integer",
                "description": "Maximum number of key points to extract"
            }
        },
        "required": ["max_points"]
    }
)

edit_section_tool = OpenAITool(
    name="edit_section",
    description="Edit a section of the document",
    parameters={
        "type": "object",
        "properties": {
            "section": {
                "type": "string",
                "description": "Section to edit"
            },
            "new_content": {
                "type": "string",
                "description": "New content for the section"
            },
            "edit_reason": {
                "type": "string",
                "description": "Reason for the edit"
            }
        },
        "required": ["section", "new_content", "edit_reason"]
    }
)

create_section_tool = OpenAITool(
    name="create_section",
    description="Create a new section for the document",
    parameters={
        "type": "object",
        "properties": {
            "section_title": {
                "type": "string",
                "description": "Title for the new section"
            },
            "content": {
                "type": "string",
                "description": "Content for the new section"
            },
            "position": {
                "type": "string",
                "description": "Position in the document (start, end, or after a specific section)"
            }
        },
        "required": ["section_title", "content", "position"]
    }
)

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
            openai_client=openai_client,
            model="gpt-4o",
            instructions=DOCUMENT_ANALYZER_INSTRUCTIONS,
            tools=[summarize_tool, extract_key_points_tool],
            name="document_analyzer"
        )
    
    @staticmethod
    def _create_editor_agent() -> Agent:
        """Create an agent for document editing."""
        logger.info("Creating document editor agent")
        return Agent(
            openai_client=openai_client,
            model="gpt-4o",
            instructions=DOCUMENT_EDITOR_INSTRUCTIONS,
            tools=[edit_section_tool],
            name="document_editor"
        )
    
    @staticmethod
    def _create_creator_agent() -> Agent:
        """Create an agent for document creation."""
        logger.info("Creating document creator agent")
        return Agent(
            openai_client=openai_client,
            model="gpt-4o",
            instructions=DOCUMENT_CREATOR_INSTRUCTIONS,
            tools=[create_section_tool],
            name="document_creator"
        )
        
    @classmethod
    def reset_agents(cls):
        """Reset all cached agents."""
        cls._agents = {} 