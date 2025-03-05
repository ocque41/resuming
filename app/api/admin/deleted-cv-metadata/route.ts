import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { deletedCvMetadata } from "@/lib/db/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";

// List of admin user IDs that can access this endpoint
const ADMIN_USER_IDS = ["admin1", "admin2"]; // Replace with actual admin IDs

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if the user is an admin - convert user.id to string for comparison
  if (!ADMIN_USER_IDS.includes(String(session.user.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build conditions array
    const conditions = [];
    
    if (userId) {
      conditions.push(eq(deletedCvMetadata.userId, userId));
    }

    if (startDate) {
      conditions.push(gte(deletedCvMetadata.deletedAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(deletedCvMetadata.deletedAt, new Date(endDate)));
    }

    // Execute query with all conditions
    const metadata = await db
      .select()
      .from(deletedCvMetadata)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(deletedCvMetadata.deletedAt))
      .limit(limit)
      .offset(offset);

    // Return metadata with pagination info
    return NextResponse.json({
      metadata,
      pagination: {
        limit,
        offset,
        hasMore: metadata.length === limit,
      }
    });
  } catch (error) {
    console.error("Error retrieving deleted CV metadata:", error);
    return NextResponse.json(
      { error: "Failed to retrieve deleted CV metadata" },
      { status: 500 }
    );
  }
} 