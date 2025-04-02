import OpenAI from 'openai';
import { agentConfig, AGENT_INSTRUCTIONS, ERROR_MESSAGES } from './config';
import { Document, AgentResponse, AgentError, DocumentContext, DocumentChanges } from './types';

export class DocumentEditingAgent {
  private openai: OpenAI;
  private context: DocumentContext;

  constructor(context: DocumentContext) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION_ID,
    });
    this.context = context;
  }

  async editDocument(document: Document, prompt: string): Promise<AgentResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(document);
      const userPrompt = this.buildUserPrompt(document, prompt);

      const completion = await this.openai.chat.completions.create({
        model: agentConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: agentConfig.temperature,
        max_tokens: agentConfig.maxTokens,
        top_p: agentConfig.topP,
        frequency_penalty: agentConfig.frequencyPenalty,
        presence_penalty: agentConfig.presencePenalty,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error(ERROR_MESSAGES.PROCESSING_ERROR);
      }

      // Track document changes
      const changes: DocumentChanges = {
        before: document.content,
        after: content,
        summary: `Document edited based on prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`,
      };

      return {
        content,
        suggestions: this.generateSuggestions(document, content),
        metadata: {
          model: agentConfig.model,
          documentId: this.context.documentId,
          timestamp: Date.now(),
          userId: this.context.userId,
          changes,
        },
      };
    } catch (error) {
      const agentError: AgentError = {
        name: 'AgentError',
        message: error instanceof Error ? error.message : ERROR_MESSAGES.API_ERROR,
        code: 'AGENT_ERROR',
        details: {
          context: this.context,
          documentId: this.context.documentId,
          prompt,
        },
      };
      throw agentError;
    }
  }

  async analyzeDocument(document: Document): Promise<AgentResponse> {
    try {
      const systemPrompt = `You are an AI document analysis assistant. Your role is to analyze documents and provide insights and suggestions for improvement. Focus on content, structure, clarity, and formatting.`;
      const userPrompt = `Please analyze the following document and provide insights:\n\nTitle: ${document.title}\n\nContent:\n${document.content}`;

      const completion = await this.openai.chat.completions.create({
        model: agentConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5, // Lower temperature for analysis
        max_tokens: agentConfig.maxTokens,
        top_p: agentConfig.topP,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error(ERROR_MESSAGES.PROCESSING_ERROR);
      }

      return {
        content,
        suggestions: this.generateSuggestions(document, content),
        metadata: {
          model: agentConfig.model,
          documentId: this.context.documentId,
          timestamp: Date.now(),
          userId: this.context.userId,
          operation: 'analyze',
        },
      };
    } catch (error) {
      const agentError: AgentError = {
        name: 'AgentError',
        message: error instanceof Error ? error.message : ERROR_MESSAGES.API_ERROR,
        code: 'AGENT_ERROR',
        details: {
          context: this.context,
          documentId: this.context.documentId,
          operation: 'analyze',
        },
      };
      throw agentError;
    }
  }

  private buildSystemPrompt(document: Document): string {
    const baseInstruction = AGENT_INSTRUCTIONS.editor;
    const documentTypeSpecific = this.getDocumentTypeInstructions(document);
    return `${baseInstruction}\n\n${documentTypeSpecific}`;
  }

  private buildUserPrompt(document: Document, prompt: string): string {
    return `Document Title: ${document.title}\n\nDocument Content:\n${document.content}\n\nUser Request: ${prompt}\n\nPlease generate an updated version of this document based on the user's request.`;
  }

  private getDocumentTypeInstructions(document: Document): string {
    const documentType = this.detectDocumentType(document);
    
    switch (documentType) {
      case 'resume':
        return `This appears to be a resume. Focus on professional presentation, clear structure, achievement-focused bullet points, and appropriate formatting. Ensure consistency in dates and tenses.`;
      case 'cover_letter':
        return `This appears to be a cover letter. Focus on professional tone, clear introduction and conclusion, relevant experience highlights, and company-specific details. Avoid generic language.`;
      case 'report':
        return `This appears to be a report. Focus on logical structure, clear headings, data presentation, and actionable recommendations. Ensure executive summary captures key points.`;
      case 'article':
        return `This appears to be an article. Focus on engaging introduction, coherent flow, supporting evidence for claims, and a strong conclusion. Check for consistent voice and tone.`;
      default:
        return `Focus on improving clarity, structure, and readability. Pay attention to grammar, punctuation, and formatting.`;
    }
  }

  private detectDocumentType(document: Document): string {
    const content = document.content.toLowerCase();
    const title = document.title.toLowerCase();
    
    if (document.type === 'markdown' || document.type === 'plain') {
      // Check for resume indicators
      if (
        title.includes('resume') || 
        title.includes('cv') || 
        content.includes('work experience') || 
        content.includes('skills') || 
        content.includes('education')
      ) {
        return 'resume';
      }
      
      // Check for cover letter indicators
      if (
        title.includes('cover letter') || 
        content.includes('dear') || 
        content.includes('sincerely') || 
        content.includes('application')
      ) {
        return 'cover_letter';
      }
      
      // Check for report indicators
      if (
        title.includes('report') || 
        content.includes('executive summary') || 
        content.includes('findings') || 
        content.includes('recommendations')
      ) {
        return 'report';
      }
      
      // Check for article indicators
      if (
        title.includes('article') || 
        content.includes('introduction') || 
        content.includes('conclusion')
      ) {
        return 'article';
      }
    }
    
    return 'general';
  }

  private generateSuggestions(document: Document, editedContent: string): string[] {
    // Simple implementation - in a real system, this would be more sophisticated
    const suggestions = [];
    
    // Check if significant changes were made
    if (document.content.length !== editedContent.length) {
      suggestions.push('Content length has changed - review all modified sections');
    }
    
    // Check for formatting changes
    if (
      (document.content.match(/#{1,6}\s/g) || []).length !== 
      (editedContent.match(/#{1,6}\s/g) || []).length
    ) {
      suggestions.push('Heading structure has been modified - review document organization');
    }
    
    // Check for list changes
    if (
      (document.content.match(/[-*]\s/g) || []).length !== 
      (editedContent.match(/[-*]\s/g) || []).length
    ) {
      suggestions.push('List structure has been modified - review bullet points and listings');
    }
    
    // Add default suggestions
    suggestions.push('Review changes for accuracy and completeness');
    suggestions.push('Check if edited content maintains your original intent');
    
    return suggestions;
  }
} 