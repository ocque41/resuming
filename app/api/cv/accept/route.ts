import { NextRequest, NextResponse } from "next/server";
// Import from our mock implementations
import { auth, currentUser } from "@/lib/mock-auth";
import { db } from "@/lib/mock-db";
import { cv } from "@/lib/mock-schema";
import { eq } from "drizzle-orm";
import { formatError } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { cvId } = body;
    
    if (!cvId) {
      return NextResponse.json(
        { error: "CV ID is required" },
        { status: 400 }
      );
    }
    
    // Check if CV exists and belongs to the user
    const cvRecord = await db.query.cv.findFirst({
      where: eq(cv.id, cvId),
    });
    
    if (!cvRecord) {
      return NextResponse.json(
        { error: "CV not found" },
        { status: 404 }
      );
    }
    
    if (cvRecord.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized: CV does not belong to this user" },
        { status: 403 }
      );
    }
    
    // Make sure the CV has been optimized
    if (!cvRecord.optimizedAt || !cvRecord.optimizedText) {
      return NextResponse.json(
        { error: "CV has not been optimized yet" },
        { status: 400 }
      );
    }
    
    // Update the CV to mark it as accepted
    await db
      .update(cv)
      .set({
        isOptimizationAccepted: true,
        updatedAt: new Date(),
      })
      .where(eq(cv.id, cvId));
    
    return NextResponse.json({
      success: true,
      message: "CV optimization accepted and saved successfully",
    });
  } catch (error) {
    console.error("Error accepting CV optimization:", error);
    return NextResponse.json(
      { error: formatError(error) },
      { status: 500 }
    );
  }
} 