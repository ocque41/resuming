# OpenAI Agent Python Backend

This is the Python backend for the OpenAI Agents integration. It provides a FastAPI server that handles document processing and AI agent interactions using the OpenAI Agents SDK.

## Features

- 📄 Document processing (PDF, DOCX, TXT, JSON)
- 🤖 Multiple specialized AI agents (analyzer, editor, creator)
- 🔄 Streaming responses for real-time interactions
- 🧰 Function calling with OpenAI tools
- 🔍 Document analysis and summarization
- ✏️ Document editing and improvement
- 📝 Document creation from scratch

## Setup

### Prerequisites

- Python 3.9+ installed
- OpenAI API key
- AWS credentials (for S3 document access)

### Installation

1. Clone the repository

2. Navigate to the Python backend directory:
   ```
   cd python_backend
   ```

3. Create a virtual environment:
   ```
   python -m venv venv
   ```

4. Activate the virtual environment:
   - On Windows:
     ```
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```
     source venv/bin/activate
     ```

5. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

6. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```

7. Edit the `.env` file and add your API keys and configuration.

## Running the Server

Start the FastAPI server:

```
python run_server.py
```

The server will be available at http://localhost:8000 by default.

## API Endpoints

- `GET /` - Root endpoint to verify the API is running
- `GET /health` - Health check endpoint
- `POST /api/agent/message` - Process a message using an AI agent
- `POST /api/agent/message/stream` - Stream a response from an AI agent

## Agent Modes

The API supports three agent modes:

1. **analyze** - For document analysis, summarization, and information extraction
2. **edit** - For document editing, improvement, and revision
3. **create** - For document creation from scratch based on user specifications

## Usage Example

```python
import requests

# Regular request
response = requests.post(
    "http://localhost:8000/api/agent/message",
    json={
        "messages": [{"role": "user", "content": "Summarize this document"}],
        "document_id": "doc123",
        "mode": "analyze",
        "stream": False
    }
)
print(response.json())

# For streaming requests, use a different endpoint and process the SSE stream
```

## Development

For development, you can enable auto-reload:

```
uvicorn python_backend.main:app --reload
```

## Testing

Run tests with pytest:

```
pytest
```

## License

This project is licensed under the MIT License - see the LICENSE file for details. 