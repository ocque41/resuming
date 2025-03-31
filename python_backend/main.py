import os
import json
import asyncio
from typing import Dict, List, Optional, Union, Any
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn

# Import our document agent
from document_agent import process_agent_request, document_agent_handler

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Document Agent API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define request/response models
class AgentRequest(BaseModel):
    message: str
    document_id: Optional[str] = None
    mode: str = "create"  # "create" or "edit"
    user_id: Optional[str] = None

class AgentResponse(BaseModel):
    response: str
    document_id: Optional[str] = None
    mode: str

# Routes
@app.post("/agent/enhance", response_model=AgentResponse)
async def handle_agent_request(request: AgentRequest):
    """Process a request using OpenAI Agents SDK."""
    try:
        # Call our document agent handler
        result = await process_agent_request(
            message=request.message,
            document_id=request.document_id,
            mode=request.mode,
            user_id=request.user_id
        )
        
        return AgentResponse(
            response=result["response"],
            document_id=result["document_id"] or request.document_id or "new-document-id",
            mode=result["mode"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent processing error: {str(e)}")

@app.post("/agent/enhance/stream")
async def handle_agent_stream_request(request: AgentRequest):
    """Process a request using OpenAI Agents SDK with streaming response."""
    async def stream_generator():
        try:
            # Get the appropriate agent based on mode
            if request.mode == "create":
                agent = document_agent_handler.creator_agent
                # Format the input to help the agent understand the context
                input_message = f"USER REQUEST: {request.message}\nCreate a document based on this request."
            elif request.mode == "edit":
                agent = document_agent_handler.editor_agent
                # Format the input to help the agent understand the context
                input_message = f"USER REQUEST: {request.message}\nDocument ID: {request.document_id}\nEdit the document based on this request."
            else:
                raise ValueError(f"Invalid mode: {request.mode}")
            
            # Use streaming runner from OpenAI Agents SDK
            from agents import StreamingRunner
            
            # Create a streaming runner
            streaming_runner = StreamingRunner()
            
            # Get the stream of events
            events_stream = streaming_runner.stream(agent, input_message)
            
            # Process events from the stream
            buffer = ""  # Buffer to accumulate text
            
            async for event in events_stream:
                if hasattr(event, 'delta') and event.delta:
                    # New content from the agent
                    buffer += event.delta
                    
                    # Yield the buffer as a streaming response
                    yield buffer.encode('utf-8')
                    await asyncio.sleep(0.01)  # Small delay to avoid overwhelming the client
                
                if hasattr(event, 'final_output') and event.final_output:
                    # Final output from the agent (end of stream)
                    yield event.final_output.encode('utf-8')
                    break
        
        except Exception as e:
            error_message = f"Error in streaming: {str(e)}"
            print(error_message)
            yield error_message.encode('utf-8')
    
    # Return a streaming response
    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream"
    )

@app.get("/")
async def root():
    return {"message": "Document Agent API is running"}

if __name__ == "__main__":
    # Run the FastAPI app using Uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 