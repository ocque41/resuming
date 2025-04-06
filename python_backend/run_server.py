#!/usr/bin/env python3
"""
Script to start the FastAPI server for the Document AI API.
"""
import os
import sys
import logging
import uvicorn
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def main():
    """Main function to start the FastAPI server."""
    # Check for required environment variables
    required_env_vars = ["OPENAI_API_KEY"]
    missing_env_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_env_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_env_vars)}")
        logger.error("Please create a .env file or set these environment variables.")
        sys.exit(1)
    
    # Get port and host from environment variables or use defaults
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting Document AI API on {host}:{port}")
    
    # Check Python version
    python_version = sys.version.split()[0]
    logger.info(f"Using Python {python_version}")
    
    # Run the server
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,  # Enable auto-reload during development
        log_level="info",
    )

if __name__ == "__main__":
    main() 