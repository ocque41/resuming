import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';

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
 * using LLM APIs and in-memory vector storage for embedding storage and retrieval.
 */
export class MistralRAGService {
  private client: any; // Using OpenAI client for compatibility
  private vectorStore: SimpleVectorStore = new SimpleVectorStore();
  private chunks: string[] = [];
  private chunkSize: number = 1024;
  private embeddingModel: string = 'text-embedding-ada-002'; // OpenAI embedding model
  private generationModel: string = 'gpt-3.5-turbo'; // Fallback to OpenAI model
  private embeddingCache: EmbeddingCache = {};
  private cacheTTL: number = 3600000; // Cache TTL: 1 hour in milliseconds

  /**
   * Create a new MistralRAGService
   */
  constructor() {
    // Initialize the OpenAI client with API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }
    // Use OpenAI client for compatibility
    this.client = new OpenAI({
      apiKey: apiKey
    });

    // Initialize vector store
    this.resetIndex();
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
   * Create embedding for a single chunk of text
   * @param text Text to create embedding for
   * @returns Embedding as array of numbers
   */
  private async createEmbedding(text: string): Promise<number[]> {
    try {
      // Use a hash of the text as the cache key
      const cacheKey = this.hashString(text);
      
      // Check if we have a cached embedding
      const cachedItem = this.embeddingCache[cacheKey];
      const now = Date.now();
      
      if (cachedItem && now - cachedItem.timestamp < this.cacheTTL) {
        // Use cached embedding if it's still valid
        logger.info('Using cached embedding');
        return cachedItem.embedding;
      }
      
      // Generate new embedding using OpenAI
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text
      });
      
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
   * Simple hash function for creating cache keys
   * @param str String to hash
   * @returns Hash of the string
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
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
      const response = await this.client.chat.completions.create({
        model: this.generationModel,
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
      const response = await this.client.chat.completions.create({
        model: this.generationModel,
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
   * @returns Object containing format analysis
   */
  public async analyzeCVFormat(): Promise<{
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  }> {
    const query = 'Analyze the CV format and provide strengths, weaknesses, and recommendations for improvement.';
    const systemPrompt = 'You are a CV format analyzer. Analyze the CV format and structure, not the content. Provide specific strengths, weaknesses, and actionable recommendations for improving the format.';
    
    const analysisText = await this.generateResponse(query, systemPrompt);
    
    // Parse the analysis text to extract strengths, weaknesses, and recommendations
    const sections = this.parseAnalysisSections(analysisText);
    
    return {
      strengths: sections.strengths || [],
      weaknesses: sections.weaknesses || [],
      recommendations: sections.recommendations || []
    };
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
   * Extract keywords from the CV that are relevant to ATS systems
   * @param industry Optional industry to focus keyword extraction
   * @returns Array of keywords
   */
  public async extractKeywords(industry?: string): Promise<string[]> {
    const query = industry 
      ? `Extract the most important keywords from this CV for the ${industry} industry that would be relevant for ATS systems.`
      : 'Extract the most important keywords from this CV that would be relevant for ATS systems.';
    
    const systemPrompt = `You are a CV keyword extractor specialized in identifying terms that ATS systems look for. 
Extract only the most relevant keywords from the CV. Focus on hard skills, technical competencies, certifications, and industry-specific terminology. 
Format your response as a simple list of keywords, one per line. Do not include explanations.`;
    
    const keywordsText = await this.generateResponse(query, systemPrompt);
    
    // Parse the keywords into an array
    const keywords = this.parseBulletPoints(keywordsText);
    
    // Clean up keywords and filter out any that are too short
    return keywords
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 2)
      .slice(0, 20); // Limit to top 20 keywords
  }

  /**
   * Extract key requirements or qualifications from the CV
   * @returns Array of key requirements
   */
  public async extractKeyRequirements(): Promise<string[]> {
    const query = 'Extract the key qualifications and requirements that this candidate meets based on their CV.';
    
    const systemPrompt = `You are a CV analyst specialized in identifying key qualifications and requirements.
Extract only the most important qualifications from the CV that would make this candidate suitable for roles in their industry.
Focus on concrete achievements, years of experience, education level, certifications, and specialized skills.
Format your response as a simple list, one qualification per line. Do not include explanations.`;
    
    const requirementsText = await this.generateResponse(query, systemPrompt);
    
    // Parse the requirements into an array
    const requirements = this.parseBulletPoints(requirementsText);
    
    // Clean up and filter
    return requirements
      .map(req => req.trim())
      .filter(req => req.length > 5)
      .slice(0, 10); // Limit to top 10 requirements
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
} 