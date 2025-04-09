# File Manager Agent

This API provides a file management agent for the enhance page. The agent uses LLM capabilities to understand user queries and perform file operations.

## Features

- **Create Files**: Create new files with specified content and file extensions
- **Edit Files**: Update existing files with new content
- **Read Files**: View the content of existing files
- **Delete Files**: Remove files from the system
- **List Files**: View all files in a directory

## API Endpoints

### `GET /api/agent/enhance/file-manager`

Health check and API information.

**Response:**
```json
{
  "status": "ok",
  "service": "File Manager Agent",
  "timestamp": "2023-06-15T12:34:56.789Z",
  "endpoints": {
    "post": "Process file operations via query or direct operation object"
  }
}
```

### `POST /api/agent/enhance/file-manager`

Process file operations either through natural language queries or direct operation objects.

**Request Body Options:**

1. Natural language query:
```json
{
  "query": "Create a new file called config.json with content {\"name\": \"test\"}"
}
```

2. Direct operation (more predictable):
```json
{
  "operation": {
    "operation": "create",
    "fileName": "config",
    "fileContent": "{\"name\": \"test\"}",
    "fileExtension": "json"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "File created successfully",
  "fileName": "config.json",
  "filePath": "/user-files/user-id/config.json"
}
```

## Supported Operations

### Create File

Create a new file with content and specified extension.

**Natural Language Examples:**
- "Create a new file called notes.txt with content Hello World"
- "Make a JSON file named config with content {\"name\": \"test\"}"

**Direct Operation:**
```json
{
  "operation": "create",
  "fileName": "example",
  "fileContent": "This is an example file",
  "fileExtension": "txt",
  "directory": "optional/subdirectory"
}
```

### Edit File

Update the content of an existing file.

**Natural Language Examples:**
- "Edit notes.txt with content Updated content here"
- "Update config.json to {\"name\": \"updated\", \"version\": 2}"

**Direct Operation:**
```json
{
  "operation": "edit",
  "fileName": "example.txt",
  "fileContent": "This is updated content",
  "directory": "optional/subdirectory"
}
```

### Read File

View the content of an existing file.

**Natural Language Examples:**
- "Read notes.txt"
- "Show me the content of config.json"

**Direct Operation:**
```json
{
  "operation": "read",
  "fileName": "example.txt",
  "directory": "optional/subdirectory"
}
```

### Delete File

Remove a file from the system.

**Natural Language Examples:**
- "Delete notes.txt"
- "Remove the file config.json"

**Direct Operation:**
```json
{
  "operation": "delete",
  "fileName": "example.txt",
  "directory": "optional/subdirectory"
}
```

## Supported File Extensions

- Text: txt
- Code: js, ts, jsx, tsx, html, css
- Data: json, yaml, yml, csv, xml
- Documentation: md
- Graphics: svg

## Security Considerations

- All file operations are validated for security
- Files are stored in user-specific directories
- File names are checked for invalid characters and reserved names
- Only approved file extensions are supported

## Future Enhancements

- Integration with OpenAI Agents SDK for improved natural language understanding
- Support for more file types (PDF, images, etc.)
- File comparison and merging capabilities
- Version control for files
- Advanced search across files

## Implementation Notes

This agent is implemented using a combination of:
1. File operation tools for basic functionality
2. Natural language processing for understanding user intent
3. Secure file handling to prevent security issues
