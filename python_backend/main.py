import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Check OpenAI API key
if not os.getenv("OPENAI_API_KEY"):
    logger.error("OPENAI_API_KEY environment variable not set")
    raise ValueError("OPENAI_API_KEY must be set as an environment variable")

# Import routers after environment variables are loaded
from python_backend.routers.agent_router import router as agent_router

# Create FastAPI app
app = FastAPI(
    title="Document AI API",
    description="API for document analysis, editing, and creation using OpenAI Agents",
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agent_router)

@app.get("/")
async def root():
    """Root endpoint to verify the API is running."""
    return {
        "status": "ok",
        "message": "Document AI API is running",
        "version": "0.1.0",
    }

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}

# Run the application if executed directly
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting Document AI API on {host}:{port}")
    
    uvicorn.run(
        "python_backend.main:app",
        host=host,
        port=port,
        reload=True,  # Enable auto-reload during development
    ) 