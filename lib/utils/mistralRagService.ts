import { logger } from '@/lib/utils/logger';
import OpenAI from 'openai';
import { Mistral } from "@mistralai/mistralai";

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
  constructor() {
    try {
      // Try to initialize Mistral client if API key is available
      const mistralApiKey = process.env.MISTRAL_API_KEY;
      if (mistralApiKey) {
        try {
          this.mistralClient = new Mistral({
            apiKey: mistralApiKey,
          });
          this.useMistral = true;
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
      
      logger.info('MistralRAG service initialized successfully');
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
          await this.mistralClient.chat.complete({
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
    try {
      // Check cache first
      const cacheKey = `${this.embeddingModel}:${text.substring(0, 100)}`;
      const now = Date.now();
      
      // Return cached embedding if available and not expired
      if (this.embeddingCache[cacheKey] && 
          now - this.embeddingCache[cacheKey].timestamp < this.cacheTTL) {
        return this.embeddingCache[cacheKey].embedding;
      }
      
      // Create embedding using OpenAI API
      const response = await this.openaiClient.embeddings.create({
        model: this.embeddingModel,
        input: text
      });
      
      // Ensure we have a valid embedding
      if (!response.data || !response.data[0] || !response.data[0].embedding) {
        throw new Error('Failed to generate embedding: Invalid response format');
      }
      
      const embedding = response.data[0].embedding;
      
      // Cache the embedding
      this.embeddingCache[cacheKey] = {
        embedding,
        timestamp: now
      };
      
      return embedding;
    } catch (error) {
      // Fix error type handling for logger
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error creating embedding: ${errorMessage}`);
      throw error;
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
      // Get relevant chunks for the query
      const chunks = await this.retrieveRelevantChunks(query);
      
      // If no chunks are found, fall back to direct response
      if (chunks.length === 0) {
        logger.warn('No relevant chunks found for query, falling back to direct response');
        return this.generateDirectResponse(query, typeof useSystemPrompt === 'string' ? useSystemPrompt : undefined);
      }
      
      // Combine chunks into context
      const context = chunks.join('\n\n');
      
      // Determine the system prompt
      let systemPromptText = 'You are a helpful assistant that answers questions based on the provided CV information.';
      if (typeof useSystemPrompt === 'string') {
        systemPromptText = useSystemPrompt;
      }
      
      // Generate response with context using OpenAI
      const response = await this.openaiClient.chat.completions.create({
        model: this.openaiGenerationModel,
        messages: [
          {
            role: 'system',
            content: systemPromptText
          },
          {
            role: 'user',
            content: `Use the following CV information to respond to the query:\n\n${context}\n\nQuery: ${query}`
          }
        ]
      });
      
      return response.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      logger.error(`Error generating response: ${error instanceof Error ? error.message : String(error)}`);
      return 'Error generating response. Please try again.';
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
      if (this.useMistral && this.mistralClient) {
        // Use Mistral API
        try {
          logger.info(`Generating response using Mistral model: ${this.mistralGenerationModel}`);
          const response = await this.mistralClient.chat.complete({
            model: this.mistralGenerationModel,
            messages: [
              {
                role: 'system',
                content: systemPrompt || 'You are a helpful assistant.'
              },
              {
                role: 'user',
                content: query
              }
            ]
          });
          
          if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
            throw new Error('Invalid response format from Mistral API');
          }
          
          // Handle Mistral response format
          const content = response.choices[0].message.content;
          if (typeof content === 'string') {
            return content;
          } else if (Array.isArray(content)) {
            // Handle content chunks if returned as an array
            return content.map(chunk => {
              if (typeof chunk === 'string') {
                return chunk;
              } else if (chunk && typeof chunk === 'object') {
                // Handle different types of content chunks
                if ('type' in chunk && chunk.type === 'text' && 'text' in chunk) {
                  return chunk.text as string;
                }
                // For other chunk types, return empty string
                return '';
              }
              return '';
            }).join('');
          }
          
          return '';
        } catch (mistralError) {
          // If Mistral fails, fall back to OpenAI
          logger.warn(`Mistral API error, falling back to OpenAI: ${mistralError instanceof Error ? mistralError.message : String(mistralError)}`);
          this.useMistral = false;
        }
      }
      
      // Use OpenAI API (either as primary or fallback)
      logger.info(`Generating response using OpenAI model: ${this.openaiGenerationModel}`);
      const response = await this.openaiClient.chat.completions.create({
        model: this.openaiGenerationModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt || 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: query
          }
        ]
      });
      
      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        throw new Error('Invalid response format from OpenAI API');
      }
      
      return response.choices[0].message.content || '';
    } catch (error) {
      // Fix error type handling for logger
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error generating direct response: ${errorMessage}`);
      return 'Unable to generate a response at this time.';
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
   * Analyze CV format and provide strengths, weaknesses, and recommendations
   * @returns Format analysis results
   */
  public async analyzeCVFormat(): Promise<{ strengths: string[], weaknesses: string[], recommendations: string[] }> {
    try {
      logger.info('Analyzing CV format with RAG service');
      
      // Initialize with default values to ensure we always have something to return
      const defaultResult = {
        strengths: ['Clear section organization', 'Consistent formatting', 'Professional layout'],
        weaknesses: ['Could improve visual hierarchy', 'Consider adding more white space', 'Ensure consistent alignment'],
        recommendations: ['Use bullet points for achievements', 'Add more white space between sections', 'Ensure consistent date formatting']
      };
      
      // If no chunks are available, return default values
      if (!this.chunks || this.chunks.length === 0) {
        logger.warn('No chunks available for CV format analysis, returning default values');
        return defaultResult;
      }
      
      // Get relevant chunks for format analysis
      const query = 'CV format, layout, structure, organization, visual presentation';
      const relevantChunks = await this.retrieveRelevantChunks(query, 3);
      
      if (relevantChunks.length === 0) {
        logger.warn('No relevant chunks found for CV format analysis, returning default values');
        return defaultResult;
      }
      
      // Prepare the prompt for format analysis
      const prompt = `
        Analyze the format and layout of this CV/resume. Focus on the visual structure, organization, and presentation.
        
        CV content:
        ${relevantChunks.join('\n\n')}
        
        Provide a detailed analysis with:
        1. Three specific format strengths
        2. Three specific format weaknesses
        3. Three specific recommendations for improving the format
        
        Return your analysis as a JSON object with these keys:
        - strengths: array of 3 format strengths
        - weaknesses: array of 3 format weaknesses
        - recommendations: array of 3 format recommendations
      `;
      
      // Generate the analysis
      const response = await this.generateResponse(prompt, true);
      
      // Parse the response
      let result;
      try {
        // Try to parse as JSON first
        result = JSON.parse(response);
        
        // Validate the result structure
        if (!result.strengths || !result.weaknesses || !result.recommendations) {
          throw new Error('Invalid response format');
        }
        
        // Ensure arrays have at least 3 items
        if (result.strengths.length < 3 || result.weaknesses.length < 3 || result.recommendations.length < 3) {
          logger.warn('Format analysis results have fewer than 3 items in some categories, adding default values');
          
          // Merge with default values, prioritizing the new results
          result.strengths = [...result.strengths, ...defaultResult.strengths].slice(0, 3);
          result.weaknesses = [...result.weaknesses, ...defaultResult.weaknesses].slice(0, 3);
          result.recommendations = [...result.recommendations, ...defaultResult.recommendations].slice(0, 3);
        }
        
        // Remove duplicates
        result.strengths = [...new Set(result.strengths)];
        result.weaknesses = [...new Set(result.weaknesses)];
        result.recommendations = [...new Set(result.recommendations)];
        
        return result;
      } catch (parseError) {
        logger.error(`Error parsing CV format analysis response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        
        // Try to extract information using regex if JSON parsing fails
        const strengthsMatch = response.match(/strengths:?\s*\[(.*?)\]/s);
        const weaknessesMatch = response.match(/weaknesses:?\s*\[(.*?)\]/s);
        const recommendationsMatch = response.match(/recommendations:?\s*\[(.*?)\]/s);
        
        const extractedResult = {
          strengths: strengthsMatch ? this.parseArrayItems(strengthsMatch[1]) : [],
          weaknesses: weaknessesMatch ? this.parseArrayItems(weaknessesMatch[1]) : [],
          recommendations: recommendationsMatch ? this.parseArrayItems(recommendationsMatch[1]) : []
        };
        
        // Merge with default values if extraction failed or is incomplete
        if (extractedResult.strengths.length === 0) extractedResult.strengths = defaultResult.strengths;
        if (extractedResult.weaknesses.length === 0) extractedResult.weaknesses = defaultResult.weaknesses;
        if (extractedResult.recommendations.length === 0) extractedResult.recommendations = defaultResult.recommendations;
        
        // Ensure arrays have at least 3 items
        if (extractedResult.strengths.length < 3) {
          extractedResult.strengths = [...extractedResult.strengths, ...defaultResult.strengths].slice(0, 3);
        }
        if (extractedResult.weaknesses.length < 3) {
          extractedResult.weaknesses = [...extractedResult.weaknesses, ...defaultResult.weaknesses].slice(0, 3);
        }
        if (extractedResult.recommendations.length < 3) {
          extractedResult.recommendations = [...extractedResult.recommendations, ...defaultResult.recommendations].slice(0, 3);
        }
        
        // Remove duplicates
        extractedResult.strengths = [...new Set(extractedResult.strengths)];
        extractedResult.weaknesses = [...new Set(extractedResult.weaknesses)];
        extractedResult.recommendations = [...new Set(extractedResult.recommendations)];
        
        return extractedResult;
      }
    } catch (error) {
      logger.error(`Error analyzing CV format: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return default values on error
      return {
        strengths: ['Clear section organization', 'Consistent formatting', 'Professional layout'],
        weaknesses: ['Could improve visual hierarchy', 'Consider adding more white space', 'Ensure consistent alignment'],
        recommendations: ['Use bullet points for achievements', 'Add more white space between sections', 'Ensure consistent date formatting']
      };
    }
  }

  /**
   * Extract keywords from the CV
   * @returns Array of keywords
   */
  public async extractKeywords(): Promise<string[]> {
    try {
      logger.info('Extracting keywords from CV with RAG service');
      
      // Default keywords to ensure we always have something to return
      const defaultKeywords = [
        'Professional Experience',
        'Skills',
        'Education',
        'Communication',
        'Problem Solving',
        'Teamwork',
        'Leadership',
        'Project Management',
        'Time Management',
        'Analytical Skills'
      ];
      
      // If no chunks are available, return default keywords
      if (!this.chunks || this.chunks.length === 0) {
        logger.warn('No chunks available for keyword extraction, returning default keywords');
        return defaultKeywords;
      }
      
      // Get relevant chunks for keyword extraction
      const query = 'important keywords skills experience qualifications';
      const relevantChunks = await this.retrieveRelevantChunks(query, 3);
      
      if (relevantChunks.length === 0) {
        logger.warn('No relevant chunks found for keyword extraction, returning default keywords');
        return defaultKeywords;
      }
      
      // Prepare the prompt for keyword extraction
      const prompt = `
        Extract the most important keywords from this CV/resume that would be relevant for ATS (Applicant Tracking Systems).
        Focus on skills, qualifications, technologies, and industry-specific terms.
        
        CV content:
        ${relevantChunks.join('\n\n')}
        
        Return ONLY a JSON array of 10-15 keywords, with each keyword being a string.
        Example: ["JavaScript", "Project Management", "Data Analysis"]
      `;
      
      // Generate the response
      const response = await this.generateResponse(prompt, true);
      
      // Parse the response
      try {
        // Try to parse as JSON first
        let keywords = JSON.parse(response);
        
        // Ensure it's an array
        if (!Array.isArray(keywords)) {
          throw new Error('Response is not an array');
        }
        
        // Filter out non-string items and empty strings
        keywords = keywords.filter(keyword => typeof keyword === 'string' && keyword.trim() !== '');
        
        // Format keywords (capitalize first letter of each word)
        keywords = keywords.map((keyword: string) => 
          keyword.split(' ')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
        );
        
        // Combine with default keywords if we don't have enough
        if (keywords.length < 5) {
          keywords = [...keywords, ...defaultKeywords];
        }
        
        // Remove duplicates
        keywords = [...new Set(keywords)];
        
        // Limit to 15 keywords
        return keywords.slice(0, 15);
      } catch (parseError) {
        logger.error(`Error parsing keyword extraction response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        
        // Try to extract keywords using regex if JSON parsing fails
        const keywordMatches = response.match(/"([^"]+)"/g);
        if (keywordMatches && keywordMatches.length > 0) {
          // Remove quotes and filter empty strings
          let extractedKeywords = keywordMatches
            .map(match => match.replace(/"/g, '').trim())
            .filter(keyword => keyword !== '');
          
          // Format keywords
          extractedKeywords = extractedKeywords.map((keyword: string) => 
            keyword.split(' ')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ')
          );
          
          // Combine with default keywords if we don't have enough
          if (extractedKeywords.length < 5) {
            extractedKeywords = [...extractedKeywords, ...defaultKeywords];
          }
          
          // Remove duplicates
          extractedKeywords = [...new Set(extractedKeywords)];
          
          // Limit to 15 keywords
          return extractedKeywords.slice(0, 15);
        }
        
        // Return default keywords if extraction failed
        return defaultKeywords;
      }
    } catch (error) {
      logger.error(`Error extracting keywords: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return default keywords on error
      return [
        'Professional Experience',
        'Skills',
        'Education',
        'Communication',
        'Problem Solving',
        'Teamwork',
        'Leadership',
        'Project Management',
        'Time Management',
        'Analytical Skills'
      ];
    }
  }

  /**
   * Extract key requirements from the CV
   * @returns Array of key requirements
   */
  public async extractKeyRequirements(): Promise<string[]> {
    try {
      logger.info('Extracting key requirements from CV with RAG service');
      
      // Default key requirements to ensure we always have something to return
      const defaultRequirements = [
        'Professional experience',
        'Relevant education',
        'Technical skills',
        'Communication skills',
        'Problem-solving abilities'
      ];
      
      // If no chunks are available, return default requirements
      if (!this.chunks || this.chunks.length === 0) {
        logger.warn('No chunks available for key requirements extraction, returning default requirements');
        return defaultRequirements;
      }
      
      // Get relevant chunks for requirements extraction
      const query = 'key requirements qualifications experience skills';
      const relevantChunks = await this.retrieveRelevantChunks(query, 3);
      
      if (relevantChunks.length === 0) {
        logger.warn('No relevant chunks found for key requirements extraction, returning default requirements');
        return defaultRequirements;
      }
      
      // Prepare the prompt for requirements extraction
      const prompt = `
        Extract the key requirements or qualifications from this CV/resume.
        Focus on the most important skills, experiences, and qualifications that the person has.
        
        CV content:
        ${relevantChunks.join('\n\n')}
        
        Return ONLY a JSON array of 5-7 key requirements, with each requirement being a string.
        Example: ["5+ years of software development experience", "Bachelor's degree in Computer Science", "Strong communication skills"]
      `;
      
      // Generate the response
      const response = await this.generateResponse(prompt, true);
      
      // Parse the response
      try {
        // Try to parse as JSON first
        let requirements = JSON.parse(response);
        
        // Ensure it's an array
        if (!Array.isArray(requirements)) {
          throw new Error('Response is not an array');
        }
        
        // Filter out non-string items and empty strings
        requirements = requirements.filter(req => typeof req === 'string' && req.trim() !== '');
        
        // Combine with default requirements if we don't have enough
        if (requirements.length < 3) {
          requirements = [...requirements, ...defaultRequirements];
        }
        
        // Remove duplicates
        requirements = [...new Set(requirements)];
        
        // Limit to 7 requirements
        return requirements.slice(0, 7);
      } catch (parseError) {
        logger.error(`Error parsing key requirements extraction response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        
        // Try to extract requirements using regex if JSON parsing fails
        const reqMatches = response.match(/"([^"]+)"/g);
        if (reqMatches && reqMatches.length > 0) {
          // Remove quotes and filter empty strings
          let extractedRequirements = reqMatches
            .map(match => match.replace(/"/g, '').trim())
            .filter(req => req !== '');
          
          // Combine with default requirements if we don't have enough
          if (extractedRequirements.length < 3) {
            extractedRequirements = [...extractedRequirements, ...defaultRequirements];
          }
          
          // Remove duplicates
          extractedRequirements = [...new Set(extractedRequirements)];
          
          // Limit to 7 requirements
          return extractedRequirements.slice(0, 7);
        }
        
        // Return default requirements if extraction failed
        return defaultRequirements;
      }
    } catch (error) {
      logger.error(`Error extracting key requirements: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return default requirements on error
      return [
        'Professional experience',
        'Relevant education',
        'Technical skills',
        'Communication skills',
        'Problem-solving abilities'
      ];
    }
  }

  /**
   * Helper method to parse array items from a string
   * @param arrayString String containing array items
   * @returns Array of strings
   */
  private parseArrayItems(arrayString: string): string[] {
    // Remove quotes and split by comma
    const items = arrayString.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map(item => item.trim().replace(/^["']|["']$/g, ''))
      .filter(item => item !== '');
    
    return items;
  }

  /**
   * Extracts industry-specific skills from a CV based on the identified industry
   * @param industry The industry for which to extract skills
   * @returns Array of industry-specific skills
   */
  public async getIndustrySkills(industry: string): Promise<string[]> {
    if (!industry || industry === "General") {
      return [];
    }
    
    const query = `Extract the most relevant skills specifically for the ${industry} industry from this CV.`;
    
    const systemPrompt = `You are a CV skill extractor specialized in the ${industry} industry.
Extract only skills that are highly relevant to the ${industry} industry.
Format your response as a simple list of skills, one per line. Do not include explanations.
Focus on technical and specialized skills, not soft skills.`;
    
    const skillsText = await this.generateResponse(query, systemPrompt);
    
    // Parse the skills into an array
    const skills = this.parseBulletPoints(skillsText);
    
    // Clean up and filter
    return skills
      .map(skill => skill.trim())
      .filter(skill => skill.length > 2)
      .slice(0, 15); // Limit to top 15 industry skills
  }

  /**
   * Extract keyword analysis from the CV
   * @param industry Optional industry to focus the keyword analysis
   * @returns Object with keyword analysis
   */
  public async extractKeywordAnalysis(industry?: string): Promise<{[key: string]: number}> {
    let query = 'Analyze the CV for important keywords and their frequency or importance.';
    
    if (industry) {
      query = `Analyze the CV for important keywords related to the ${industry} industry and their frequency or importance.`;
    }
    
    const systemPrompt = 'You are a CV keyword analyzer. Extract important keywords and assign them a relevance score from 1-10 based on their importance and frequency in the CV.';
    
    const analysisText = await this.generateResponse(query, systemPrompt);
    
    // Parse the keyword analysis
    const keywordAnalysis: {[key: string]: number} = {};
    
    // Try to detect if the output is in a structured format
    const keywordLines = analysisText.split('\n');
    
    for (const line of keywordLines) {
      // Try to match patterns like "keyword: 8" or "keyword - 8" or "keyword (8)"
      const match = line.match(/([^:(-]+)(?::|-)?\s*\(?(\d+)(?:\/\d+)?\)?/);
      
      if (match) {
        const keyword = match[1].trim();
        const score = parseInt(match[2], 10);
        
        if (keyword && !isNaN(score)) {
          keywordAnalysis[keyword] = score;
        }
      }
    }
    
    // If we couldn't parse structured output, extract keywords and assign default scores
    if (Object.keys(keywordAnalysis).length === 0) {
      // Find words that look like keywords (could be improved with NLP)
      const words = analysisText.match(/\b[A-Za-z][A-Za-z0-9\s]*[A-Za-z0-9]\b/g) || [];
      
      // Filter to likely keywords (longer than 3 letters, not common words)
      const commonWords = new Set(['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but']);
      const potentialKeywords = words
        .filter(word => word.length > 3 && !commonWords.has(word.toLowerCase()))
        .slice(0, 10); // Limit to top 10
      
      // Assign default scores
      potentialKeywords.forEach((keyword, index) => {
        // Score from 8 (most important) to 5 (least important)
        keywordAnalysis[keyword] = Math.max(5, 8 - Math.floor(index / 3));
      });
    }
    
    return keywordAnalysis;
  }

  /**
   * Analyze the content of the CV for strengths, weaknesses, and recommendations
   * @returns Object containing content strengths, weaknesses, and recommendations
   */
  public async analyzeContent(): Promise<{
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  }> {
    try {
      // Ensure we have chunks to analyze
      if (this.chunks.length === 0) {
        logger.warn('No chunks available for CV content analysis, using defaults');
        return {
          strengths: this.getDefaultContentStrengths(),
          weaknesses: this.getDefaultContentWeaknesses(),
          recommendations: this.getDefaultContentRecommendations()
        };
      }

      const query = 'Analyze the content of this CV/resume document in detail. Focus on the quality of the content, not the format.';
      
      const systemPrompt = `You are a professional CV/resume content analyzer. Your task is to analyze ONLY the content of the CV (not the format).

Review the document for these content aspects:
1. Quality of experience descriptions
2. Achievement focus and quantifiable results
3. Relevance and specificity of skills
4. Clarity and impact of professional summary
5. Overall content effectiveness for job applications

Provide your analysis in JSON format with these three arrays:
1. "strengths": List specific content strengths (minimum 3)
2. "weaknesses": List specific content issues (minimum 3)
3. "recommendations": Provide actionable recommendations to improve the content (minimum 3)

Example response format:
{
  "strengths": ["Strong achievement focus in experience section", "Clear demonstration of technical skills", "Effective use of action verbs"],
  "weaknesses": ["Lack of quantifiable results", "Generic skill descriptions", "Missing targeted professional summary"],
  "recommendations": ["Add metrics and numbers to achievements", "Tailor skills to specific job targets", "Create a compelling professional summary"]
}

Keep your analysis focused only on the document's content, not its format or layout.`;
      
      // Generate content analysis using all CV chunks
      // Limit context to avoid token limits
      const context = this.chunks.slice(0, 10).join('\n\n');
      
      // First try to get a structured JSON response
      try {
        logger.info('Attempting CV content analysis with JSON response');
        const analysisText = await this.generateDirectResponse(
          `${query}\n\nDocument to analyze:\n${context}`, 
          systemPrompt
        );
        
        // Try to parse as JSON
        try {
          // First, try to extract JSON if it's embedded in other text
          const jsonMatch = analysisText.match(/\{[\s\S]*?\}/);
          const jsonString = jsonMatch ? jsonMatch[0] : analysisText;
          
          const jsonResponse = JSON.parse(jsonString);
          
          // Validate the JSON structure
          if (jsonResponse.strengths && 
              jsonResponse.weaknesses && 
              jsonResponse.recommendations &&
              Array.isArray(jsonResponse.strengths) &&
              Array.isArray(jsonResponse.weaknesses) &&
              Array.isArray(jsonResponse.recommendations)) {
            
            // Ensure we have at least 3 items in each category
            const strengths = jsonResponse.strengths.length >= 3 ? 
              jsonResponse.strengths : 
              [...jsonResponse.strengths, ...this.getDefaultContentStrengths()].slice(0, 5);
              
            const weaknesses = jsonResponse.weaknesses.length >= 3 ? 
              jsonResponse.weaknesses : 
              [...jsonResponse.weaknesses, ...this.getDefaultContentWeaknesses()].slice(0, 5);
              
            const recommendations = jsonResponse.recommendations.length >= 3 ? 
              jsonResponse.recommendations : 
              [...jsonResponse.recommendations, ...this.getDefaultContentRecommendations()].slice(0, 5);
            
            logger.info(`Successfully parsed CV content analysis as JSON: ${strengths.length} strengths, ${weaknesses.length} weaknesses, ${recommendations.length} recommendations`);
            
            return {
              strengths,
              weaknesses,
              recommendations
            };
          } else {
            logger.warn('JSON response missing required arrays, falling back to text parsing');
            throw new Error('Invalid JSON structure');
          }
        } catch (jsonError) {
          // If JSON parsing fails, try to parse the text
          logger.warn(`Failed to parse content analysis as JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
          
          // Parse the analysis text to extract strengths, weaknesses, and recommendations
          const sections = this.parseAnalysisSections(analysisText);
          
          // Ensure we have at least some items in each category
          const strengths = sections.strengths.length > 0 ? 
            sections.strengths : this.getDefaultContentStrengths();
          
          const weaknesses = sections.weaknesses.length > 0 ? 
            sections.weaknesses : this.getDefaultContentWeaknesses();
          
          const recommendations = sections.recommendations.length > 0 ? 
            sections.recommendations : this.getDefaultContentRecommendations();
          
          // Log the results
          logger.info(`CV content analysis complete (text parsing): ${strengths.length} strengths, ${weaknesses.length} weaknesses, ${recommendations.length} recommendations`);
          
          return {
            strengths,
            weaknesses,
            recommendations
          };
        }
      } catch (analysisError) {
        // If the first attempt fails, try a simpler approach
        logger.warn(`First attempt at content analysis failed: ${analysisError instanceof Error ? analysisError.message : String(analysisError)}`);
        
        // Try a second attempt with a simpler prompt
        const simpleSystemPrompt = `Analyze the CV content only. List exactly 3 strengths, 3 weaknesses, and 3 recommendations about the content. Format your response with clear headings: "Strengths:", "Weaknesses:", and "Recommendations:".`;
        
        try {
          const secondAttemptText = await this.generateDirectResponse(
            `${query}\n\nDocument to analyze:\n${context.substring(0, 3000)}`, 
            simpleSystemPrompt
          );
          
          // Parse the analysis text to extract strengths, weaknesses, and recommendations
          const sections = this.parseAnalysisSections(secondAttemptText);
          
          // Ensure we have at least some items in each category
          const strengths = sections.strengths.length > 0 ? 
            sections.strengths : this.getDefaultContentStrengths();
          
          const weaknesses = sections.weaknesses.length > 0 ? 
            sections.weaknesses : this.getDefaultContentWeaknesses();
          
          const recommendations = sections.recommendations.length > 0 ? 
            sections.recommendations : this.getDefaultContentRecommendations();
          
          // Log the results
          logger.info(`CV content analysis complete (second attempt): ${strengths.length} strengths, ${weaknesses.length} weaknesses, ${recommendations.length} recommendations`);
          
          return {
            strengths,
            weaknesses,
            recommendations
          };
        } catch (secondError) {
          // If both attempts fail, return defaults
          logger.error(`Both content analysis attempts failed: ${secondError instanceof Error ? secondError.message : String(secondError)}`);
          return {
            strengths: this.getDefaultContentStrengths(),
            weaknesses: this.getDefaultContentWeaknesses(),
            recommendations: this.getDefaultContentRecommendations()
          };
        }
      }
    } catch (error) {
      // Handle errors and return defaults
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error analyzing CV content: ${errorMessage}`);
      
      // Return default content analysis if analysis fails
      return {
        strengths: this.getDefaultContentStrengths(),
        weaknesses: this.getDefaultContentWeaknesses(),
        recommendations: this.getDefaultContentRecommendations()
      };
    }
  }
  
  /**
   * Get default content strengths when analysis fails
   * @returns Array of default content strengths
   */
  private getDefaultContentStrengths(): string[] {
    return [
      "Clear presentation of professional experience",
      "Includes relevant skills and qualifications",
      "Provides educational background",
      "Lists professional achievements",
      "Demonstrates career progression"
    ];
  }
  
  /**
   * Get default content weaknesses when analysis fails
   * @returns Array of default content weaknesses
   */
  private getDefaultContentWeaknesses(): string[] {
    return [
      "Could benefit from more quantifiable achievements",
      "May need more specific examples of skills application",
      "Consider adding more industry-specific keywords",
      "Professional summary could be more compelling",
      "Experience descriptions could be more achievement-focused"
    ];
  }
  
  /**
   * Get default content recommendations when analysis fails
   * @returns Array of default content recommendations
   */
  private getDefaultContentRecommendations(): string[] {
    return [
      "Add measurable achievements with numbers and percentages",
      "Include more industry-specific keywords",
      "Ensure all experience is relevant to target positions",
      "Create a compelling professional summary",
      "Focus on results rather than responsibilities"
    ];
  }

  /**
   * Determine the industry based on CV content
   * @returns Industry name
   */
  public async determineIndustry(): Promise<string> {
    try {
      // Ensure we have chunks to analyze
      if (this.chunks.length === 0) {
        logger.warn('No chunks available for industry determination, using default');
        return 'General';
      }

      const query = 'Determine the industry or sector this CV/resume is most relevant for.';
      
      const systemPrompt = `You are a professional CV/resume industry analyzer. Your task is to determine the most relevant industry or sector for this CV.

Based on the skills, experience, and qualifications mentioned, identify the single most appropriate industry from this list:
- IT & Software
- Finance & Banking
- Healthcare & Medical
- Marketing & Advertising
- Education & Training
- Engineering & Manufacturing
- Sales & Business Development
- Legal & Compliance
- Human Resources
- Creative & Design
- Science & Research
- Hospitality & Tourism
- Retail
- Construction & Real Estate
- Media & Communications
- Transportation & Logistics
- Energy & Utilities
- Government & Public Sector
- Non-profit & NGO
- General Business

Respond with ONLY the industry name, nothing else.`;
      
      // Generate industry analysis using all CV chunks
      // Limit context to avoid token limits
      const context = this.chunks.slice(0, 5).join('\n\n');
      
      try {
        logger.info('Attempting to determine industry');
        const industryText = await this.generateDirectResponse(
          `${query}\n\nDocument to analyze:\n${context}`, 
          systemPrompt
        );
        
        // Clean up the response
        const industry = industryText.trim().split('\n')[0].replace(/["\n\r]/g, '');
        
        logger.info(`Determined industry: ${industry}`);
        return industry || 'General';
      } catch (error) {
        logger.error(`Error determining industry: ${error instanceof Error ? error.message : String(error)}`);
        return 'General';
      }
    } catch (error) {
      // Handle errors and return default
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error determining industry: ${errorMessage}`);
      return 'General';
    }
  }

  /**
   * Detect the language of the CV
   * @returns Language code or name
   */
  public async detectLanguage(): Promise<string> {
    try {
      // Ensure we have chunks to analyze
      if (this.chunks.length === 0) {
        logger.warn('No chunks available for language detection, using default');
        return 'English';
      }

      const query = 'Detect the language of this CV/resume document.';
      
      const systemPrompt = `You are a language detection specialist. Your task is to identify the primary language used in this CV/resume.

Respond with ONLY the language name in English (e.g., "English", "Spanish", "French", "German", etc.), nothing else.`;
      
      // Use just the first chunk for language detection
      const context = this.chunks[0];
      
      try {
        logger.info('Attempting to detect language');
        const languageText = await this.generateDirectResponse(
          `${query}\n\nDocument to analyze:\n${context}`, 
          systemPrompt
        );
        
        // Clean up the response
        const language = languageText.trim().split('\n')[0].replace(/["\n\r]/g, '');
        
        logger.info(`Detected language: ${language}`);
        return language || 'English';
      } catch (error) {
        logger.error(`Error detecting language: ${error instanceof Error ? error.message : String(error)}`);
        return 'English';
      }
    } catch (error) {
      // Handle errors and return default
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error detecting language: ${errorMessage}`);
      return 'English';
    }
  }

  /**
   * Extract sections from the CV
   * @returns Array of sections with name and content
   */
  public async extractSections(): Promise<Array<{ name: string; content: string }>> {
    try {
      // Ensure we have chunks to analyze
      if (this.chunks.length === 0) {
        logger.warn('No chunks available for section extraction, using defaults');
        return this.getDefaultSections();
      }

      const query = 'Extract the main sections from this CV/resume document.';
      
      const systemPrompt = `You are a CV/resume section extraction specialist. Your task is to identify and extract the main sections from this document.

Common CV sections include:
- Contact Information
- Professional Summary / Profile
- Work Experience / Professional Experience
- Education
- Skills
- Certifications
- Projects
- Languages
- Interests / Hobbies

For each section you identify, extract:
1. The section name/heading
2. The content of that section

Provide your response as a JSON array of objects, each with "name" and "content" properties.

Example response format:
[
  {
    "name": "Contact Information",
    "content": "John Doe\\nEmail: john@example.com\\nPhone: (123) 456-7890\\nLinkedIn: linkedin.com/in/johndoe"
  },
  {
    "name": "Professional Experience",
    "content": "Senior Developer, ABC Company\\nJan 2018 - Present\\n- Led development of company's flagship product\\n- Managed team of 5 junior developers"
  }
]`;
      
      // Generate sections using all CV chunks
      const context = this.chunks.join('\n\n');
      
      try {
        logger.info('Attempting to extract CV sections');
        const sectionsText = await this.generateDirectResponse(
          `${query}\n\nDocument to analyze:\n${context}`, 
          systemPrompt
        );
        
        // Try to parse as JSON
        try {
          // First, try to extract JSON if it's embedded in other text
          const jsonMatch = sectionsText.match(/\[[\s\S]*\]/);
          const jsonString = jsonMatch ? jsonMatch[0] : sectionsText;
          
          const jsonResponse = JSON.parse(jsonString);
          
          // Validate the JSON structure
          if (Array.isArray(jsonResponse) && jsonResponse.length > 0) {
            // Ensure each item has name and content
            const validSections = jsonResponse.filter(item => 
              item && typeof item === 'object' && 
              'name' in item && typeof item.name === 'string' &&
              'content' in item && typeof item.content === 'string'
            );
            
            if (validSections.length > 0) {
              logger.info(`Successfully extracted ${validSections.length} sections as JSON`);
              return validSections;
            } else {
              logger.warn('JSON response does not contain valid sections, using defaults');
              return this.getDefaultSections();
            }
          } else {
            logger.warn('JSON response is not an array or is empty, using defaults');
            return this.getDefaultSections();
          }
        } catch (jsonError) {
          // If JSON parsing fails, use defaults
          logger.warn(`Failed to parse sections as JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
          return this.getDefaultSections();
        }
      } catch (error) {
        logger.error(`Error extracting sections: ${error instanceof Error ? error.message : String(error)}`);
        return this.getDefaultSections();
      }
    } catch (error) {
      // Handle errors and return defaults
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error extracting sections: ${errorMessage}`);
      return this.getDefaultSections();
    }
  }

  /**
   * Get default sections when extraction fails
   * @returns Array of default sections
   */
  private getDefaultSections(): Array<{ name: string; content: string }> {
    return [
      { name: "Contact Information", content: "Contact details" },
      { name: "Professional Experience", content: "Work history" },
      { name: "Education", content: "Educational background" },
      { name: "Skills", content: "Professional skills" }
    ];
  }

  /**
   * Parse bullet points from text
   * @param text Text containing bullet points
   * @returns Array of bullet points
   */
  private parseBulletPoints(text: string): string[] {
    // Split by common bullet point markers
    const bulletPointRegex = /(?:^|\n)(?:\s*[-•*]\s*|\s*\d+\.\s*|\s*[a-z]\)\s*|\s*[A-Z]\)\s*)(.+?)(?=(?:\n\s*[-•*]\s*|\n\s*\d+\.\s*|\n\s*[a-z]\)\s*|\n\s*[A-Z]\)\s*|$))/g;
    
    const bulletPoints: string[] = [];
    let match;
    
    while ((match = bulletPointRegex.exec(text)) !== null) {
      if (match[1] && match[1].trim()) {
        bulletPoints.push(match[1].trim());
      }
    }
    
    // If no bullet points found, try splitting by newlines
    if (bulletPoints.length === 0) {
      return text.split(/\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }
    
    return bulletPoints;
  }

  /**
   * Parse analysis sections from text
   * @param text Analysis text
   * @returns Object with strengths, weaknesses, and recommendations
   */
  private parseAnalysisSections(text: string): { strengths: string[], weaknesses: string[], recommendations: string[] } {
    // Default empty arrays
    const result: { strengths: string[], weaknesses: string[], recommendations: string[] } = {
      strengths: [] as string[],
      weaknesses: [] as string[],
      recommendations: [] as string[]
    };
    
    // Try to extract sections using regex
    const strengthsMatch = text.match(/(?:strengths|pros|positives|advantages)(?:\s*:|\s*\n)([\s\S]*?)(?=(?:weaknesses|cons|negatives|disadvantages|recommendations|suggestions|improvements|$))/i);
    const weaknessesMatch = text.match(/(?:weaknesses|cons|negatives|disadvantages)(?:\s*:|\s*\n)([\s\S]*?)(?=(?:recommendations|suggestions|improvements|strengths|pros|positives|advantages|$))/i);
    const recommendationsMatch = text.match(/(?:recommendations|suggestions|improvements)(?:\s*:|\s*\n)([\s\S]*?)(?=(?:strengths|pros|positives|advantages|weaknesses|cons|negatives|disadvantages|$))/i);
    
    // Extract strengths
    if (strengthsMatch && strengthsMatch[1]) {
      result.strengths = this.parseBulletPoints(strengthsMatch[1]);
    }
    
    // Extract weaknesses
    if (weaknessesMatch && weaknessesMatch[1]) {
      result.weaknesses = this.parseBulletPoints(weaknessesMatch[1]);
    }
    
    // Extract recommendations
    if (recommendationsMatch && recommendationsMatch[1]) {
      result.recommendations = this.parseBulletPoints(recommendationsMatch[1]);
    }
    
    return result;
  }
} 