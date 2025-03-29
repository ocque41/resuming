// lib/db/queries.server.ts
import { desc, and, eq, isNull, like, ilike, not, isNotNull } from 'drizzle-orm';
import { db } from './drizzle';
import { 
  activityLogs, 
  teamMembers, 
  teams, 
  users, 
  cvs, 
  documentAnalyses, 
  DocumentAnalysis, 
  NewDocumentAnalysis 
} from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';
import { logger } from "@/lib/logger";

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser(userId: number) {
  const result = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      teamMembers: {
        with: {
          team: {
            with: {
              teamMembers: {
                with: {
                  user: {
                    columns: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return result?.teamMembers[0]?.team || null;
}

export async function getCVsForUser(userId: number) {
  try {
    const results = await db.query.cvs.findMany({
      where: eq(cvs.userId, userId),
      orderBy: [desc(cvs.createdAt)],
    });
    
    // Process file URLs for different storage types
    const processedResults = results.map(cv => {
      // Parse metadata to check storage type
      const metadata = cv.metadata ? JSON.parse(cv.metadata) : {};
      const storageType = metadata.storageType || (cv.filepath?.startsWith('/') ? 'dropbox' : 's3');
      
      // For the client, store the storage type if it's missing
      if (!metadata.storageType) {
        metadata.storageType = storageType;
        cv.metadata = JSON.stringify(metadata);
      }
      
      return cv;
    });
    
    return processedResults;
  } catch (error) {
    console.error("Error getting CVs for user:", error);
    return [];
  }
}

// ------------------------------
// New functions for CV analysis
// ------------------------------

/**
 * Retrieves a CV record by its fileName.
 * Uses a more flexible search to handle case differences, partial matches, and filenames with pipe characters.
 */
export async function getCVByFileName(fileName: string) {
  console.log(`getCVByFileName called with: "${fileName}"`);
  try {
    // Attempt to find by exact filename
    let cv = await db.query.cvs.findFirst({
      where: eq(cvs.fileName, fileName),
    });
    
    // If not found, try finding by filepath containing the filename
    if (!cv) {
      const cvs = await db.query.cvs.findMany();
      cv = cvs.find((cv) => 
        cv.filepath?.includes(fileName) || 
        cv.fileName?.includes(fileName)
      );
    }
    
    if (cv) {
      // Parse metadata to check storage type
      const metadata = cv.metadata ? JSON.parse(cv.metadata) : {};
      const storageType = metadata.storageType || (cv.filepath?.startsWith('/') ? 'dropbox' : 's3');
      
      // For the client, store the storage type if it's missing
      if (!metadata.storageType) {
        metadata.storageType = storageType;
        cv.metadata = JSON.stringify(metadata);
        
        // Update the record with the storage type info
        try {
          await db.update(cvs)
            .set({ metadata: cv.metadata })
            .where(eq(cvs.id, cv.id));
        } catch (updateError) {
          console.error("Error updating CV storage type:", updateError);
        }
      }
    }
    
    return cv;
  } catch (error) {
    console.error("Error getting CV by filename:", error);
    return null;
  }
}

/**
 * Updates the CV record with new analysis metadata.
 * @param cvId - The ID of the CV record.
 * @param metadata - The analysis metadata as a JSON string.
 * @returns A promise that resolves to true when the update is complete.
 */
export async function updateCVAnalysis(cvId: number, metadata: string): Promise<boolean> {
  await db.update(cvs).set({ metadata }).where(eq(cvs.id, cvId));
  return true;
}

/**
 * Save a new document analysis result to the database
 * @param cvId The CV ID this analysis is for
 * @param analysisData The complete analysis result
 * @param analysisType The type of analysis (default: 'general')
 * @returns The created analysis record
 */
export async function saveDocumentAnalysis(
  cvId: number,
  analysisData: any,
  analysisType: string = "general"
): Promise<DocumentAnalysis | undefined> {
  try {
    // First check if we already have a version for this CV
    const existingVersions = await db
      .select({ version: documentAnalyses.version })
      .from(documentAnalyses)
      .where(eq(documentAnalyses.cvId, cvId))
      .orderBy(desc(documentAnalyses.version))
      .limit(1);

    // Calculate the new version number
    const newVersion = existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;
    
    // Extract structured data for the indexed fields
    const overallScore = analysisData.summary?.overallScore || 0;
    const sentimentScore = Math.round((analysisData.sentimentAnalysis?.overallScore || 0) * 100);
    const keywordCount = analysisData.contentAnalysis?.topKeywords?.length || 0;
    const entityCount = analysisData.keyInformation?.entities?.length || 0;
    
    // Insert the new analysis
    const result = await db
      .insert(documentAnalyses)
      .values({
        cvId,
        version: newVersion,
        analysisType,
        overallScore,
        sentimentScore,
        keywordCount,
        entityCount,
        contentAnalysis: analysisData.contentAnalysis || null,
        sentimentAnalysis: analysisData.sentimentAnalysis || null,
        keyInformation: analysisData.keyInformation || null,
        summary: analysisData.summary || null,
        rawAnalysisResponse: analysisData
      })
      .returning();
      
    // Also update the CV's metadata field for backward compatibility
    await updateCVAnalysis(cvId, JSON.stringify(analysisData));
      
    console.log(`Document analysis saved with ID ${result[0].id}, version ${newVersion}`);
    return result[0];
  } catch (error) {
    console.error("Error saving document analysis:", error);
    return undefined;
  }
}

/**
 * Get the latest analysis for a CV
 * @param cvId The CV ID to get analysis for
 * @returns The latest analysis or undefined if none exists
 */
export async function getLatestDocumentAnalysis(
  cvId: number
): Promise<DocumentAnalysis | undefined> {
  try {
    const analyses = await db
      .select()
      .from(documentAnalyses)
      .where(eq(documentAnalyses.cvId, cvId))
      .orderBy(desc(documentAnalyses.version))
      .limit(1);
      
    return analyses.length > 0 ? analyses[0] : undefined;
  } catch (error) {
    console.error(`Error getting latest analysis for CV ${cvId}:`, error);
    return undefined;
  }
}

/**
 * Get all analyses for a CV
 * @param cvId The CV ID to get analyses for
 * @returns Array of analyses, ordered by version descending
 */
export async function getAllDocumentAnalyses(
  cvId: number
): Promise<DocumentAnalysis[]> {
  try {
    return await db
      .select()
      .from(documentAnalyses)
      .where(eq(documentAnalyses.cvId, cvId))
      .orderBy(desc(documentAnalyses.version));
  } catch (error) {
    console.error(`Error getting analyses for CV ${cvId}:`, error);
    return [];
  }
}

/**
 * Migrate existing CV analyses from metadata to the new table
 * This function can be called to populate the new table with existing data
 */
export async function migrateExistingAnalyses(): Promise<number> {
  try {
    let migratedCount = 0;
    
    // Get all CVs with metadata
    const cvsWithMetadata = await db
      .select()
      .from(cvs)
      .where(
        and(
          isNotNull(cvs.metadata),
          not(eq(cvs.metadata, '{}')),
          not(eq(cvs.metadata, 'null'))
        )
      );
      
    console.log(`Found ${cvsWithMetadata.length} CVs with metadata to migrate`);
    
    // Migrate each CV's analysis data
    for (const cv of cvsWithMetadata) {
      try {
        if (!cv.metadata) continue;
        
        // Try to parse the metadata JSON
        let metadata;
        try {
          metadata = typeof cv.metadata === 'string' ? JSON.parse(cv.metadata) : cv.metadata;
        } catch (e) {
          console.error(`Error parsing metadata for CV ${cv.id}:`, e);
          continue;
        }
        
        // Check if metadata contains analysis data
        if (metadata.analysis || metadata.contentAnalysis || metadata.sentimentAnalysis) {
          // Extract the analysis data
          const analysisData = metadata.analysis || metadata;
          
          // Save to the new table
          await saveDocumentAnalysis(cv.id, analysisData, 'migrated');
          migratedCount++;
          console.log(`Migrated analysis data for CV ${cv.id}`);
        }
      } catch (cvError) {
        console.error(`Error migrating analysis for CV ${cv.id}:`, cvError);
      }
    }
    
    console.log(`Successfully migrated ${migratedCount} analysis records`);
    return migratedCount;
  } catch (error) {
    console.error("Error migrating existing analyses:", error);
    return 0;
  }
}

// If there's no db import available, we'll need to create the connectToDatabase function
async function connectToDatabase() {
  // If db is already imported, just return it
  if (typeof db !== 'undefined') {
    return db;
  }
  
  // Otherwise, create a new connection
  // This is a placeholder implementation - adjust based on your actual database setup
  try {
    // For PostgreSQL with node-postgres
    const { Pool } = require('pg');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Test the connection
    await pool.query('SELECT NOW()');
    console.log('Database connection established');
    
    return pool;
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    throw new Error('Database connection failed');
  }
}

/**
 * Get all documents for a specific user with pagination and filtering options
 * @param userId The ID of the user
 * @param options Optional pagination and filtering options
 * @returns Array of documents and total count
 */
export async function getAllUserDocuments(
  userId: string | number,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  try {
    // Set default options
    const {
      page = 1,
      limit = 100,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Connect to the database
    const db = await connectToDatabase();
    
    // Determine the table name based on your database structure
    // This assumes you have a 'documents' table, but you might have a different name
    const tableName = 'documents';
    
    // Build the query - adapt field names to match your actual database schema
    let query = `
      SELECT * FROM ${tableName} 
      WHERE "userId" = $1
    `;
    
    const queryParams = [userId];
    let paramIndex = 2;
    
    // Add search filter if provided
    if (search) {
      query += ` AND ("fileName" ILIKE $${paramIndex} OR "metadata" ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    // Add sorting - ensure the column name exists in your table
    // Use double quotes for column names to handle case sensitivity in PostgreSQL
    query += ` ORDER BY "${sortBy}" ${sortOrder.toUpperCase()}`;
    
    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);
    
    // Execute the query
    const result = await db.query(query, queryParams);
    const documents = result.rows || [];
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) FROM ${tableName} 
      WHERE "userId" = $1
      ${search ? ` AND ("fileName" ILIKE $2 OR "metadata" ILIKE $2)` : ''}
    `;
    
    const countParams = [userId];
    if (search) {
      countParams.push(`%${search}%`);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    
    return {
      documents,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  } catch (error) {
    console.error("Error fetching user documents:", error);
    // Return empty result with pagination info
    return {
      documents: [],
      totalCount: 0,
      page: options.page || 1,
      limit: options.limit || 100,
      totalPages: 0
    };
  }
}

// For backward compatibility, add a simpler version that just returns the documents
export async function getAllUserDocumentsSimple(userId: number) {
  try {
    const result = await getAllUserDocuments(userId);
    return result.documents;
  } catch (error) {
    console.error("Error in simple document fetch:", error);
    return [];
  }
}
