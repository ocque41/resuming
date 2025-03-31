import os
import json
from typing import Dict, Optional, List, Any, Union
from pydantic import BaseModel, Field
from agents import Agent, Runner, WebSearchTool, StreamingRunner
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Document model
class Document(BaseModel):
    id: str
    name: str
    content: str
    type: str = "document"  # document or cv
    created_at: str
    updated_at: Optional[str] = None
    user_id: Optional[str] = None
    
# Function tools
class DocumentTool:
    def __init__(self, documents_data: Dict[str, Document] = None):
        self.documents_data = documents_data or {}
        
    def get_document(self, document_id: str) -> Optional[Document]:
        """Retrieve a document by its ID."""
        return self.documents_data.get(document_id)
    
    def list_documents(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all documents, optionally filtered by user_id."""
        docs = list(self.documents_data.values())
        if user_id:
            docs = [doc for doc in docs if doc.user_id == user_id]
        return [{"id": doc.id, "name": doc.name, "type": doc.type, "created_at": doc.created_at} for doc in docs]
    
    def create_document(self, name: str, content: str, type_: str = "document", user_id: Optional[str] = None) -> Document:
        """Create a new document."""
        import uuid
        from datetime import datetime
        
        doc_id = f"doc_{uuid.uuid4().hex}"
        now = datetime.now().isoformat()
        
        doc = Document(
            id=doc_id,
            name=name,
            content=content,
            type=type_,
            created_at=now,
            updated_at=now,
            user_id=user_id
        )
        
        self.documents_data[doc_id] = doc
        return doc
    
    def update_document(self, document_id: str, content: Optional[str] = None, name: Optional[str] = None) -> Optional[Document]:
        """Update an existing document."""
        from datetime import datetime
        
        doc = self.documents_data.get(document_id)
        if not doc:
            return None
        
        if content is not None:
            doc.content = content
        if name is not None:
            doc.name = name
            
        doc.updated_at = datetime.now().isoformat()
        self.documents_data[document_id] = doc
        return doc

# Create OpenAI Agents
def create_document_creator_agent(document_tool: DocumentTool) -> Agent:
    """Create an agent for creating documents."""
    
    # Define function tools
    def create_document_from_text(name: str, content: str, document_type: str = "document", user_id: Optional[str] = None) -> Dict[str, Any]:
        """Create a new document from text content."""
        doc = document_tool.create_document(name, content, document_type, user_id)
        return {
            "id": doc.id,
            "name": doc.name,
            "type": doc.type,
            "created_at": doc.created_at
        }
    
    def list_user_documents(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all documents for a user."""
        return document_tool.list_documents(user_id)
    
    # Create document creator agent
    agent = Agent(
        name="Document Creator",
        instructions="""You are a document creator assistant. You help users create professional documents like resumes, cover letters, reports, etc.
        
When a user requests a document to be created:
1. Understand the type of document they want to create
2. Ask clarifying questions if needed
3. Create a professional document based on their requirements
4. Format the document professionally
5. Provide explanations for your choices

Be professional, courteous, and aim to create high-quality documents tailored to the user's needs.
        """,
        tools=[
            create_document_from_text,
            list_user_documents,
            WebSearchTool(),
        ],
        model="gpt-4o"
    )
    
    return agent

def create_document_editor_agent(document_tool: DocumentTool) -> Agent:
    """Create an agent for editing documents."""
    
    # Define function tools
    def get_document_content(document_id: str) -> Optional[Dict[str, Any]]:
        """Get the content of a document by ID."""
        doc = document_tool.get_document(document_id)
        if not doc:
            return None
        return {
            "id": doc.id,
            "name": doc.name,
            "content": doc.content,
            "type": doc.type,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at
        }
    
    def update_document_content(document_id: str, new_content: str, new_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Update the content of a document by ID."""
        doc = document_tool.update_document(document_id, new_content, new_name)
        if not doc:
            return None
        return {
            "id": doc.id,
            "name": doc.name,
            "type": doc.type,
            "updated_at": doc.updated_at
        }
    
    # Create document editor agent
    agent = Agent(
        name="Document Editor",
        instructions="""You are a document editor assistant. You help users edit and improve their documents.
        
When a user requests changes to their document:
1. Retrieve the document content
2. Understand the changes they want to make
3. Make the requested changes while maintaining document quality
4. Ensure the document remains professional and properly formatted
5. Provide explanations for your edits

Be professional, courteous, and aim to improve documents based on the user's requirements.
        """,
        tools=[
            get_document_content,
            update_document_content,
            WebSearchTool(),
        ],
        model="gpt-4o"
    )
    
    return agent

# Main document agent handler
class DocumentAgentHandler:
    def __init__(self):
        # Initialize document storage
        self.document_tool = DocumentTool()
        
        # Create agents
        self.creator_agent = create_document_creator_agent(self.document_tool)
        self.editor_agent = create_document_editor_agent(self.document_tool)
    
    async def process_request(self, message: str, document_id: Optional[str] = None, mode: str = "create", user_id: Optional[str] = None) -> Dict[str, Any]:
        """Process a request using the appropriate agent."""
        if mode == "create":
            agent = self.creator_agent
            # Format the input to help the agent understand the context
            input_message = f"USER REQUEST: {message}\nCreate a document based on this request."
        elif mode == "edit":
            agent = self.editor_agent
            # Format the input to help the agent understand the context
            input_message = f"USER REQUEST: {message}\nDocument ID: {document_id}\nEdit the document based on this request."
        else:
            raise ValueError(f"Invalid mode: {mode}")
        
        # Run the agent
        try:
            result = await Runner.run(agent, input_message)
            return {
                "response": result.final_output,
                "document_id": document_id,
                "mode": mode
            }
        except Exception as e:
            raise Exception(f"Error running agent: {str(e)}")
    
    async def process_request_streaming(self, message: str, document_id: Optional[str] = None, mode: str = "create", user_id: Optional[str] = None) -> str:
        """Process a request using the appropriate agent with streaming output."""
        if mode == "create":
            agent = self.creator_agent
            # Format the input to help the agent understand the context
            input_message = f"USER REQUEST: {message}\nCreate a document based on this request."
        elif mode == "edit":
            agent = self.editor_agent
            # Format the input to help the agent understand the context
            input_message = f"USER REQUEST: {message}\nDocument ID: {document_id}\nEdit the document based on this request."
        else:
            raise ValueError(f"Invalid mode: {mode}")
        
        # Run the agent with streaming
        try:
            streaming_runner = StreamingRunner()
            return streaming_runner.stream(agent, input_message)
        except Exception as e:
            raise Exception(f"Error running streaming agent: {str(e)}")

# Initialize a global instance (for demonstration purposes)
document_agent_handler = DocumentAgentHandler()

# Function to process a request
async def process_agent_request(message: str, document_id: Optional[str] = None, mode: str = "create", user_id: Optional[str] = None) -> Dict[str, Any]:
    """Process a document agent request."""
    return await document_agent_handler.process_request(message, document_id, mode, user_id) 