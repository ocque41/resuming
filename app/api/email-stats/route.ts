import { NextRequest, NextResponse } from 'next/server';
import { getEmailStatistics, checkEmailDelivery } from '@/lib/email/monitor';
import { checkAuth, isAdmin } from '@/lib/auth/check-auth';

/**
 * GET handler for email statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const session = await checkAuth();
    const adminStatus = await isAdmin();
    
    if (!session || !adminStatus) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    // Get email ID from query params for specific email check
    const emailId = request.nextUrl.searchParams.get('emailId');
    
    if (emailId) {
      // Check delivery status for a specific email
      const deliveryStatus = await checkEmailDelivery(emailId);
      return NextResponse.json({ 
        success: true, 
        emailId, 
        deliveryStatus 
      });
    } else {
      // Get overall statistics
      const stats = await getEmailStatistics();
      return NextResponse.json({ 
        success: true, 
        stats 
      });
    }
  } catch (error) {
    console.error('[API] Error fetching email statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve email statistics' },
      { status: 500 }
    );
  }
} 