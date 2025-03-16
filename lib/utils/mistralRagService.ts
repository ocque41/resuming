import { logger } from '@/lib/utils/logger';
import OpenAI from 'openai';
import Mistral from '@mistralai/mistralai';
import { retryWithExponentialBackoff } from '@/lib/utils/apiRateLimiter';
import { cacheEmbedding, getCachedEmbedding } from '@/lib/services/cache.service';

/**
 * Simple cache to store embeddings and avoid redundant API calls
 */
interface EmbeddingCache {
  [key: string]: {
    embedding: number[];
    timestamp: number;
  };
}

/**
 * Simple in-memory vector store for nearest neighbor search
 */
class SimpleVectorStore {
  private vectors: number[][] = [];
  private documents: string[] = [];

  /**
   * Add vectors and their corresponding documents to the store
   * @param vectors Array of embedding vectors
   * @param documents Array of document texts
   */
  public add(vectors: number[][], documents: string[]): void {
    if (vectors.length !== documents.length) {
      throw new Error('Vectors and documents arrays must have the same length');
    }
    this.vectors.push(...vectors);
    this.documents.push(...documents);
  }

  /**
   * Search for nearest neighbors using cosine similarity
   * @param queryVector Query vector to search for
   * @param k Number of neighbors to return
   * @returns Object with indices and distances
   */
  public search(queryVector: number[], k: number): { indices: number[], distances: number[] } {
    if (this.vectors.length === 0) {
      return { indices: [], distances: [] };
    }

    // Calculate cosine similarity between query and all vectors
    const similarities: { index: number, similarity: number }[] = this.vectors.map((vector, index) => ({
      index,
      similarity: this.cosineSimilarity(queryVector, vector)
    }));

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Get top k results
    const topK = similarities.slice(0, k);
    const indices = topK.map(item => item.index);
    const distances = topK.map(item => 1 - item.similarity); // Convert similarity to distance

    return { indices, distances };
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param a First vector
   * @param b Second vector
   * @returns Cosine similarity value (0-1)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0; // Avoid division by zero
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get the document at a specific index
   * @param index Document index
   * @returns Document text
   */
  public getDocument(index: number): string {
    return this.documents[index];
  }

  /**
   * Clear all vectors and documents from the store
   */
  public clear(): void {
    this.vectors = [];
    this.documents = [];
  }

  /**
   * Get the number of vectors in the store
   * @returns Number of vectors
   */
  public size(): number {
    return this.vectors.length;
  }
}

/**
 * MistralRAGService provides retrieval-augmented generation capabilities for CV analysis
 * using AI APIs and in-memory vector storage for embedding storage and retrieval.
 * Note: Currently using OpenAI for stability but maintains interface compatibility.
 */
export class MistralRAGService {
  private openaiClient: OpenAI = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  });
  private mistralClient: Mistral | null = null;
  private vectorStore: SimpleVectorStore = new SimpleVectorStore();
  private chunks: string[] = [];
  private chunkSize: number = 1000;
  private chunkOverlap: number = 200;
  private embeddingModel: string = 'text-embedding-ada-002'; // OpenAI embedding model
  private mistralEmbeddingModel: string = 'mistral-embed'; // Mistral embedding model
  private openaiGenerationModel: string = 'gpt-3.5-turbo'; // OpenAI chat model
  private mistralGenerationModel: string = 'mistral-large-latest'; // Mistral chat model
  private embeddingCache: EmbeddingCache = {};
  private cacheTTL: number = 3600000; // Cache TTL: 1 hour in milliseconds
  private useMistral: boolean = false; // Flag to control which API to use
  private originalCVText: string = '';

  /**
   * Initialize the MistralRAG service
   */
  constructor(preferredService: 'auto' | 'openai' | 'mistral' = 'auto') {
    try {
      // Try to initialize Mistral client if API key is available and not explicitly using OpenAI
      const mistralApiKey = process.env.MISTRAL_API_KEY;
      
      // If OpenAI is explicitly preferred, don't even try Mistral
      if (preferredService === 'openai') {
        logger.info('OpenAI service explicitly requested, skipping Mistral initialization');
        this.useMistral = false;
      } else if (mistralApiKey) {
        try {
          this.mistralClient = new Mistral(mistralApiKey);
          // Only use Mistral if it's explicitly preferred or auto
          this.useMistral = preferredService === 'mistral' || preferredService === 'auto';
          logger.info('Successfully initialized Mistral client');
        } catch (mistralError) {
          logger.error(`Failed to initialize Mistral client: ${mistralError instanceof Error ? mistralError.message : String(mistralError)}`);
          logger.info('Falling back to OpenAI for all operations');
          this.useMistral = false;
        }
      } else {
        logger.info('No Mistral API key found, using OpenAI for all operations');
        this.useMistral = false;
      }
      
      // Validate OpenAI API key
      if (!process.env.OPENAI_API_KEY) {
        logger.warn('No OpenAI API key found, some operations may fail');
      }
      
      // Initialize vector store
      this.vectorStore = new SimpleVectorStore();
      
      // Initialize embedding cache
      this.embeddingCache = {};
      
      logger.info(`MistralRAG service initialized successfully with ${this.useMistral ? 'Mistral' : 'OpenAI'} as primary service`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error initializing MistralRAG service: ${errorMessage}`);
      
      // Disable Mistral if there was an error
      this.useMistral = false;
      
      throw new Error(`Failed to initialize MistralRAG service: ${errorMessage}`);
    }
  }

  /**
   * Reset the vector store
   */
  private resetIndex(): void {
    this.vectorStore = new SimpleVectorStore();
    this.chunks = [];
  }

  /**
   * Process a CV document and prepare it for analysis
   * @param cvText The CV text to process
   */
  public async processCVDocument(cvText: string): Promise<void> {
    try {
      logger.info('Processing CV document with RAG service');
      
      // Reset the index for a new document
      this.resetIndex();
      
      // Store the original CV text for fallback
      this.originalCVText = cvText;
      
      // Optimize chunk size based on document length
      this.optimizeChunkSize(cvText);
      logger.info(`Set optimal chunk size to ${this.chunkSize} characters`);
      
      // Split the CV text into chunks
      this.chunks = this.splitIntoChunks(cvText);
      logger.info(`Split CV into ${this.chunks.length} chunks`);
      
      // Create embeddings for all chunks
      const embeddings = await this.createEmbeddingsForChunks(this.chunks);
      logger.info(`Created embeddings for ${embeddings.length} chunks`);
      
      // Add embeddings to vector store
      this.vectorStore.add(embeddings, this.chunks);
      logger.info('Added embeddings to vector store');
      
      // Pre-warm the models to avoid cold start issues
      try {
        if (this.useMistral && this.mistralClient) {
          await this.mistralClient.chat({
            model: this.mistralGenerationModel,
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant.'
              },
              {
                role: 'user',
                content: 'Hello, this is a warm-up message.'
              }
            ]
          });
          logger.info('Successfully pre-warmed Mistral model');
        } else {
          await this.openaiClient.chat.completions.create({
            model: this.openaiGenerationModel,
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant.'
              },
              {
                role: 'user',
                content: 'Hello, this is a warm-up message.'
              }
            ]
          });
          logger.info('Successfully pre-warmed OpenAI model');
        }
      } catch (warmupError) {
        // Non-critical error, just log it
        logger.warn(`Model warm-up failed: ${warmupError instanceof Error ? warmupError.message : String(warmupError)}`);
      }
      
      return;
    } catch (error) {
      // Fix error type handling for logger
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing CV document with RAG service: ${errorMessage}`);
      
      // Initialize with empty chunks if processing fails
      this.chunks = [cvText];
      this.originalCVText = cvText;
      
      throw error;
    }
  }

  /**
   * Optimize chunk size based on document length
   * @param text Document text
   */
  private optimizeChunkSize(text: string): void {
    const textLength = text.length;
    
    // For very short documents, use smaller chunks
    if (textLength < 1000) {
      this.chunkSize = 200;
    } 
    // For medium-length documents
    else if (textLength < 5000) {
      this.chunkSize = 500;
    }
    // For long documents, use larger chunks with overlap
    else {
      this.chunkSize = 1024;
    }
  }

  /**
   * Split text into chunks, trying to preserve semantic boundaries
   * @param text Text to split
   * @returns Array of text chunks
   */
  private splitIntoChunks(text: string): string[] {
    // First try to split by section headers
    const sectionHeaders = [
      'education', 'experience', 'work', 'skills', 'projects', 
      'achievements', 'certifications', 'publications', 'languages',
      'interests', 'references', 'summary', 'objective', 'profile'
    ];

    // Create regex to match common CV section headers (case insensitive)
    const headerRegex = new RegExp(
      `(^|\\n)\\s*(${sectionHeaders.join('|')})\\s*(?::|\\n)`, 
      'gi'
    );
    
    // Find all section header matches
    const matches: { index: number, header: string }[] = [];
    let match;
    while ((match = headerRegex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        header: match[2].toLowerCase()
      });
    }
    
    // If we found sections, split by them with some overlap
    if (matches.length > 1) {
      const chunks: string[] = [];
      const overlap = 100; // Characters of overlap between chunks
      
      for (let i = 0; i < matches.length; i++) {
        const startIdx = matches[i].index;
        const endIdx = i < matches.length - 1 
          ? matches[i + 1].index + overlap 
          : text.length;
        
        const chunk = text.substring(startIdx, Math.min(endIdx, text.length));
        
        // Add section name as context
        const enhancedChunk = `Section: ${matches[i].header}\n${chunk}`;
        chunks.push(enhancedChunk);
      }
      
      return chunks;
    }
    
    // Fall back to character-based splitting if no sections found
    return this.splitByCharacters(text);
  }

  /**
   * Simple character-based text splitting
   */
  private splitByCharacters(text: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += this.chunkSize) {
      const chunk = text.substring(i, i + this.chunkSize);
      chunks.push(chunk);
    }
    return chunks;
  }

  /**
   * Create embeddings for all chunks
   * @param chunks Array of text chunks
   * @returns Array of embeddings
   */
  private async createEmbeddingsForChunks(chunks: string[]): Promise<number[][]> {
    try {
      // Create embeddings in batches to avoid rate limiting
      const embeddings: number[][] = [];
      
      // Process chunks in batches of 5
      for (let i = 0; i < chunks.length; i += 5) {
        const batch = chunks.slice(i, i + 5);
        const batchEmbeddings = await Promise.all(batch.map(chunk => this.createEmbedding(chunk)));
        embeddings.push(...batchEmbeddings);
      }
      
      return embeddings;
    } catch (error) {
      // Fix error type handling for logger
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error creating embeddings for chunks: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Create an embedding for a text
   * @param text Text to create embedding for
   * @returns Embedding vector
   */
  private async createEmbedding(text: string): Promise<number[]> {
    // Check cache first using the enhanced caching system
    const cachedEmbedding = getCachedEmbedding(text);
    if (cachedEmbedding) {
      return cachedEmbedding;
    }
    
    try {
      if (this.useMistral && this.mistralClient) {
        try {
          // Use Mistral embeddings with rate limiting and retries
          const response = await retryWithExponentialBackoff(
            async () => {
              return await this.mistralClient!.embeddings({
                model: this.mistralEmbeddingModel,
                input: text
              });
            },
            { service: 'mistral', maxRetries: 2 } // Reduced retries to fail faster to OpenAI
          );
          
          const embedding = response.data[0].embedding;
          
          // Cache the embedding with the enhanced system
          cacheEmbedding(text, embedding, 'mistral');
          
          return embedding;
        } catch (mistralError) {
          // If Mistral fails, fallback to OpenAI
          logger.info('Falling back to OpenAI for embeddings due to Mistral error:', 
            mistralError instanceof Error ? mistralError.message : String(mistralError));
          
          // Continue to OpenAI implementation below
        }
      }
      
      // Use OpenAI embeddings with rate limiting and retries
      const response = await retryWithExponentialBackoff(
        async () => {
          return await this.openaiClient.embeddings.create({
        model: this.embeddingModel,
        input: text
      });
        },
        { service: 'openai', maxRetries: 3 }
      );
      
      const embedding = response.data[0].embedding;
      
      // Cache the embedding with the enhanced system
      cacheEmbedding(text, embedding, 'openai');
      
      return embedding;
    } catch (error) {
      logger.error('Error creating embedding:', error instanceof Error ? error.message : String(error));
      throw new Error(`Failed to create embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clears the embedding cache
   */
  public clearCache(): void {
    this.embeddingCache = {};
    logger.info('Embedding cache cleared');
  }

  /**
   * Retrieve relevant chunks for a query
   * @param query Query to find relevant chunks for
   * @param k Number of chunks to return
   * @returns Array of relevant chunks
   */
  public async retrieveRelevantChunks(query: string, k: number = 3): Promise<string[]> {
    try {
      // Create embedding for query
      const queryEmbedding = await this.createEmbedding(query);
      
      // Find k nearest neighbors
      const { indices } = this.vectorStore.search(queryEmbedding, k);
      
      // Get the corresponding chunks
      const relevantChunks = indices.map(index => this.vectorStore.getDocument(index));
      
      return relevantChunks;
    } catch (error) {
      // Fix error type handling for logger
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error retrieving relevant chunks: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Generate a response to a query using RAG
   * @param query The query to answer
   * @param useSystemPrompt Whether to use a system prompt or not
   * @returns The generated response
   */
  public async generateResponse(query: string, useSystemPrompt?: boolean | string): Promise<string> {
    try {
      // If useSystemPrompt is a string, use it directly
      if (typeof useSystemPrompt === 'string') {
        return await this.generateDirectResponse(query, useSystemPrompt);
      }
      
      // If no RAG is requested, generate a direct response
      if (useSystemPrompt === false || this.chunks.length === 0) {
        return await this.generateDirectResponse(query);
      }
      
      // Retrieve relevant chunks
      const relevantChunks = await this.retrieveRelevantChunks(query);
      
      // Combine chunks into context
      const context = relevantChunks.join('\n\n');
      
      // Generate response with context
      if (this.useMistral && this.mistralClient) {
        // Use Mistral for generation with rate limiting and retries
        const response = await retryWithExponentialBackoff(
          async () => {
            return await this.mistralClient!.chat({
              model: this.mistralGenerationModel,
              messages: [
                {
                  role: 'system',
                  content: `You are an AI assistant analyzing a CV. Use the following CV context to answer the question. 
                  If the information is not in the context, say so honestly.
                  
                  CV Context:
                  ${context}`
                },
                {
                  role: 'user',
                  content: query
                }
              ]
            });
          },
          { service: 'mistral', maxRetries: 3 }
        );
        
        return response.choices[0].message.content || '';
      } else {
        // Use OpenAI for generation with rate limiting and retries
        const response = await retryWithExponentialBackoff(
          async () => {
            return await this.openaiClient.chat.completions.create(
              this.createApiParams({
                model: this.openaiGenerationModel,
                messages: [
                  {
                    role: 'system',
                    content: `You are an AI assistant analyzing a CV. Use the following CV context to answer the question. 
                    If the information is not in the context, say so honestly.
                    
                    CV Context:
                    ${context}`
                  },
                  {
                    role: 'user',
                    content: query
                  }
                ],
                temperature: 0.7,
                maxTokens: 1000,
              }, false)
            );
          },
          { service: 'openai', maxRetries: 3 }
        );
        
        return response.choices[0].message.content || '';
      }
    } catch (error) {
      logger.error('Error generating response:', error instanceof Error ? error.message : String(error));
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a response without using RAG
   * @param query Query to generate response for
   * @param systemPrompt Optional system prompt
   * @returns Generated response
   */
  private async generateDirectResponse(query: string, systemPrompt?: string): Promise<string> {
    try {
      const defaultSystemPrompt = `You are an AI assistant analyzing a CV. Answer the question based on your knowledge about CVs and job applications.`;
      
      if (this.useMistral && this.mistralClient) {
        // Use Mistral for direct response with rate limiting and retries
        const response = await retryWithExponentialBackoff(
          async () => {
            return await this.mistralClient!.chat({
              model: this.mistralGenerationModel,
              messages: [
                {
                  role: 'system',
                  content: systemPrompt || defaultSystemPrompt
                },
                {
                  role: 'user',
                  content: query
                }
              ]
            });
          },
          { service: 'mistral', maxRetries: 3 }
        );
        
        return response.choices[0].message.content || '';
      } else {
        // Use OpenAI for direct response with rate limiting and retries
        const response = await retryWithExponentialBackoff(
          async () => {
            return await this.openaiClient.chat.completions.create(
              this.createApiParams({
                model: this.openaiGenerationModel,
                messages: [
                  {
                    role: 'system',
                    content: systemPrompt || defaultSystemPrompt
                  },
                  {
                    role: 'user',
                    content: query
                  }
                ],
                temperature: 0.7,
                maxTokens: 1000,
              }, false)
            );
          },
          { service: 'openai', maxRetries: 3 }
        );
        
        return response.choices[0].message.content || '';
      }
    } catch (error) {
      logger.error('Error generating direct response:', error instanceof Error ? error.message : String(error));
      throw new Error(`Failed to generate direct response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract specific information from the CV using RAG
   * @param field Field to extract (e.g., 'skills', 'education', 'experience')
   * @returns Extracted information as a string
   */
  public async extractField(field: string): Promise<string> {
    const query = `Extract all information related to ${field} from the CV. List only the specific ${field} information in a structured format.`;
    return this.generateResponse(query, `You are a CV parser that extracts ${field} information. Be concise and focus only on extracting the ${field}.`);
  }

  /**
   * Extract skills from the CV using RAG
   * @returns Array of skills as strings
   */
  public async extractSkills(): Promise<string[]> {
    const skillsText = await this.extractField('skills');
    
    // Parse the skills from the text
    // First try to split by common delimiters like bullets or commas
    let skills: string[] = [];
    
    if (skillsText.includes('•') || skillsText.includes('-') || skillsText.includes('*')) {
      // Split by bullet points
      skills = skillsText.split(/[•\-*]/).map(s => s.trim()).filter(s => s.length > 0);
    } else if (skillsText.includes(',')) {
      // Split by commas
      skills = skillsText.split(',').map(s => s.trim()).filter(s => s.length > 0);
    } else {
      // Split by lines as a fallback
      skills = skillsText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    }
    
    // Clean up skills (remove numbers, unnecessary text)
    skills = skills.map(skill => {
      // Remove any leading numbers or bullets
      return skill.replace(/^[\d\.\-\*•]+\s*/, '').trim();
    }).filter(skill => skill.length > 0);
    
    return skills;
  }

  /**
   * Analyze the CV format and provide feedback
   * @param cvText The CV text to analyze (optional, will use originalCVText if not provided)
   * @returns Analysis of the CV format with strengths, weaknesses, and recommendations
   */
  async analyzeCVFormat(cvText?: string): Promise<{
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  }> {
    logger.info('Analyzing CV format');
    
    // Use provided text or fall back to originalCVText
    const textToAnalyze = cvText || this.originalCVText;
    
    if (!textToAnalyze) {
      logger.warn('No CV text available for format analysis');
      return {
        strengths: ['Clear structure'],
        weaknesses: ['Could not fully analyze the CV format'],
        recommendations: ['Consider using a standard CV template']
      };
    }
    
    // Default values in case of failure
    const defaultAnalysis = {
      strengths: ['Clear structure'],
      weaknesses: ['Could not fully analyze the CV format'],
      recommendations: ['Consider using a standard CV template']
    };
    
    try {
      // Use the improved rate limiter with fallback
      return await retryWithExponentialBackoff(
        async () => {
          // Use Mistral for format analysis if available
          if (this.mistralClient) {
      const prompt = `
            You are a CV format expert. Analyze the following CV and provide feedback on its format, structure, and presentation.
            
            CV Text:
            ${textToAnalyze.substring(0, 4000)} ${textToAnalyze.length > 4000 ? '...(truncated)' : ''}
            
            Analyze the CV format and structure, NOT the content. Focus on layout, organization, readability, and visual appeal.
            
            Return ONLY a JSON object with the following structure:
            {
              "strengths": ["strength1", "strength2", ...],
              "weaknesses": ["weakness1", "weakness2", ...],
              "recommendations": ["recommendation1", "recommendation2", ...]
            }
            
            IMPORTANT: Return ONLY the raw JSON object. DO NOT use markdown formatting, code blocks, or any other formatting. DO NOT include any explanation or additional text before or after the JSON.
            `;
            
            if (!this.mistralClient) {
              throw new Error('Mistral client not initialized');
            }
            
            const response = await this.mistralClient.chat({
              model: this.mistralGenerationModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              maxTokens: 2000,
            });
            
            const content = response.choices[0]?.message?.content || '';
            
            try {
              // First try to find JSON in markdown code blocks
              const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
              let jsonContent = '';
              
              if (jsonMatch && jsonMatch[1]) {
                // Found JSON in code block
                jsonContent = jsonMatch[1].trim();
              } else {
                // Try to find JSON object directly
                const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
                if (jsonObjectMatch) {
                  jsonContent = jsonObjectMatch[0].trim();
                } else {
                  // Use the whole content as a last resort
                  jsonContent = content.trim();
                }
              }
              
              // Parse the JSON response
              const result = JSON.parse(jsonContent);
              
              // Validate the structure
              if (!result.strengths || !result.weaknesses || !result.recommendations) {
                logger.warn('Invalid CV format analysis structure, using regex extraction');
                return this.extractFormatAnalysisWithRegex(content);
              }
              
              // Ensure arrays are arrays
              ['strengths', 'weaknesses', 'recommendations'].forEach(field => {
                if (!Array.isArray(result[field])) {
                  result[field] = result[field] ? [result[field]] : [];
                }
              });
        
        return result;
      } catch (parseError) {
              logger.error('Error parsing CV format analysis:', parseError instanceof Error ? parseError.message : String(parseError));
              logger.debug('Raw response:', content);
              
              // Try to extract with regex as fallback
              return this.extractFormatAnalysisWithRegex(content);
            }
          } else if (this.openaiClient) {
            // Fallback to OpenAI if Mistral is not available
            logger.info('Using OpenAI for CV format analysis (Mistral not available)');
            
            const response = await this.openaiClient.chat.completions.create(
              this.createApiParams({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a CV format expert. Analyze the CV and provide feedback on format, structure, and presentation.'
                  },
                  {
                    role: 'user',
                    content: `Analyze this CV format and structure (not content):
                    
                    ${textToAnalyze}
                    
                    Return ONLY a JSON object with: {"strengths": [...], "weaknesses": [...], "recommendations": [...]}
                    No markdown, no explanation, just the JSON.`
                  }
                ],
                temperature: 0.1,
                maxTokens: 1000,
              }, false)
            );
            
            const content = response.choices[0]?.message?.content || '';
            
            try {
              // Extract JSON from markdown if present
              const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/) || [null, content];
              const jsonContent = jsonMatch[1] || content;
              
              // Parse the JSON response
              const result = JSON.parse(jsonContent.trim());
              
              // Validate the structure
              if (!result.strengths || !result.weaknesses || !result.recommendations) {
                logger.warn('Invalid CV format analysis structure from OpenAI, using regex extraction');
                return this.extractFormatAnalysisWithRegex(content);
              }
              
              // Ensure arrays are arrays
              ['strengths', 'weaknesses', 'recommendations'].forEach(field => {
                if (!Array.isArray(result[field])) {
                  result[field] = result[field] ? [result[field]] : [];
                }
              });
              
              return result;
            } catch (parseError) {
              logger.error('Error parsing OpenAI CV format analysis:', parseError instanceof Error ? parseError.message : String(parseError));
              logger.debug('Raw OpenAI response:', content);
              
              // Try to extract with regex as fallback
              return this.extractFormatAnalysisWithRegex(content);
            }
          } else {
            // No AI service available
            logger.warn('No AI service available for CV format analysis');
            return defaultAnalysis;
          }
        },
        {
          service: this.mistralClient ? 'mistral' : 'openai',
          initialDelayMs: 2000,
          maxDelayMs: 30000,
          maxRetries: 3,
          priority: 5,
          taskId: `analyze-cv-format-${Date.now()}`,
          fallbackFn: async () => {
            // If Mistral fails but OpenAI is available, try OpenAI
            if (!this.mistralClient && this.openaiClient) {
              logger.info('Using OpenAI fallback for CV format analysis');
              
              try {
                const response = await this.openaiClient.chat.completions.create(
                  this.createApiParams({
                    model: 'gpt-4o',
                    messages: [
                      {
                        role: 'system',
                        content: 'You are a CV format expert. Analyze the CV and provide feedback on format, structure, and presentation.'
                      },
                      {
                        role: 'user',
                        content: `Analyze this CV format and structure (not content):
                        
                        ${textToAnalyze}
                        
                        Return ONLY a JSON object with: {"strengths": [...], "weaknesses": [...], "recommendations": [...]}
                        No markdown, no explanation, just the JSON.`
                      }
                    ],
                    temperature: 0.1,
                    maxTokens: 1000,
                  }, false)
                );
                
                const content = response.choices[0]?.message?.content || '';
                
                try {
                  // Extract JSON from markdown if present
                  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/) || [null, content];
                  const jsonContent = jsonMatch[1] || content;
                  
                  // Parse the JSON response
                  const result = JSON.parse(jsonContent.trim());
                  
                  // Validate the structure
                  if (!result.strengths || !result.weaknesses || !result.recommendations) {
                    return this.extractFormatAnalysisWithRegex(content);
                  }
                  
                  // Ensure arrays are arrays
                  ['strengths', 'weaknesses', 'recommendations'].forEach(field => {
                    if (!Array.isArray(result[field])) {
                      result[field] = result[field] ? [result[field]] : [];
                    }
                  });
                  
                  return result;
                } catch (parseError) {
                  return this.extractFormatAnalysisWithRegex(content);
                }
              } catch (error) {
                logger.error('OpenAI fallback failed for CV format analysis:', error instanceof Error ? error.message : String(error));
                return defaultAnalysis;
              }
            }
            
            // If all else fails, return default analysis
            return defaultAnalysis;
          }
        }
      );
    } catch (error) {
      logger.error('Failed to analyze CV format:', error instanceof Error ? error.message : String(error));
      return defaultAnalysis;
    }
  }

  /**
   * Extract format analysis using regex as a fallback
   * @param content The raw response content
   * @returns Extracted format analysis
   */
  private extractFormatAnalysisWithRegex(content: string): {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    logger.info('Extracting CV format analysis with regex');
    
    const result = {
      strengths: [] as string[],
      weaknesses: [] as string[],
      recommendations: [] as string[]
    };
    
    // Extract strengths
    const strengthsMatch = content.match(/strengths["\s:]+\[(.*?)\]/is);
    if (strengthsMatch && strengthsMatch[1]) {
      result.strengths = strengthsMatch[1]
        .split(',')
        .map(s => s.replace(/"/g, '').trim())
        .filter(Boolean);
    }
    
    // Extract weaknesses
    const weaknessesMatch = content.match(/weaknesses["\s:]+\[(.*?)\]/is);
    if (weaknessesMatch && weaknessesMatch[1]) {
      result.weaknesses = weaknessesMatch[1]
        .split(',')
        .map(s => s.replace(/"/g, '').trim())
        .filter(Boolean);
    }
    
    // Extract recommendations
    const recommendationsMatch = content.match(/recommendations["\s:]+\[(.*?)\]/is);
    if (recommendationsMatch && recommendationsMatch[1]) {
      result.recommendations = recommendationsMatch[1]
        .split(',')
        .map(s => s.replace(/"/g, '').trim())
        .filter(Boolean);
    }
    
    // If we couldn't extract anything, provide default values
    if (result.strengths.length === 0) {
      result.strengths = ['Clear structure'];
    }
    
    if (result.weaknesses.length === 0) {
      result.weaknesses = ['Could not fully analyze the CV format'];
    }
    
    if (result.recommendations.length === 0) {
      result.recommendations = ['Consider using a standard CV template'];
    }
    
    return result;
  }

  /**
   * Generate a cache key for embedding
   */
  private generateCacheKey(text: string): string {
    return `${this.embeddingModel}:${text.substring(0, 100)}`;
  }

  /**
   * Extract strengths from text using regex
   */
  private extractStrengthsWithRegex(text: string): string[] {
    const strengthsRegex = /strengths["'\s:]+\[(.*?)\]/is;
    const match = text.match(strengthsRegex);
    if (match && match[1]) {
      return this.extractArrayFromString(match[1]);
    }
    return ['Clear structure', 'Includes essential sections', 'Appropriate length'];
  }

  /**
   * Extract weaknesses from text using regex
   */
  private extractWeaknessesWithRegex(text: string): string[] {
    const weaknessesRegex = /weaknesses["'\s:]+\[(.*?)\]/is;
    const match = text.match(weaknessesRegex);
    if (match && match[1]) {
      return this.extractArrayFromString(match[1]);
    }
    return ['Could improve formatting', 'Some sections could be more detailed', 'Consider adding more keywords'];
  }

  /**
   * Extract recommendations from text using regex
   */
  private extractRecommendationsWithRegex(text: string): string[] {
    const recommendationsRegex = /recommendations["'\s:]+\[(.*?)\]/is;
    const match = text.match(recommendationsRegex);
    if (match && match[1]) {
      return this.extractArrayFromString(match[1]);
    }
    return ['Enhance visual hierarchy', 'Add more specific achievements', 'Quantify accomplishments where possible'];
  }

  /**
   * Helper method to extract array items from a string
   */
  private extractArrayFromString(text: string): string[] {
    return text
      .split(',')
      .map(item => item.replace(/"/g, '').trim())
      .filter(Boolean);
  }

  /**
   * Extract keywords from the CV
   * @returns Array of keywords
   */
  public async extractKeywords(): Promise<string[]> {
    logger.info('Extracting keywords from CV');
    
    if (!this.originalCVText) {
      logger.warn('No CV text available for keyword extraction');
      return [];
    }
    
    try {
      // First try to use Mistral for keyword extraction
      if (this.mistralClient) {
        return await retryWithExponentialBackoff(
          async () => {
      const prompt = `
            Extract the most important keywords from this CV text. Focus on skills, technologies, qualifications, and industry-specific terms.
            
            CV Text:
            ${this.originalCVText.substring(0, 4000)} ${this.originalCVText.length > 4000 ? '...(truncated)' : ''}
            
            Return ONLY a JSON array of keywords, like this: ["keyword1", "keyword2", "keyword3"]
            Do not include any explanation or additional text.
            `;
            
            const response = await this.mistralClient!.chat({
              model: this.mistralGenerationModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              maxTokens: 1000,
            });
            
            const content = response.choices[0]?.message?.content || '';
            
            try {
              // Try to parse as JSON
              const jsonMatch = content.match(/\[(.*?)\]/s);
              if (jsonMatch) {
                const jsonStr = `[${jsonMatch[1]}]`;
                const keywords = JSON.parse(jsonStr);
                return Array.isArray(keywords) ? keywords : [];
              }
              
              // If not valid JSON, extract keywords using regex
              const keywordRegex = /"([^"]+)"/g;
              const matches = [...content.matchAll(keywordRegex)];
              return matches.map(match => match[1]);
            } catch (parseError) {
              logger.error('Error parsing keywords response:', parseError instanceof Error ? parseError.message : String(parseError));
              
              // Fallback to simple extraction
              return this.extractKeywordsWithRegex(content);
            }
          },
          {
            service: 'mistral',
            initialDelayMs: 2000,
            maxDelayMs: 30000,
            maxRetries: 2,
            priority: 5,
            taskId: `extract-keywords-${Date.now()}`,
            fallbackFn: async () => {
              // Fallback to OpenAI if Mistral fails
              if (this.openaiClient) {
                return this.extractKeywordsWithOpenAI();
              }
              return this.extractKeywordsWithRegex(this.originalCVText);
            }
          }
        );
      } else if (this.openaiClient) {
        // Use OpenAI if Mistral is not available
        return this.extractKeywordsWithOpenAI();
      }
      
      // If no AI service is available, use regex
      return this.extractKeywordsWithRegex(this.originalCVText);
    } catch (error) {
      logger.error('Error extracting keywords:', error instanceof Error ? error.message : String(error));
      return this.extractKeywordsWithRegex(this.originalCVText);
    }
  }
  
  /**
   * Extract keywords using OpenAI
   */
  private async extractKeywordsWithOpenAI(): Promise<string[]> {
    try {
      const prompt = `Extract all keywords and key phrases from the following CV. Focus on skills, technologies, job titles, and industry-specific terms. Return them as a comma-separated list.

CV Content:
${this.originalCVText}`;

      const response = await this.openaiClient.chat.completions.create(
        this.createApiParams({
          model: this.openaiGenerationModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          maxTokens: 50,
        }, false) // false indicates this is for OpenAI, not Mistral
      );
      
      const content = response.choices[0]?.message?.content?.trim() || '';
      return this.extractArrayFromString(content);
    } catch (error) {
      logger.error('Error extracting keywords with OpenAI:', error instanceof Error ? error.message : String(error));
      return this.extractKeywordsWithRegex(this.originalCVText);
    }
  }

  /**
   * Extract keywords using regex
   */
  private extractKeywordsWithRegex(text: string): string[] {
    // Common skill keywords to look for
    const commonSkills = [
      'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'ruby', 'php', 'swift', 'kotlin',
      'react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring', 'asp.net',
      'html', 'css', 'sass', 'less', 'bootstrap', 'tailwind', 'material-ui',
      'sql', 'mysql', 'postgresql', 'mongodb', 'firebase', 'dynamodb', 'redis',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'github actions',
      'git', 'jira', 'confluence', 'agile', 'scrum', 'kanban', 'waterfall',
      'leadership', 'management', 'communication', 'teamwork', 'problem-solving',
      'machine learning', 'ai', 'data science', 'data analysis', 'big data',
      'marketing', 'sales', 'customer service', 'project management', 'product management',
      'finance', 'accounting', 'hr', 'recruitment', 'training'
    ];
    
    // Extract words that might be skills or keywords
    const words = text.toLowerCase().match(/\b[a-z0-9][\w\-\.+#]+\b/g) || [];
    
    // Count occurrences of each word
    const wordCounts: Record<string, number> = {};
    words.forEach(word => {
      if (word.length > 2) { // Ignore very short words
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
    
    // Filter for common skills and words that appear multiple times
    const keywords = Object.keys(wordCounts).filter(word => {
      return commonSkills.includes(word) || wordCounts[word] >= 3;
    });
    
    // Limit to top 30 keywords
    return keywords.slice(0, 30);
  }
  
  /**
   * Extract key requirements from the CV
   * @returns Array of key requirements
   */
  public async extractKeyRequirements(): Promise<string[]> {
    logger.info('Extracting key requirements from CV');
    
    if (!this.originalCVText) {
      logger.warn('No CV text available for key requirements extraction');
      return [];
    }
    
    try {
      // First try to use Mistral for key requirements extraction
      if (this.mistralClient) {
        return await retryWithExponentialBackoff(
          async () => {
            const prompt = `
            Analyze this CV text and identify the key requirements or qualifications that the person has.
            Focus on education, certifications, years of experience, and specific qualifications.
            
            CV Text:
            ${this.originalCVText.substring(0, 4000)} ${this.originalCVText.length > 4000 ? '...(truncated)' : ''}
            
            Return ONLY a JSON array of key requirements, like this: ["requirement1", "requirement2", "requirement3"]
            Do not include any explanation or additional text.
            `;
            
            const response = await this.mistralClient!.chat({
              model: this.mistralGenerationModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              maxTokens: 1000,
            });
            
            const content = response.choices[0]?.message?.content || '';
            
            try {
              // Try to parse as JSON
              const jsonMatch = content.match(/\[(.*?)\]/s);
              if (jsonMatch) {
                const jsonStr = `[${jsonMatch[1]}]`;
                const requirements = JSON.parse(jsonStr);
                return Array.isArray(requirements) ? requirements : [];
              }
              
              // If not valid JSON, extract requirements using regex
              const requirementRegex = /"([^"]+)"/g;
              const matches = [...content.matchAll(requirementRegex)];
              return matches.map(match => match[1]);
            } catch (parseError) {
              logger.error('Error parsing key requirements response:', parseError instanceof Error ? parseError.message : String(parseError));
              
              // Fallback to simple extraction
              return this.extractRequirementsWithRegex(content);
            }
          },
          {
            service: 'mistral',
            initialDelayMs: 2000,
            maxDelayMs: 30000,
            maxRetries: 2,
            priority: 5,
            taskId: `extract-requirements-${Date.now()}`,
            fallbackFn: async () => {
              // Fallback to OpenAI if Mistral fails
              if (this.openaiClient) {
                return this.extractRequirementsWithOpenAI();
              }
              return this.extractRequirementsWithRegex(this.originalCVText);
            }
          }
        );
      } else if (this.openaiClient) {
        // Use OpenAI if Mistral is not available
        return this.extractRequirementsWithOpenAI();
      }
      
      // If no AI service is available, use regex
      return this.extractRequirementsWithRegex(this.originalCVText);
    } catch (error) {
      logger.error('Error extracting key requirements:', error instanceof Error ? error.message : String(error));
      return this.extractRequirementsWithRegex(this.originalCVText);
    }
  }
  
  /**
   * Extract key requirements using OpenAI
   */
  private async extractRequirementsWithOpenAI(): Promise<string[]> {
    try {
      const prompt = `Extract key requirements from the following CV. Focus on qualifications, certifications, and essential skills that would be required for positions matching this CV. Return them as a comma-separated list.

CV Content:
${this.originalCVText}`;

      const response = await this.openaiClient.chat.completions.create(
        this.createApiParams({
          model: this.openaiGenerationModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          maxTokens: 1000,
        }, false)
      );
      
      const content = response.choices[0]?.message?.content?.trim() || '';
      return this.extractArrayFromString(content);
    } catch (error) {
      logger.error('Error extracting requirements with OpenAI:', error instanceof Error ? error.message : String(error));
      return this.extractRequirementsWithRegex(this.originalCVText);
    }
  }
  
  /**
   * Extract requirements using regex patterns
   */
  private extractRequirementsWithRegex(text: string): string[] {
    // Fallback to simple regex extraction
    const requirementPatterns = [
      /required:?\s*([^.]+)/gi,
      /qualifications:?\s*([^.]+)/gi,
      /certifications:?\s*([^.]+)/gi,
      /\b(\d+\+?\s*years?\s*(?:of)?\s*experience)\b/gi,
      /\b(Bachelor'?s|Master'?s|PhD|Doctorate)\b/gi,
      /\b(certified|licensed|accredited)\b/gi
    ];
    
    const requirements: string[] = [];
    
    requirementPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        requirements.push(match[1].trim());
      }
    });
    
    return [...new Set(requirements)];
  }

  /**
   * Extract section content using regex
   */
  private extractSectionContent(text: string, sectionName: string): string | null {
    const sectionRegex = new RegExp(`(?:^|\\n)(?:${sectionName})(?:[:.-]|\\s*\\n)([\\s\\S]*?)(?=\\n(?:[A-Z][A-Z\\s]+[:.-]|$))`, 'i');
    const match = text.match(sectionRegex);
    return match ? match[1].trim() : null;
  }

  /**
   * Analyze the CV content and provide feedback
   * @returns Analysis of the CV content with strengths, weaknesses, and recommendations
   */
  public async analyzeContent(): Promise<{
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  }> {
    logger.info('Analyzing CV content');
    
    if (!this.originalCVText) {
      logger.warn('No CV text available for content analysis');
        return {
        strengths: ['Clear presentation'],
        weaknesses: ['Could not fully analyze the CV content'],
        recommendations: ['Add more specific achievements and quantifiable results']
      };
    }
    
    try {
      // First try to use Mistral for content analysis
      if (this.mistralClient) {
        return await retryWithExponentialBackoff(
          async () => {
            const prompt = `
            You are a CV content expert. Analyze the following CV and provide feedback on its content quality.
            
            CV Text:
            ${this.originalCVText.substring(0, 4000)} ${this.originalCVText.length > 4000 ? '...(truncated)' : ''}
            
            Analyze the CV CONTENT, NOT the format. Focus on the quality of information, achievements, skills presentation, and overall impact.
            
            Return ONLY a JSON object with the following structure:
            {
              "strengths": ["strength1", "strength2", ...],
              "weaknesses": ["weakness1", "weakness2", ...],
              "recommendations": ["recommendation1", "recommendation2", ...]
            }
            
            IMPORTANT: Return ONLY the raw JSON object. DO NOT use markdown formatting, code blocks, or any other formatting. DO NOT include any explanation or additional text before or after the JSON.
            `;
            
            if (!this.mistralClient) {
              throw new Error('Mistral client not initialized');
            }
            
            const response = await this.mistralClient.chat({
              model: this.mistralGenerationModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              maxTokens: 2000,
            });
            
            const content = response.choices[0]?.message?.content || '';
            
            try {
              // First try to find JSON in markdown code blocks
              const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
              let jsonContent = '';
              
              if (jsonMatch && jsonMatch[1]) {
                // Found JSON in code block
                jsonContent = jsonMatch[1].trim();
              } else {
                // Try to find JSON object directly
                const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
                if (jsonObjectMatch) {
                  jsonContent = jsonObjectMatch[0].trim();
                } else {
                  // Use the whole content as a last resort
                  jsonContent = content.trim();
                }
              }
              
              // Parse the JSON response
              const result = JSON.parse(jsonContent);
              
              // Validate the structure
              if (!result.strengths || !result.weaknesses || !result.recommendations) {
                logger.warn('Invalid CV content analysis structure, using regex extraction');
                return this.extractContentAnalysisWithRegex(content);
              }
              
              // Ensure arrays are arrays
              ['strengths', 'weaknesses', 'recommendations'].forEach(field => {
                if (!Array.isArray(result[field])) {
                  result[field] = result[field] ? [result[field]] : [];
                }
              });
              
              return result;
            } catch (parseError) {
              logger.error('Error parsing CV content analysis:', parseError instanceof Error ? parseError.message : String(parseError));
              logger.debug('Raw response:', content);
              
              // Try to extract with regex as fallback
              return this.extractContentAnalysisWithRegex(content);
            }
          },
          {
            service: 'mistral',
            initialDelayMs: 2000,
            maxDelayMs: 30000,
            maxRetries: 2,
            priority: 5,
            taskId: `analyze-cv-content-${Date.now()}`,
            fallbackFn: async () => {
              // Fallback to OpenAI if Mistral fails
              if (this.openaiClient) {
                return this.analyzeContentWithOpenAI();
              }
              return {
                strengths: ['Clear presentation'],
                weaknesses: ['Could not fully analyze the CV content'],
                recommendations: ['Add more specific achievements and quantifiable results']
              };
            }
          }
        );
      } else if (this.openaiClient) {
        // Use OpenAI if Mistral is not available
        return this.analyzeContentWithOpenAI();
      }
      
      // If no AI service is available, return default analysis
            return {
        strengths: ['Clear presentation'],
        weaknesses: ['Could not fully analyze the CV content'],
        recommendations: ['Add more specific achievements and quantifiable results']
      };
    } catch (error) {
      logger.error('Error analyzing CV content:', error instanceof Error ? error.message : String(error));
      return {
        strengths: ['Clear presentation'],
        weaknesses: ['Could not fully analyze the CV content'],
        recommendations: ['Add more specific achievements and quantifiable results']
      };
    }
  }
  
  /**
   * Analyze CV content using OpenAI
   */
  private async analyzeContentWithOpenAI(): Promise<{
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  }> {
    try {
      const prompt = `Analyze the following CV and provide:
1. Key strengths (what's good about the CV)
2. Weaknesses (what could be improved)
3. Recommendations for improvement

Format your response as:
STRENGTHS:
- Strength 1
- Strength 2

WEAKNESSES:
- Weakness 1
- Weakness 2

RECOMMENDATIONS:
- Recommendation 1
- Recommendation 2

CV Content:
${this.originalCVText.substring(0, 4000)}`;

      const response = await this.openaiClient.chat.completions.create(
        this.createApiParams({
          model: this.openaiGenerationModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          maxTokens: 1000,
        }, false)
      );
      
      const content = response.choices[0]?.message?.content?.trim() || '';
      return this.extractContentAnalysisWithRegex(content);
    } catch (error) {
      logger.error('Error analyzing content with OpenAI:', error instanceof Error ? error.message : String(error));
      return {
        strengths: [],
        weaknesses: [],
        recommendations: []
      };
    }
  }
  
  /**
   * Extract content analysis using regex as a fallback
   */
  private extractContentAnalysisWithRegex(content: string): {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    logger.info('Extracting CV content analysis with regex');
    
    const result = {
      strengths: [] as string[],
      weaknesses: [] as string[],
      recommendations: [] as string[]
    };
    
    // Extract strengths
    const strengthsMatch = content.match(/strengths["\s:]+\[(.*?)\]/is);
    if (strengthsMatch && strengthsMatch[1]) {
      result.strengths = this.extractArrayFromString(strengthsMatch[1]);
    }
    
    // Extract weaknesses
    const weaknessesMatch = content.match(/weaknesses["\s:]+\[(.*?)\]/is);
    if (weaknessesMatch && weaknessesMatch[1]) {
      result.weaknesses = this.extractArrayFromString(weaknessesMatch[1]);
    }
    
    // Extract recommendations
    const recommendationsMatch = content.match(/recommendations["\s:]+\[(.*?)\]/is);
    if (recommendationsMatch && recommendationsMatch[1]) {
      result.recommendations = this.extractArrayFromString(recommendationsMatch[1]);
    }
    
    // If we couldn't extract anything, provide default values
    if (result.strengths.length === 0) {
      result.strengths = ['Clear presentation'];
    }
    
    if (result.weaknesses.length === 0) {
      result.weaknesses = ['Could not fully analyze the CV content'];
    }
    
    if (result.recommendations.length === 0) {
      result.recommendations = ['Add more specific achievements and quantifiable results'];
    }
    
    return result;
  }

  /**
   * Analyzes the CV content to determine the most relevant industry
   * Uses the originalCVText if available
   * @returns A string representing the determined industry
   */
  public async determineIndustry(): Promise<string> {
    logger.info('Determining industry from CV content');
    
    if (!this.originalCVText) {
      logger.warn('No CV text available for industry determination');
        return 'General';
      }

    try {
      const textToAnalyze = this.originalCVText;
      
      // Try with Mistral first
      try {
        logger.info('Attempting to determine industry using Mistral');
        if (!this.mistralClient) {
          throw new Error('Mistral client not initialized');
        }
        
        const prompt = `
        Analyze the following CV/resume and determine the most relevant industry sector for this professional.
        Choose from common industry sectors like: Technology, Healthcare, Finance, Education, Marketing, 
        Engineering, Legal, Retail, Manufacturing, Hospitality, Construction, Media, etc.
        Return ONLY the industry name as a single string with no additional text, quotes, or formatting.
        
        CV Content:
        ${textToAnalyze.substring(0, 4000)}
        `;
        
        const response = await this.mistralClient.chat({
          model: this.mistralGenerationModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          maxTokens: 50,
        });
        
        return response.choices[0]?.message?.content?.trim() || 'General';
      } catch (error) {
        logger.warn(`Failed to determine industry with Mistral: ${error instanceof Error ? error.message : String(error)}`);
        return this.determineIndustryWithOpenAI(textToAnalyze);
      }
      } catch (error) {
        logger.error(`Error determining industry: ${error instanceof Error ? error.message : String(error)}`);
        return 'General';
      }
  }
  
  /**
   * Fallback method to determine industry using OpenAI
   * @param cvText The CV text to analyze
   * @returns A string representing the determined industry
   */
  private async determineIndustryWithOpenAI(cvText: string): Promise<string> {
    try {
      const prompt = `Determine the industry that this CV is most relevant for. Consider the skills, experience, and education mentioned. Return only the industry name, nothing else.

CV Content:
${cvText.substring(0, 4000)}`;

      const response = await this.openaiClient.chat.completions.create(
        this.createApiParams({
          model: this.openaiGenerationModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          maxTokens: 50,
        }, false) // false indicates this is for OpenAI
      );
      
      const industry = response.choices[0]?.message?.content?.trim() || 'General';
      logger.info(`Determined industry using OpenAI: ${industry}`);
      return industry;
    } catch (error) {
      logger.error('Error determining industry with OpenAI:', error instanceof Error ? error.message : String(error));
      return 'General';
    }
  }

  /**
   * Detects the language of the CV content
   * Uses the originalCVText if available
   * @returns A string representing the detected language
   */
  public async detectLanguage(): Promise<string> {
    logger.info('Detecting language from CV content');
    
    if (!this.originalCVText) {
      logger.warn('No CV text available for language detection');
        return 'English';
      }

    try {
      const textToAnalyze = this.originalCVText;
      
      // Try with Mistral first
      try {
        logger.info('Attempting to detect language using Mistral');
        if (!this.mistralClient) {
          throw new Error('Mistral client not initialized');
        }
        
        const prompt = `
        Analyze the following CV/resume and determine the primary language it is written in.
        Return ONLY the language name in English (e.g., "English", "French", "German", "Spanish", etc.) 
        with no additional text, quotes, or formatting.
        
        CV Content:
        ${textToAnalyze.substring(0, 4000)}
        `;
        
        const response = await this.mistralClient.chat({
          model: this.mistralGenerationModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          maxTokens: 50,
        });
        
        // Clean up the response to ensure it's just the language name
        const language = response.choices[0]?.message?.content?.trim() || 'English';
        logger.info(`Detected language using Mistral: ${language}`);
        return language;
      } catch (error) {
        logger.warn(`Failed to detect language with Mistral: ${error instanceof Error ? error.message : String(error)}`);
        return this.detectLanguageWithOpenAI(textToAnalyze);
      }
    } catch (error) {
      logger.error(`Error detecting language: ${error instanceof Error ? error.message : String(error)}`);
      return 'English';
    }
  }

  /**
   * Fallback method to detect language using OpenAI
   * @param cvText The CV text to analyze
   * @returns A string representing the detected language
   */
  private async detectLanguageWithOpenAI(cvText: string): Promise<string> {
    try {
      const prompt = `Detect the language of the following CV text. Return only the language name in English, nothing else.

CV Content:
${cvText.substring(0, 2000)}`;

      const response = await this.openaiClient.chat.completions.create(
        this.createApiParams({
          model: this.openaiGenerationModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          maxTokens: 50,
        }, false) // false indicates this is for OpenAI
      );
      
      const language = response.choices[0]?.message?.content?.trim() || 'English';
      logger.info(`Detected language using OpenAI: ${language}`);
      return language;
    } catch (error) {
      logger.error('Error detecting language with OpenAI:', error instanceof Error ? error.message : String(error));
      return 'English';
    }
  }

  /**
   * Extracts sections from the CV content
   * Uses the originalCVText if available
   * @returns An array of sections with name and content
   */
  public async extractSections(): Promise<Array<{ name: string; content: string }>> {
    logger.info('Extracting sections from CV content');
    
    if (!this.originalCVText) {
      logger.warn('No CV text available for section extraction');
      return [];
    }
    
    try {
      const textToAnalyze = this.originalCVText;
      
      // Try with Mistral first
      try {
        logger.info('Attempting to extract sections using Mistral');
        if (!this.mistralClient) {
          throw new Error('Mistral client not initialized');
        }
        
        const prompt = `
        Analyze the following CV/resume and extract all distinct sections.
        For each section, provide the section name and its content.
        Common CV sections include: Summary/Profile, Experience, Education, Skills, Certifications, Languages, etc.
        
        Return the result as a JSON array of objects, each with "name" and "content" properties.
        Example format:
        [
          {
            "name": "Summary",
            "content": "Experienced software engineer with 5 years..."
          },
          {
            "name": "Experience",
            "content": "Senior Developer, ABC Corp (2018-2022)..."
          }
        ]
        
        IMPORTANT: Return ONLY the raw JSON array. DO NOT use markdown formatting, code blocks, or any other formatting. DO NOT include any explanation or additional text before or after the JSON.
        
        CV Content:
        ${textToAnalyze}
        `;
        
        if (!this.mistralClient) {
          throw new Error('Mistral client not initialized');
        }
        
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Mistral API timeout')), 15000); // 15 second timeout
        });
        
        // Create the API call promise
        const apiCallPromise = this.mistralClient.chat({
          model: this.mistralGenerationModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          maxTokens: 4000,
        });
        
        // Race the API call against the timeout
        const response = await Promise.race([apiCallPromise, timeoutPromise])
          .catch(error => {
            logger.warn(`Mistral API call failed or timed out: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error('Mistral API unavailable');
          });
        
        // If we get here, the API call succeeded
        if (!response || !response.choices || !response.choices[0]?.message?.content) {
          logger.warn('Mistral API returned empty or invalid response');
          throw new Error('Invalid Mistral API response');
        }
        
        const responseText = response.choices[0].message.content.trim() || '[]';
        
        try {
          // Try to parse as JSON directly
          const cleanedJson = responseText.replace(/```json|```/g, '').trim();
          const sections = JSON.parse(cleanedJson) as Array<{ name: string; content: string }>;
          logger.info(`Extracted ${sections.length} sections using Mistral`);
          return sections;
        } catch (parseError) {
          logger.warn(`Failed to parse Mistral response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          logger.debug(`Raw response: ${responseText.substring(0, 200)}...`);
          // Try to extract using regex as fallback
          return this.extractSectionsWithRegex(textToAnalyze);
        }
      } catch (error) {
        logger.warn(`Failed to extract sections with Mistral: ${error instanceof Error ? error.message : String(error)}`);
        // Try OpenAI as fallback
        try {
          return await this.extractSectionsWithOpenAI(textToAnalyze);
        } catch (openaiError) {
          logger.warn(`OpenAI fallback also failed: ${openaiError instanceof Error ? openaiError.message : String(openaiError)}`);
          // If both API methods fail, fall back to regex
          return this.extractSectionsWithRegex(textToAnalyze);
        }
      }
    } catch (error) {
      logger.error(`Error extracting sections: ${error instanceof Error ? error.message : String(error)}`);
      // Final fallback - return a single section with all content
      return [{ name: 'Content', content: this.originalCVText || '' }];
    }
  }

  /**
   * Fallback method to extract sections using OpenAI
   * @param cvText The CV text to analyze
   * @returns An array of sections with name and content
   */
  private async extractSectionsWithOpenAI(cvText: string): Promise<Array<{ name: string; content: string }>> {
    try {
      const prompt = `Extract the main sections from the following CV. For each section, provide the section name and its content.

Format your response as:
SECTION: [Section Name 1]
CONTENT: [Section Content 1]

SECTION: [Section Name 2]
CONTENT: [Section Content 2]

CV Content:
${cvText.substring(0, 4000)}`;

      const response = await this.openaiClient.chat.completions.create(
        this.createApiParams({
          model: this.openaiGenerationModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          maxTokens: 4000,
        }, false)
      );
      
      const content = response.choices[0]?.message?.content?.trim() || '';
      
      // Parse the response to extract sections
      const sections: Array<{ name: string; content: string }> = [];
      const sectionRegex = /SECTION:\s*(.+?)\s*\nCONTENT:\s*([\s\S]+?)(?=\n\s*SECTION:|$)/g;
      
      let match;
      while ((match = sectionRegex.exec(content)) !== null) {
        const name = match[1].trim();
        const sectionContent = match[2].trim();
        
        if (name && sectionContent) {
          sections.push({ name, content: sectionContent });
        }
      }
      
      return sections;
    } catch (error) {
      logger.error('Error extracting sections with OpenAI:', error instanceof Error ? error.message : String(error));
      return this.extractSectionsWithRegex(cvText);
    }
  }
  
  /**
   * Fallback method to extract sections using regex patterns
   * @param cvText The CV text to analyze
   * @returns An array of sections with name and content
   */
  private extractSectionsWithRegex(cvText: string): Array<{ name: string; content: string }> {
    logger.info('Extracting sections using regex patterns');
    
    const sections: Array<{ name: string; content: string }> = [];
    const commonSectionNames = [
      'Summary', 'Profile', 'Objective', 'Professional Summary',
      'Experience', 'Work Experience', 'Employment History', 'Professional Experience',
      'Education', 'Academic Background', 'Qualifications',
      'Skills', 'Technical Skills', 'Core Competencies', 'Key Skills',
      'Certifications', 'Certificates', 'Professional Certifications',
      'Languages', 'Language Proficiency',
      'Projects', 'Key Projects', 'Professional Projects',
      'Achievements', 'Accomplishments', 'Awards',
      'Publications', 'Research', 'Patents',
      'Volunteer Experience', 'Community Service',
      'References', 'Professional References'
    ];
    
    // Create a regex pattern to find sections
    const sectionPattern = new RegExp(
      `(^|\\n)(${commonSectionNames.join('|')})[:\\s]*\\n+([\\s\\S]+?)(?=\\n(?:${commonSectionNames.join('|')})[:\\s]*\\n+|$)`,
      'gi'
    );
    
    let match;
    while ((match = sectionPattern.exec(cvText)) !== null) {
      const sectionName = match[2].trim();
      const sectionContent = match[3].trim();
      
      if (sectionName && sectionContent) {
        sections.push({
          name: sectionName,
          content: sectionContent
        });
      }
    }
    
    // If no sections found, try a simpler approach - split by common section headers
    if (sections.length === 0) {
      const lines = cvText.split('\n');
      let currentSection = '';
      let currentContent = '';
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Check if this line could be a section header
        const isSectionHeader = commonSectionNames.some(name => 
          trimmedLine.toLowerCase() === name.toLowerCase() || 
          trimmedLine.toLowerCase() === `${name.toLowerCase()}:` ||
          trimmedLine.toLowerCase() === `${name.toLowerCase()}.`
        );
        
        if (isSectionHeader) {
          // Save previous section if it exists
          if (currentSection && currentContent) {
            sections.push({
              name: currentSection,
              content: currentContent.trim()
            });
          }
          
          // Start new section
          currentSection = trimmedLine.replace(/[:.]$/, '').trim();
          currentContent = '';
        } else if (currentSection) {
          // Add to current section content
          currentContent += line + '\n';
        }
      }
      
      // Add the last section
      if (currentSection && currentContent) {
        sections.push({
          name: currentSection,
          content: currentContent.trim()
        });
      }
    }
    
    logger.info(`Extracted ${sections.length} sections using regex`);
    return sections;
  }

  /**
   * Helper function to create consistent parameters for API calls
   * @param params Base parameters
   * @param forMistral Whether the parameters are for Mistral API
   * @returns Parameters with correct naming conventions
   */
  private createApiParams(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }, forMistral: boolean): any {
    // Clone the params to avoid modifying the original
    const result: any = { ...params };
    
    // Handle the maxTokens/max_tokens difference
    if ('maxTokens' in result) {
      if (!forMistral) {
        // For OpenAI, convert maxTokens to max_tokens
        result.max_tokens = result.maxTokens;
        delete result.maxTokens;
      }
      // For Mistral, keep maxTokens as is
    }
    
    return result;
  }
} 
