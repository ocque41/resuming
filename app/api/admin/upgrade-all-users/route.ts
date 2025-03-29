import { NextRequest, NextResponse } from 'next/server';
import { ensureProPlanAccess } from '@/lib/db/scheduled-tasks/auto-upgrade';
import { getUser } from '@/lib/db/queries.server';

/**
 * API endpoint to manually trigger the auto-upgrade process
 * This requires admin access and can be called via a scheduled job
 */
export async function GET(request: NextRequest) {
  try {
    // Check for API key in header for automated calls
    const apiKey = request.headers.get('x-api-key');
    const isAutomatedCall = apiKey === process.env.ADMIN_API_KEY;
    
    if (!isAutomatedCall) {
      // For manual calls, require user authentication and admin status
      const user = await getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      // Check if user is an admin (assuming role field exists)
      if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }
    
    // Perform the upgrade
    const result = await ensureProPlanAccess();
    
    if (result.success) {
      return NextResponse.json({ 
        message: 'Auto-upgrade completed successfully',
        details: result.message
      });
    } else {
      return NextResponse.json({ 
        error: 'Auto-upgrade failed', 
        details: result.error 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in upgrade-all-users endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: String(error) 
    }, { status: 500 });
  }
} 