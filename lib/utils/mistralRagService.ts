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
  private openaiClient: OpenAI;
  private mistralClient: Mistral | null = null;
  private vectorStore: SimpleVectorStore = new SimpleVectorStore();
  private chunks: string[] = [];
  private chunkSize: number = 1024;
  private embeddingModel: string = 'text-embedding-ada-002'; // OpenAI embedding model
  private mistralEmbeddingModel: string = 'mistral-embed'; // Mistral embedding model
  private openaiGenerationModel: string = 'gpt-4o-mini'; // OpenAI chat model
  private mistralGenerationModel: string = 'mistral-large-latest'; // Mistral chat model
  private embeddingCache: EmbeddingCache = {};
  private cacheTTL: number = 3600000; // Cache TTL: 1 hour in milliseconds
  private useMistral: boolean = true; // Flag to control which API to use

  /**
   * Create a new MistralRAGService
   */
  constructor() {
    // Initialize the OpenAI client with API key from environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }
    
    // Initialize OpenAI client
    this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
    
    // Initialize the Mistral client with API key from environment variables
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey) {
      logger.warn('MISTRAL_API_KEY environment variable not set, falling back to OpenAI');
      this.useMistral = false;
    } else {
      try {
        // Initialize Mistral client
        this.mistralClient = new Mistral({
          apiKey: mistralApiKey
        });
        logger.info('Successfully initialized Mistral client');
      } catch (error) {
        logger.error(`Failed to initialize Mistral client: ${error instanceof Error ? error.message : String(error)}`);
        this.useMistral = false;
      }
    }

    // Initialize vector store
    this.resetIndex();
    
    logger.info(`MistralRAGService initialized with ${this.useMistral ? 'Mistral' : 'OpenAI'} as primary LLM`);
  }

  /**
   * Reset the vector store
   */
  private resetIndex(): void {
    this.vectorStore = new SimpleVectorStore();
    this.chunks = [];
  }

  /**
   * Process a CV document by splitting it into chunks and creating embeddings
   * @param cvText Full text content of the CV
   */
  public async processCVDocument(cvText: string): Promise<void> {
    try {
      logger.info('Processing CV document with RAG service');
      
      // Reset the index for a new document
      this.resetIndex();
      
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
   * @param query Query to generate response for
   * @param systemPrompt Optional system prompt
   * @returns Generated response
   */
  public async generateResponse(query: string, systemPrompt?: string): Promise<string> {
    try {
      // Retrieve relevant chunks
      const chunks = await this.retrieveRelevantChunks(query, 3);
      
      if (chunks.length === 0) {
        logger.warn('No relevant chunks found for query, falling back to direct response');
        return this.generateDirectResponse(query, systemPrompt);
      }
      
      // Combine chunks into context
      const context = chunks.join('\n\n');
      
      // Generate response with context using OpenAI
      const response = await this.openaiClient.chat.completions.create({
        model: this.openaiGenerationModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt || 'You are a helpful assistant that answers questions based on the provided CV information.'
          },
          {
            role: 'user',
            content: `Use the following CV information to respond to the query:\n\n${context}\n\nQuery: ${query}`
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
      logger.error(`Error generating response with RAG: ${errorMessage}`);
      // Fall back to direct query
      return this.generateDirectResponse(query, systemPrompt);
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
   * Analyze the format and structure of a CV document
   * @returns Object containing format strengths, weaknesses, and recommendations
   */
  public async analyzeCVFormat(): Promise<{
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  }> {
    try {
      // Ensure we have chunks to analyze
      if (this.chunks.length === 0) {
        logger.warn('No chunks available for CV format analysis, using defaults');
        return {
          strengths: this.getDefaultStrengths(),
          weaknesses: this.getDefaultWeaknesses(),
          recommendations: this.getDefaultRecommendations()
        };
      }

      // Combine chunks into a single document for analysis
      // Limit to first 10 chunks to avoid token limits
      const context = this.chunks.slice(0, 10).join('\n\n');
      
      // Create a more structured prompt for better results
      const query = 'Analyze the format and structure of this CV/resume document in detail. Focus only on formatting, layout, organization, and visual aspects.';
      
      const systemPrompt = `You are a professional CV/resume format analyzer. Your task is to analyze ONLY the format and structure of the CV (not the content).

Review the document for these format aspects:
1. Section organization and clarity
2. Header formatting and contact information placement
3. Use of bullet points, paragraphs, and white space
4. Consistency in formatting (dates, headings, etc.)
5. Font usage, bolding, italics, and other text formatting
6. Length and overall visual appeal

Provide your analysis in JSON format with these three arrays:
1. "strengths": List specific formatting strengths (minimum 3)
2. "weaknesses": List specific formatting issues (minimum 3)
3. "recommendations": Provide actionable recommendations to improve the format (minimum 3)

Example response format:
{
  "strengths": ["Clear section headings", "Consistent date formatting", "Good use of bullet points"],
  "weaknesses": ["Contact information not prominently displayed", "Inconsistent spacing between sections", "Too dense with text"],
  "recommendations": ["Add more white space between sections", "Make contact information more prominent", "Use bullet points for all achievements"]
}

Keep your analysis focused only on the document's format, not its content or qualifications.`;
      
      // Initialize with default values to ensure we always have something to return
      let analysisResult: { strengths: string[], weaknesses: string[], recommendations: string[] } = {
        strengths: this.getDefaultStrengths(),
        weaknesses: this.getDefaultWeaknesses(),
        recommendations: this.getDefaultRecommendations()
      };
      
      // Try multiple approaches to ensure we get a result
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          logger.info(`CV format analysis attempt ${attempt}`);
          
          let analysisText: string;
          
          // Use different models for different attempts
          if (attempt === 1 && this.useMistral && this.mistralClient) {
            // First try Mistral if available
            try {
              analysisText = await this.generateDirectResponse(
                `${query}\n\nDocument to analyze:\n${context}`, 
                systemPrompt
              );
            } catch (mistralError) {
              logger.warn(`Mistral format analysis failed: ${mistralError instanceof Error ? mistralError.message : String(mistralError)}`);
              // Fall back to OpenAI for this attempt
              analysisText = await this.openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: systemPrompt
                  },
                  {
                    role: 'user',
                    content: `${query}\n\nDocument to analyze:\n${context}`
                  }
                ]
              }).then(response => response.choices[0]?.message?.content || '');
            }
          } else if (attempt === 2) {
            // Second attempt with a simpler prompt
            const simpleSystemPrompt = `Analyze the CV format only. List exactly 3 strengths, 3 weaknesses, and 3 recommendations about the format. Format your response as JSON with three arrays: "strengths", "weaknesses", and "recommendations".`;
            
            analysisText = await this.openaiClient.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: simpleSystemPrompt
                },
                {
                  role: 'user',
                  content: `${query}\n\nDocument to analyze:\n${context.substring(0, 3000)}`
                }
              ]
            }).then(response => response.choices[0]?.message?.content || '');
          } else {
            // Third attempt with an even simpler prompt and explicit instructions
            const verySimplePrompt = `Analyze this CV format and provide exactly:
- 3 format strengths
- 3 format weaknesses
- 3 format recommendations

Format your response as JSON like this:
{
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
}`;
            
            analysisText = await this.openaiClient.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'You are a CV format analyzer. Respond only with valid JSON.'
                },
                {
                  role: 'user',
                  content: `${verySimplePrompt}\n\nDocument to analyze:\n${context.substring(0, 2000)}`
                }
              ]
            }).then(response => response.choices[0]?.message?.content || '');
          }
          
          // Try to parse as JSON
          try {
            // Extract JSON if it's embedded in other text
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : analysisText;
            
            const jsonResponse = JSON.parse(jsonString);
            
            // Validate the JSON structure
            if (jsonResponse.strengths && 
                jsonResponse.weaknesses && 
                jsonResponse.recommendations &&
                Array.isArray(jsonResponse.strengths) &&
                Array.isArray(jsonResponse.weaknesses) &&
                Array.isArray(jsonResponse.recommendations)) {
              
              // Merge with existing results, prioritizing new results
              analysisResult = {
                strengths: [...jsonResponse.strengths, ...analysisResult.strengths],
                weaknesses: [...jsonResponse.weaknesses, ...analysisResult.weaknesses],
                recommendations: [...jsonResponse.recommendations, ...analysisResult.recommendations]
              };
              
              // If we have at least one item in each array, we're done
              if (analysisResult.strengths.length > 0 && 
                  analysisResult.weaknesses.length > 0 && 
                  analysisResult.recommendations.length > 0) {
                logger.info(`Successfully parsed CV format analysis as JSON on attempt ${attempt}`);
                break;
              }
            }
          } catch (jsonError) {
            // If JSON parsing fails, try to parse the text
            logger.warn(`Failed to parse format analysis as JSON on attempt ${attempt}: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
            
            // Parse the analysis text to extract strengths, weaknesses, and recommendations
            const sections = this.parseAnalysisSections(analysisText);
            
            // Merge with existing results, prioritizing new results
            analysisResult = {
              strengths: [...sections.strengths, ...analysisResult.strengths],
              weaknesses: [...sections.weaknesses, ...analysisResult.weaknesses],
              recommendations: [...sections.recommendations, ...analysisResult.recommendations]
            };
            
            // If we have at least one item in each array, we're done
            if (sections.strengths.length > 0 && 
                sections.weaknesses.length > 0 && 
                sections.recommendations.length > 0) {
              logger.info(`Successfully parsed CV format analysis as text on attempt ${attempt}`);
              break;
            }
          }
        } catch (attemptError) {
          logger.warn(`Format analysis attempt ${attempt} failed: ${attemptError instanceof Error ? attemptError.message : String(attemptError)}`);
          // Continue to next attempt
        }
      }
      
      // Remove duplicates from arrays
      analysisResult.strengths = [...new Set(analysisResult.strengths)];
      analysisResult.weaknesses = [...new Set(analysisResult.weaknesses)];
      analysisResult.recommendations = [...new Set(analysisResult.recommendations)];
      
      // Ensure we have at least 3 items in each category
      const strengths = analysisResult.strengths.length >= 3 ? 
        analysisResult.strengths.slice(0, 5) : 
        [...analysisResult.strengths, ...this.getDefaultStrengths()].slice(0, 5);
        
      const weaknesses = analysisResult.weaknesses.length >= 3 ? 
        analysisResult.weaknesses.slice(0, 5) : 
        [...analysisResult.weaknesses, ...this.getDefaultWeaknesses()].slice(0, 5);
        
      const recommendations = analysisResult.recommendations.length >= 3 ? 
        analysisResult.recommendations.slice(0, 5) : 
        [...analysisResult.recommendations, ...this.getDefaultRecommendations()].slice(0, 5);
      
      // Log the results
      logger.info(`CV format analysis complete: ${strengths.length} strengths, ${weaknesses.length} weaknesses, ${recommendations.length} recommendations`);
      
      // Always ensure we have non-empty arrays
      return {
        strengths: strengths.length > 0 ? strengths : this.getDefaultStrengths(),
        weaknesses: weaknesses.length > 0 ? weaknesses : this.getDefaultWeaknesses(),
        recommendations: recommendations.length > 0 ? recommendations : this.getDefaultRecommendations()
      };
    } catch (error) {
      // Handle errors and return defaults
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error analyzing CV format: ${errorMessage}`);
      
      // Return default format analysis if analysis fails
      return {
        strengths: this.getDefaultStrengths(),
        weaknesses: this.getDefaultWeaknesses(),
        recommendations: this.getDefaultRecommendations()
      };
    }
  }
  
  /**
   * Get default format strengths
   * @returns Array of default format strengths
   */
  private getDefaultStrengths(): string[] {
    return [
      "Clear section organization",
      "Consistent formatting throughout the document",
      "Appropriate use of white space",
      "Contact information clearly presented",
      "Logical flow of information"
    ];
  }
  
  /**
   * Get default format weaknesses
   * @returns Array of default format weaknesses
   */
  private getDefaultWeaknesses(): string[] {
    return [
      "Could benefit from better visual hierarchy",
      "Some sections may be too dense with text",
      "Formatting may not be optimized for ATS scanning",
      "Inconsistent use of bullet points",
      "Lack of emphasis on key achievements"
    ];
  }
  
  /**
   * Get default format recommendations
   * @returns Array of default format recommendations
   */
  private getDefaultRecommendations(): string[] {
    return [
      "Use bullet points for key achievements",
      "Ensure consistent date formatting",
      "Add more white space to improve readability",
      "Make section headings more prominent",
      "Organize information in a more scannable format"
    ];
  }

  /**
   * Parse the analysis text into sections
   * @param analysisText Text containing analysis sections
   * @returns Parsed sections object
   */
  private parseAnalysisSections(analysisText: string): {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  } {
    const sections: {
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    } = {
      strengths: [],
      weaknesses: [],
      recommendations: []
    };
    
    // Extract sections using regex
    const strengthsMatch = analysisText.match(/(?:Strengths|STRENGTHS|Format Strengths)(?::|-)?\s*([\s\S]*?)(?:Weaknesses|WEAKNESSES|Format Weaknesses|Recommendations|RECOMMENDATIONS|$)/i);
    const weaknessesMatch = analysisText.match(/(?:Weaknesses|WEAKNESSES|Format Weaknesses)(?::|-)?\s*([\s\S]*?)(?:Recommendations|RECOMMENDATIONS|Strengths|STRENGTHS|$)/i);
    const recommendationsMatch = analysisText.match(/(?:Recommendations|RECOMMENDATIONS)(?::|-)?\s*([\s\S]*?)(?:Strengths|STRENGTHS|Weaknesses|WEAKNESSES|$)/i);
    
    // Process strengths
    if (strengthsMatch && strengthsMatch[1]) {
      sections.strengths = this.parseBulletPoints(strengthsMatch[1]);
    }
    
    // Process weaknesses
    if (weaknessesMatch && weaknessesMatch[1]) {
      sections.weaknesses = this.parseBulletPoints(weaknessesMatch[1]);
    }
    
    // Process recommendations
    if (recommendationsMatch && recommendationsMatch[1]) {
      sections.recommendations = this.parseBulletPoints(recommendationsMatch[1]);
    }
    
    return sections;
  }

  /**
   * Parse bullet points from text
   * @param text Text containing bullet points
   * @returns Array of bullet points
   */
  private parseBulletPoints(text: string): string[] {
    // Split by bullets, numbers, or new lines
    let points: string[] = [];
    
    if (text.includes('•') || text.includes('-') || text.includes('*')) {
      // Split by bullet points
      points = text.split(/[•\-*]/).map(s => s.trim()).filter(s => s.length > 0);
    } else if (/\d+\./.test(text)) {
      // Split by numbered points
      points = text.split(/\d+\./).map(s => s.trim()).filter(s => s.length > 0);
    } else {
      // Split by lines as a fallback
      points = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    }
    
    // Clean up points
    points = points.map(point => {
      // Remove any leading numbers or bullets
      return point.replace(/^[\d\.\-\*•]+\s*/, '').trim();
    }).filter(point => point.length > 0);
    
    return points;
  }

  /**
   * Extract keywords or key phrases from the CV
   * @returns Array of keywords/phrases
   */
  public async extractKeywords(): Promise<string[]> {
    try {
      // Ensure we have chunks to analyze
      if (this.chunks.length === 0) {
        logger.warn('No chunks available for keyword extraction, using defaults');
        return this.getDefaultKeywords();
      }

      // Combine chunks into a single document for analysis
      // Limit to first 15 chunks to avoid token limits
      const context = this.chunks.slice(0, 15).join('\n\n');
      
      // Create a more structured prompt for better results
      const query = 'Extract the most important keywords or key phrases from this CV/resume.';
      
      const systemPrompt = `You are a professional CV/resume keyword analyzer. Your task is to extract the most relevant keywords and key phrases from the CV.

Focus on extracting:
1. Hard skills (technical skills, software, tools, methodologies)
2. Soft skills (communication, leadership, etc.)
3. Industry-specific terminology
4. Qualifications and certifications
5. Job titles and roles

Provide your analysis as a JSON array with at least 15 keywords/phrases. Each keyword should be a string.

Example response format:
{
  "keywords": [
    "Project Management",
    "JavaScript",
    "Team Leadership",
    "Agile Methodology",
    "Budget Planning",
    "React.js",
    "Cross-functional Collaboration",
    "Data Analysis",
    "Strategic Planning",
    "Python",
    "Customer Relationship Management",
    "SQL",
    "Public Speaking",
    "AWS",
    "Process Optimization"
  ]
}`;
      
      // Initialize with default keywords to ensure we always have something to return
      let keywords: string[] = this.getDefaultKeywords();
      
      // Try multiple approaches to ensure we get a result
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          logger.info(`Keyword extraction attempt ${attempt}`);
          
          let keywordsText: string;
          
          // Use different models for different attempts
          if (attempt === 1 && this.useMistral && this.mistralClient) {
            // First try Mistral if available
            try {
              keywordsText = await this.generateDirectResponse(
                `${query}\n\nDocument to analyze:\n${context}`, 
                systemPrompt
              );
            } catch (mistralError) {
              logger.warn(`Mistral keyword extraction failed: ${mistralError instanceof Error ? mistralError.message : String(mistralError)}`);
              // Fall back to OpenAI for this attempt
              keywordsText = await this.openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: systemPrompt
                  },
                  {
                    role: 'user',
                    content: `${query}\n\nDocument to analyze:\n${context}`
                  }
                ]
              }).then(response => response.choices[0]?.message?.content || '');
            }
          } else if (attempt === 2) {
            // Second attempt with a simpler prompt
            const simpleSystemPrompt = `Extract exactly 15 important keywords or key phrases from this CV/resume. Format your response as a JSON array with the key "keywords".`;
            
            keywordsText = await this.openaiClient.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: simpleSystemPrompt
                },
                {
                  role: 'user',
                  content: `${query}\n\nDocument to analyze:\n${context.substring(0, 3000)}`
                }
              ]
            }).then(response => response.choices[0]?.message?.content || '');
          } else {
            // Third attempt with an even simpler prompt and explicit instructions
            const verySimplePrompt = `Extract 15 important keywords from this CV. Format your response as a JSON array like this:
{
  "keywords": ["keyword1", "keyword2", "keyword3", ...]
}`;
            
            keywordsText = await this.openaiClient.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'You are a CV keyword extractor. Respond only with valid JSON.'
                },
                {
                  role: 'user',
                  content: `${verySimplePrompt}\n\nDocument to analyze:\n${context.substring(0, 2000)}`
                }
              ]
            }).then(response => response.choices[0]?.message?.content || '');
          }
          
          // Try to parse as JSON
          try {
            // Extract JSON if it's embedded in other text
            const jsonMatch = keywordsText.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : keywordsText;
            
            const jsonResponse = JSON.parse(jsonString);
            
            // Validate the JSON structure
            if (jsonResponse.keywords && Array.isArray(jsonResponse.keywords) && jsonResponse.keywords.length > 0) {
              // Combine with existing keywords, prioritizing new ones
              keywords = [...jsonResponse.keywords, ...keywords];
              logger.info(`Successfully extracted ${jsonResponse.keywords.length} keywords as JSON on attempt ${attempt}`);
              break;
            }
          } catch (jsonError) {
            // If JSON parsing fails, try to parse the text
            logger.warn(`Failed to parse keywords as JSON on attempt ${attempt}: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
            
            // Parse the keywords from text
            const extractedKeywords = this.parseKeywordsFromText(keywordsText);
            
            if (extractedKeywords.length > 0) {
              // Combine with existing keywords, prioritizing new ones
              keywords = [...extractedKeywords, ...keywords];
              logger.info(`Extracted ${extractedKeywords.length} keywords via text parsing on attempt ${attempt}`);
              break;
            }
          }
        } catch (attemptError) {
          logger.warn(`Keyword extraction attempt ${attempt} failed: ${attemptError instanceof Error ? attemptError.message : String(attemptError)}`);
          // Continue to next attempt
        }
      }
      
      // If we still don't have keywords, try a direct extraction from the text
      if (keywords.length === 0) {
        logger.warn('All keyword extraction attempts failed, trying direct text extraction');
        
        // Extract potential keywords directly from the text
        const words = context.match(/\b[A-Za-z][A-Za-z0-9\s]*[A-Za-z0-9]\b/g) || [];
        
        // Filter to likely keywords (longer than 3 letters, not common words)
        const commonWords = new Set(['the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but', 'from', 'they', 'will', 'would', 'there', 'their', 'what', 'about', 'which', 'when', 'make', 'like', 'time', 'just', 'know', 'take', 'people', 'year', 'your', 'good', 'some', 'could', 'them', 'than', 'then', 'look', 'only', 'come', 'over', 'think', 'also', 'back', 'after', 'work', 'first', 'well', 'even', 'want', 'because', 'these', 'give', 'most']);
        
        // Count word frequencies
        const wordCounts: Record<string, number> = {};
        words.forEach(word => {
          const cleanWord = word.trim().toLowerCase();
          if (cleanWord.length > 3 && !commonWords.has(cleanWord)) {
            wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
          }
        });
        
        // Sort by frequency
        const sortedWords = Object.entries(wordCounts)
          .sort((a, b) => b[1] - a[1])
          .map(entry => entry[0]);
        
        // Take top 15 words
        const extractedWords = sortedWords.slice(0, 15);
        
        // Capitalize first letter of each word
        const formattedWords = extractedWords.map(word => word.charAt(0).toUpperCase() + word.slice(1));
        
        // Combine with existing keywords, prioritizing new ones
        keywords = [...formattedWords, ...keywords];
        
        logger.info(`Extracted ${formattedWords.length} keywords via direct text extraction`);
      }
      
      // Remove duplicates and ensure proper formatting
      keywords = [...new Set(keywords)].map(keyword => 
        keyword.trim().replace(/\s+/g, ' ')
      );
      
      // Ensure we have at least 10 keywords
      if (keywords.length < 10) {
        keywords = [...keywords, ...this.getDefaultKeywords()].slice(0, 15);
        logger.info(`Added default keywords to reach ${keywords.length} total keywords`);
      }
      
      // Limit to 15 keywords
      keywords = keywords.slice(0, 15);
      
      logger.info(`Final keyword list contains ${keywords.length} keywords`);
      
      // Always ensure we return a non-empty array
      return keywords.length > 0 ? keywords : this.getDefaultKeywords();
    } catch (error) {
      // Handle errors and return defaults
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error extracting keywords: ${errorMessage}`);
      
      // Return default keywords if extraction fails
      return this.getDefaultKeywords();
    }
  }
  
  /**
   * Parse keywords from text response
   * @param text Text containing keywords
   * @returns Array of keywords
   */
  private parseKeywordsFromText(text: string): string[] {
    // Try different patterns to extract keywords
    let keywords: string[] = [];
    
    // Try to extract lines with ":" or "-" which often indicate keyword-rating pairs
    const ratingPattern = /([^:]+)(?::|-)(?:\s*)(?:High|Medium|Low|[\d]+)/gi;
    const ratingMatches = Array.from(text.matchAll(ratingPattern));
    
    if (ratingMatches.length > 0) {
      keywords = ratingMatches.map(match => match[1].trim());
    } else {
      // Try to extract bullet points
      if (text.includes('•') || text.includes('-') || text.includes('*')) {
        // Split by bullet points
        keywords = text.split(/[•\-*]/).map(s => s.trim()).filter(s => s.length > 0);
      } else if (text.includes(',')) {
        // Split by commas
        keywords = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
      } else {
        // Split by lines as a fallback
        keywords = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      }
    }
    
    // Clean up keywords
    keywords = keywords.map(keyword => {
      // Remove any numbering, ratings, etc.
      return keyword.replace(/^\d+\.\s*/, '').replace(/\s*\(.*\)$/, '').trim();
    }).filter(keyword => keyword.length > 0);
    
    return keywords;
  }
  
  /**
   * Get default keywords for when extraction fails
   * @returns Array of default keywords
   */
  private getDefaultKeywords(): string[] {
    return [
      "Project Management",
      "Communication Skills",
      "Team Leadership",
      "Problem Solving",
      "Critical Thinking",
      "Microsoft Office",
      "Data Analysis",
      "Customer Service",
      "Strategic Planning",
      "Research",
      "Collaboration",
      "Time Management",
      "Attention to Detail",
      "Organization",
      "Presentation Skills"
    ];
  }

  /**
   * Extract key requirements or qualifications from the CV
   * @returns Array of key requirements/qualifications
   */
  public async extractKeyRequirements(): Promise<string[]> {
    try {
      // Ensure we have chunks to analyze
      if (this.chunks.length === 0) {
        logger.warn('No chunks available for key requirements extraction, using defaults');
        return this.getDefaultKeyRequirements();
      }

      const query = 'Extract the key qualifications and requirements from this CV/resume.';
      
      const systemPrompt = `You are a professional CV/resume qualification analyzer. Your task is to extract the most important qualifications and requirements from the CV.

Focus on extracting:
1. Educational qualifications (degrees, certifications)
2. Years of experience in specific roles or industries
3. Technical skills and competencies
4. Professional achievements and accomplishments
5. Specialized knowledge areas

Provide your analysis as a JSON array with at least 8 key qualifications/requirements. Each item should be a string.

Example response format:
{
  "requirements": [
    "Bachelor's degree in Computer Science",
    "5+ years of experience in software development",
    "Proficient in JavaScript and React.js",
    "Experience with cloud platforms (AWS, Azure)",
    "Strong problem-solving and analytical skills",
    "Agile development methodology expertise",
    "Experience leading cross-functional teams",
    "Excellent communication and presentation skills"
  ]
}

Focus on extracting the most significant qualifications that would be relevant for job applications.`;
      
      // Generate key requirements using all CV chunks
      // Limit context to avoid token limits
      const context = this.chunks.slice(0, 15).join('\n\n');
      
      // Initialize with default requirements to ensure we always have something to return
      let requirements: string[] = this.getDefaultKeyRequirements();
      
      // First try to get a structured JSON response
      try {
        logger.info('Attempting key requirements extraction with JSON response');
        const requirementsText = await this.generateDirectResponse(
          `${query}\n\nDocument to analyze:\n${context}`, 
          systemPrompt
        );
        
        // Try to parse as JSON
        try {
          // First, try to extract JSON if it's embedded in other text
          const jsonMatch = requirementsText.match(/\{[\s\S]*\}/);
          const jsonString = jsonMatch ? jsonMatch[0] : requirementsText;
          
          const jsonResponse = JSON.parse(jsonString);
          
          // Validate the JSON structure
          if (jsonResponse.requirements && Array.isArray(jsonResponse.requirements) && jsonResponse.requirements.length > 0) {
            logger.info(`Successfully extracted ${jsonResponse.requirements.length} key requirements as JSON`);
            
            // Combine with existing requirements, prioritizing new ones
            requirements = [...jsonResponse.requirements, ...requirements];
          } else {
            logger.warn('JSON response missing requirements array or empty array, falling back to text parsing');
            throw new Error('Invalid JSON structure');
          }
        } catch (jsonError) {
          // If JSON parsing fails, try to parse the text
          logger.warn(`Failed to parse key requirements as JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
          
          // Parse the requirements from text
          const extractedRequirements = this.parseKeywordsFromText(requirementsText);
          
          if (extractedRequirements.length > 0) {
            logger.info(`Extracted ${extractedRequirements.length} key requirements via text parsing`);
            // Combine with existing requirements, prioritizing new ones
            requirements = [...extractedRequirements, ...requirements];
          } else {
            throw new Error('No key requirements found in text parsing');
          }
        }
      } catch (firstAttemptError) {
        // If the first attempt fails, try a simpler approach
        logger.warn(`First attempt at key requirements extraction failed: ${firstAttemptError instanceof Error ? firstAttemptError.message : String(firstAttemptError)}`);
        
        // Try a second attempt with a simpler prompt
        const simpleSystemPrompt = `Extract exactly 8 key qualifications or requirements from this CV/resume. Format your response as a simple list with one qualification per line. Include education, experience, and skills.`;
        
        try {
          const secondAttemptText = await this.generateDirectResponse(
            `${query}\n\nDocument to analyze:\n${context.substring(0, 3000)}`, 
            simpleSystemPrompt
          );
          
          // Parse the requirements from text
          const extractedRequirements = this.parseKeywordsFromText(secondAttemptText);
          
          if (extractedRequirements.length > 0) {
            logger.info(`Extracted ${extractedRequirements.length} key requirements via second attempt`);
            // Combine with existing requirements, prioritizing new ones
            requirements = [...extractedRequirements, ...requirements];
          }
        } catch (secondError) {
          // If both attempts fail, log the error
          logger.error(`Both key requirements extraction attempts failed: ${secondError instanceof Error ? secondError.message : String(secondError)}`);
          // We'll still return the default requirements initialized at the beginning
        }
      }
      
      // Remove duplicates and ensure proper formatting
      requirements = [...new Set(requirements)].map(requirement => 
        requirement.trim().replace(/\s+/g, ' ')
      );
      
      // Limit to 8 requirements
      requirements = requirements.slice(0, 8);
      
      logger.info(`Final requirements list contains ${requirements.length} items`);
      
      // Always ensure we return a non-empty array
      return requirements.length > 0 ? requirements : this.getDefaultKeyRequirements();
    } catch (error) {
      // Handle errors and return defaults
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error extracting key requirements: ${errorMessage}`);
      
      // Return default key requirements if extraction fails
      return this.getDefaultKeyRequirements();
    }
  }
  
  /**
   * Get default key requirements when extraction fails
   * @returns Array of default key requirements
   */
  private getDefaultKeyRequirements(): string[] {
    return [
      "Bachelor's degree or equivalent experience",
      "Proficient in relevant technical skills",
      "Strong communication and interpersonal skills",
      "Problem-solving and analytical abilities",
      "Team collaboration experience",
      "Project management skills",
      "Industry-specific knowledge",
      "Adaptability and willingness to learn"
    ];
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
          const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
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
} 