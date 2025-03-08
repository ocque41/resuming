import { NextRequest, NextResponse } from 'next/server';

// Test importing auth
import { auth } from '@/auth';

// Test importing from optimizeCV
import { extractSections } from '@/lib/optimizeCV.fixed';

// Test importing from storage
import { getOriginalPdfBytes, extractTextFromPdf } from '@/lib/storage';

// Test importing from db
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Test auth
    const session = await auth();
    console.log("Auth test passed:", !!session);
    
    // Test db
    const dbTest = !!db && !!cvs;
    console.log("DB test passed:", dbTest);
    
    // Test extractSections function
    const sectionsTest = typeof extractSections === 'function';
    console.log("extractSections test passed:", sectionsTest);
    
    // Test storage functions
    const storageTest = typeof getOriginalPdfBytes === 'function' && typeof extractTextFromPdf === 'function';
    console.log("Storage functions test passed:", storageTest);
    
    // Return success
    return NextResponse.json({
      message: "Import tests completed",
      authTest: !!session,
      dbTest,
      sectionsTest,
      storageTest
    });
  } catch (error) {
    console.error("Error in test route:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Test failed: ${errorMessage}` }, { status: 500 });
  }
} 