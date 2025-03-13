import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Document tool interfaces
interface DocumentTool {
  name: string;
  description: string;
  execute: (args: any) => Promise<any>;
}

// Document creation tool
const createDocumentTool: DocumentTool = {
  name: 'create_document',
  description: 'Creates a new document with the specified content and format',
  execute: async ({ content, format = 'docx', title = 'New Document' }) => {
    try {
      // This is a placeholder for actual document creation logic
      console.log(`Creating ${format} document: ${title}`);
      
      // Return success response with mock document ID
      return {
        success: true,
        documentId: `doc_${Date.now()}`,
        title,
        format
      };
    } catch (error) {
      console.error('Error creating document:', error);
      return {
        success: false,
        error: 'Failed to create document'
      };
    }
  }
};

// Document editing tool
const editDocumentTool: DocumentTool = {
  name: 'edit_document',
  description: 'Edits an existing document with the specified content',
  execute: async ({ documentId, content, changes }) => {
    try {
      // This is a placeholder for actual document editing logic
      console.log(`Editing document: ${documentId}`);
      
      // Return success response
      return {
        success: true,
        documentId,
        changes
      };
    } catch (error) {
      console.error('Error editing document:', error);
      return {
        success: false,
        error: 'Failed to edit document'
      };
    }
  }
};

// Document analysis tool
const analyzeDocumentTool: DocumentTool = {
  name: 'analyze_document',
  description: 'Analyzes the content of a document and returns insights',
  execute: async ({ documentId, documentContent }) => {
    try {
      // This is a placeholder for actual document analysis logic
      console.log(`Analyzing document: ${documentId}`);
      
      // In a real implementation, this would use AI to analyze the document
      return {
        success: true,
        documentId,
        insights: 'Document analysis results would appear here',
        wordCount: documentContent ? documentContent.split(' ').length : 0,
      };
    } catch (error) {
      console.error('Error analyzing document:', error);
      return {
        success: false,
        error: 'Failed to analyze document'
      };
    }
  }
};

// Available tools
const tools = [createDocumentTool, editDocumentTool, analyzeDocumentTool];

// Function to create a system message with tool descriptions
const createSystemMessage = () => {
  const toolDescriptions = tools.map(tool => 
    `${tool.name}: ${tool.description}`
  ).join('\n');
  
  return `
    You are a helpful document assistant. You can help users create, edit, and analyze documents.
    When creating documents, ask for necessary details like content and format.
    When editing documents, ask for the specific changes needed.
    Always maintain a professional and helpful tone.
    
    You have access to the following tools:
    ${toolDescriptions}
    
    When a user requests an action that requires one of these tools, respond with JSON in the following format:
    {
      "tool": "tool_name",
      "args": {
        "arg1": "value1",
        "arg2": "value2"
      }
    }
  `;
};

// Function to interact with the assistant
export async function interactWithAssistant(message: string, context?: any, messageHistory: any[] = []) {
  try {
    // Create messages array with system message and history
    const messages = [
      { role: 'system', content: createSystemMessage() },
      ...messageHistory,
      { role: 'user', content: message }
    ];
    
    // Add context if provided
    if (context) {
      messages.unshift({
        role: 'system',
        content: `Context: ${JSON.stringify(context)}`
      });
    }
    
    // Get response from OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      temperature: 0.7,
    });
    
    const assistantMessage = response.choices[0].message.content || '';
    
    // Check if the response contains a tool call
    try {
      const toolCall = JSON.parse(assistantMessage);
      if (toolCall.tool && toolCall.args) {
        // Find the requested tool
        const tool = tools.find(t => t.name === toolCall.tool);
        if (tool) {
          // Execute the tool
          const result = await tool.execute(toolCall.args);
          
          // Create a new message with the tool result
          const toolResultMessage = `Tool ${toolCall.tool} executed with result: ${JSON.stringify(result)}`;
          
          // Get a final response that incorporates the tool result
          return interactWithAssistant(toolResultMessage, context, [
            ...messageHistory,
            { role: 'user', content: message },
            { role: 'assistant', content: assistantMessage }
          ]);
        }
      }
    } catch (e) {
      // Not a valid JSON or not a tool call, just return the message
    }
    
    return assistantMessage;
  } catch (error) {
    console.error('Error interacting with assistant:', error);
    return 'Error: Failed to get a response from the assistant';
  }
}

// Function to stream responses from the assistant
export async function streamWithAssistant(message: string, context?: any, messageHistory: any[] = [], onChunk: (chunk: string) => void = () => {}) {
  try {
    // Create messages array with system message and history
    const messages = [
      { role: 'system', content: createSystemMessage() },
      ...messageHistory,
      { role: 'user', content: message }
    ];
    
    // Add context if provided
    if (context) {
      messages.unshift({
        role: 'system',
        content: `Context: ${JSON.stringify(context)}`
      });
    }
    
    // Get streaming response from OpenAI
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      temperature: 0.7,
      stream: true,
    });
    
    let fullResponse = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }
    
    return fullResponse;
  } catch (error) {
    console.error('Error streaming with assistant:', error);
    onChunk('Error: Failed to get a streaming response from the assistant');
    return 'Error: Failed to get a streaming response from the assistant';
  }
} 