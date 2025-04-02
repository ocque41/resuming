from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request, Response
from fastapi.responses import StreamingResponse
import logging
import json
import os
from typing import List, Dict, Any, Optional
import asyncio
from pydantic import BaseModel, Field
import openai
import time
from threading import Thread

# Import our Agent setup and Document handler
from python_backend.agent_factory import AgentFactory
from python_backend.document_handler import DocumentHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["agent"])

# ---- Pydantic Models ----
class Message(BaseModel):
    role: str
    content: str
    id: Optional[str] = None
    
class DocumentRequest(BaseModel):
    document_id: str
    
class AgentMessageRequest(BaseModel):
    messages: List[Message]
    document_id: Optional[str] = None
    instruction: Optional[str] = None
    mode: str = "analyze"  # analyze, edit, or create
    stream: bool = False
    
class AgentResponse(BaseModel):
    message: Message
    document: Optional[Dict[str, Any]] = None
    
# ---- Helper Functions ----
async def get_document_context(document_id: str) -> Dict[str, Any]:
    """Retrieve document content and metadata for context."""
    if not document_id:
        return {"content": "", "metadata": {}}
    
    # First try to get from S3
    content, metadata = await DocumentHandler.get_document_from_s3(document_id)
    
    # If not in S3, try database
    if content is None:
        content, metadata = await DocumentHandler.get_document_from_database(document_id)
    
    # If still not found, raise exception
    if content is None:
        raise HTTPException(status_code=404, detail=f"Document not found: {document_id}")
    
    return {
        "content": content,
        "metadata": metadata or {}
    }

# ---- API Endpoints ----
@router.post("/message", response_model=AgentResponse)
async def process_agent_message(
    request: AgentMessageRequest,
    background_tasks: BackgroundTasks
):
    """
    Process a message for the AI agent and return the response.
    
    Args:
        request: Contains messages, document ID, and mode
        
    Returns:
        Agent response with message and optional document
    """
    try:
        # Validate the mode
        valid_modes = ["analyze", "edit", "create"]
        if request.mode not in valid_modes:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid mode: {request.mode}. Must be one of {valid_modes}"
            )
        
        # Get document context if document_id is provided
        document_context = {}
        if request.document_id:
            document_context = await get_document_context(request.document_id)
        
        # Get the appropriate agent based on mode
        agent = AgentFactory.get_agent(request.mode)
        if not agent:
            raise HTTPException(status_code=500, detail=f"Failed to initialize agent for mode: {request.mode}")
        
        # Prepare the messages for the agent
        system_instruction = agent.instructions
        if request.instruction:
            system_instruction += f"\n\n{request.instruction}"
        
        # Add document context to the system message if available
        if document_context and "content" in document_context:
            system_instruction += f"\n\nDocument content:\n{document_context.get('content')}"
        
        # Format messages for OpenAI API
        formatted_messages = [
            {"role": "system", "content": system_instruction}
        ]
        
        # Add user messages from the request
        for msg in request.messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})
        
        # Call the OpenAI API
        response = await agent.run(formatted_messages)
        
        # Process the response
        response_message = Message(
            role="assistant",
            content=response.content,
            id=str(int(time.time() * 1000))  # Generate a timestamp-based ID
        )
        
        # For now, just return the message
        return AgentResponse(
            message=response_message,
            document=document_context.get("metadata") if document_context else None
        )
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error processing agent message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

@router.post("/message/stream")
async def stream_agent_message(request: AgentMessageRequest):
    """
    Stream a response from the AI agent.
    
    Args:
        request: Contains messages, document ID, and mode
        
    Returns:
        Streaming response with agent message chunks
    """
    async def generate():
        try:
            # Always set stream to True for this endpoint
            request.stream = True
            
            # Validate the mode
            valid_modes = ["analyze", "edit", "create"]
            if request.mode not in valid_modes:
                error_json = json.dumps({"error": f"Invalid mode: {request.mode}. Must be one of {valid_modes}"})
                yield f"data: {error_json}\n\n"
                return
            
            # Get document context if document_id is provided
            document_context = {}
            if request.document_id:
                document_context = await get_document_context(request.document_id)
            
            # Get the appropriate agent based on mode
            agent = AgentFactory.get_agent(request.mode)
            if not agent:
                error_json = json.dumps({"error": f"Failed to initialize agent for mode: {request.mode}"})
                yield f"data: {error_json}\n\n"
                return
            
            # Prepare the messages for the agent
            system_instruction = agent.instructions
            if request.instruction:
                system_instruction += f"\n\n{request.instruction}"
            
            # Add document context to the system message if available
            if document_context and "content" in document_context:
                system_instruction += f"\n\nDocument content:\n{document_context.get('content')}"
            
            # Format messages for OpenAI API
            formatted_messages = [
                {"role": "system", "content": system_instruction}
            ]
            
            # Add user messages from the request
            for msg in request.messages:
                formatted_messages.append({"role": msg.role, "content": msg.content})
            
            # Get streaming response from the agent
            message_id = str(int(time.time() * 1000))
            
            async for chunk in agent.run_stream(formatted_messages):
                chunk_data = {
                    "id": message_id,
                    "role": "assistant",
                    "content": chunk.content,
                    "is_complete": False
                }
                yield f"data: {json.dumps(chunk_data)}\n\n"
            
            # Send a final message indicating completion
            final_data = {
                "id": message_id,
                "role": "assistant",
                "content": "",
                "is_complete": True,
                "document": document_context.get("metadata") if document_context else None
            }
            yield f"data: {json.dumps(final_data)}\n\n"
            
        except Exception as e:
            logger.error(f"Error in streaming response: {str(e)}")
            error_json = json.dumps({"error": str(e)})
            yield f"data: {error_json}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

@router.get("/health")
async def health_check():
    """Health check endpoint to verify the agent service is running."""
    return {"status": "ok", "timestamp": time.time()} 