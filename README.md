# AI Document Assistant

An AI-powered document management system built with Next.js and OpenAI Agents SDK.

## Document Processing Features

### Document Upload
- Support for PDF, DOCX, and TXT files
- Drag-and-drop file uploads
- Direct S3 uploads using pre-signed URLs
- Progress tracking for uploads
- Validation for file types and sizes

### AI Document Processing
- Analyze documents with AI
- Edit and improve documents with AI assistance
- Create new documents with AI guidance
- Real-time chat interface with AI agent
- Context-aware document processing

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables in .env.local:
   ```
   OPENAI_API_KEY=your_openai_api_key
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=your_aws_region
   S3_BUCKET_NAME=your_s3_bucket_name
   PYTHON_API_URL=http://localhost:8000
   ```
4. Start the development server:
   ```
   npm run dev
   ```
5. Navigate to the Document Processor page:
   ```
   http://localhost:3000/dashboard/document-processor
   ```

## Usage

### Document Upload
1. Select the operation mode (Analyze, Edit, or Create)
2. Drag and drop your document or click to select a file
3. Wait for the upload to complete
4. Click "Chat with AI about this document"

### Interacting with AI
1. Type your questions or instructions in the chat
2. The AI will respond based on the document content
3. For document analysis, ask questions about the content
4. For document editing, request specific changes
5. For document creation, provide the topic and requirements

## API Routes

### Document Upload API
- `POST /api/upload`: Get a pre-signed URL for direct S3 upload
- Request body:
  ```json
  {
    "fileName": "example.pdf",
    "fileType": "application/pdf",
    "fileSize": 1024000
  }
  ```
- Response:
  ```json
  {
    "uploadUrl": "https://s3.amazonaws.com/...",
    "fileId": "123e4567-e89b-12d3-a456-426614174000",
    "fileKey": "uploads/123e4567-e89b-12d3-a456-426614174000/example.pdf",
    "expiresIn": 3600
  }
  ```

### OpenAI Agent API
- `POST /api/openai-agent`: Send a message to the AI agent
- Request body:
  ```json
  {
    "message": "Summarize this document for me",
    "documentId": "123e4567-e89b-12d3-a456-426614174000",
    "documentKey": "uploads/123e4567-e89b-12d3-a456-426614174000/example.pdf",
    "mode": "analyze"
  }
  ```
- `GET /api/openai-agent?documentId=123&mode=analyze`: Stream responses from the AI agent

## 🌟 Features

- **Document Analysis**: Extract insights, summarize content, and answer questions about documents
- **Document Editing**: Improve writing, fix grammar, and enhance document structure
- **Document Creation**: Generate new documents based on user requirements
- **Multiple File Types**: Support for PDF, DOCX, TXT, and more
- **Real-time Streaming**: Get streaming responses for immediate feedback
- **Agent Tools**: Specialized tools for each document operation type
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS

## 🏗️ Architecture

This project uses a hybrid architecture:

- **Frontend**: Next.js application with React components and API routes
- **Backend**: Python FastAPI service integrating OpenAI Agents SDK
- **Bridge**: Next.js API routes that forward requests to the Python backend

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- OpenAI API key
- (Optional) AWS S3 for document storage

### Installation

#### 1. Clone the repository

```bash
git clone <repository-url>
cd <repository-directory>
```

#### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local

# Edit .env.local and add your environment variables
```

#### 3. Backend Setup

```bash
# Navigate to the Python backend directory
cd python_backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your OpenAI API key and other settings
```

### Running the Application

#### 1. Start the Python Backend

```bash
cd python_backend
python run_server.py
```

The Python backend will start at http://localhost:8000.

#### 2. Start the Next.js Frontend

```bash
# In the root directory
npm run dev
```

The frontend will start at http://localhost:3000.

## 📖 Usage

1. Navigate to the Agent Demo page at http://localhost:3000/dashboard/agent-demo
2. Select a document or create a new one from scratch
3. Choose the mode (analyze, edit, or create)
4. Enter your message and send
5. View the AI agent's response in real-time

## 🔌 API Endpoints

### Frontend API (Next.js)

- `POST /api/python/agent/message` - Forward requests to the Python backend
- `POST /api/python/agent/message/stream` - Stream responses from the Python backend

### Backend API (Python)

- `POST /api/agent/message` - Process agent messages
- `POST /api/agent/message/stream` - Stream agent responses
- `GET /health` - Check if the backend is running

## 🧩 Components

### Frontend Components

- `OpenAIAgentClient`: The main client component for interacting with AI agents
- `DocumentSelector`: Component for selecting documents from the list
- API routes for communicating with the Python backend

### Backend Components

- `agent_factory.py`: Factory for creating different types of AI agents
- `document_handler.py`: Handlers for retrieving and processing documents
- `routers/agent_router.py`: FastAPI router for agent endpoints

## 📚 Technologies

- **Frontend**:
  - Next.js
  - React
  - TypeScript
  - Tailwind CSS
  - shadcn/ui components

- **Backend**:
  - Python
  - FastAPI
  - OpenAI Agents SDK
  - PyMuPDF (for PDF processing)
  - python-docx (for DOCX processing)

## 🔍 Future Improvements

- Add authentication
- Implement document storage in database
- Add document upload functionality
- Create a document version history system
- Implement collaborative editing
- Add more specialized agent tools

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
