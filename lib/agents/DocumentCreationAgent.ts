import OpenAI from 'openai';
import { agentConfig, AGENT_INSTRUCTIONS, ERROR_MESSAGES } from './config';
import { Document, AgentResponse, AgentError, DocumentContext } from './types';

export class DocumentCreationAgent {
  private openai: OpenAI;
  private context: DocumentContext;

  constructor(context: DocumentContext) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION_ID,
    });
    this.context = context;
  }

  async createDocument(prompt: string, template: string = 'blank'): Promise<AgentResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(template);
      const userPrompt = this.buildUserPrompt(prompt);

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

      return {
        content,
        metadata: {
          model: agentConfig.model,
          template,
          timestamp: Date.now(),
          userId: this.context.userId,
        },
      };
    } catch (error) {
      const agentError: AgentError = {
        name: 'AgentError',
        message: error instanceof Error ? error.message : ERROR_MESSAGES.API_ERROR,
        code: 'AGENT_ERROR',
        details: {
          context: this.context,
          prompt,
          template,
        },
      };
      throw agentError;
    }
  }

  private buildSystemPrompt(template: string): string {
    const baseInstruction = AGENT_INSTRUCTIONS.CREATOR;
    const templateSpecific = this.getTemplateSpecificInstructions(template);
    return `${baseInstruction}\n\n${templateSpecific}`;
  }

  private buildUserPrompt(prompt: string): string {
    const contextInfo = this.getContextInfo();
    return `User Context: ${contextInfo}\n\nUser Request: ${prompt}`;
  }

  private getTemplateSpecificInstructions(template: string): string {
    switch (template) {
      case 'resume':
        return `Create a professional resume with the following sections:
- Contact Information
- Professional Summary
- Work Experience
- Education
- Skills
- Certifications (if applicable)
- Projects (if applicable)`;
      case 'cover_letter':
        return `Create a professional cover letter with the following structure:
- Header with contact information
- Date and recipient details
- Opening paragraph
- Body paragraphs (2-3)
- Closing paragraph
- Signature`;
      case 'report':
        return `Create a professional report with the following structure:
- Title
- Executive Summary
- Introduction
- Methodology
- Findings
- Analysis
- Conclusions
- Recommendations
- Appendices (if applicable)`;
      default:
        return 'Create a well-structured document based on the user\'s requirements.';
    }
  }

  private getContextInfo(): string {
    const info = [`User ID: ${this.context.userId}`];
    if (this.context.settings) {
      if (this.context.settings.language) info.push(`Language: ${this.context.settings.language}`);
      if (this.context.settings.style) info.push(`Style: ${this.context.settings.style}`);
      if (this.context.settings.tone) info.push(`Tone: ${this.context.settings.tone}`);
    }
    return info.join(', ');
  }
} 