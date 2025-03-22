import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Debug endpoint for checking environment variables on the server
 * SECURITY NOTE: This endpoint does not expose actual secret values, only presence/length
 */
export async function GET() {
  try {
    // Get environment information - DO NOT expose full secret values
    const env = process.env;
    
    // Safely get environment variable info without exposing secrets
    const getEnvInfo = (key: string) => {
      const value = env[key];
      return {
        exists: !!value,
        length: value?.length || 0,
        preview: value ? `${value.substring(0, 3)}...${value.substring(value.length - 3)}` : null,
        is_empty: value === ""
      };
    };
    
    // Current domain information
    const getHostInfo = () => {
      const vercelUrl = env.VERCEL_URL;
      const nextPublicVercelUrl = env.NEXT_PUBLIC_VERCEL_URL;
      const host = env.HOST;
      
      return {
        vercel_url: vercelUrl || null,
        next_public_vercel_url: nextPublicVercelUrl || null,
        host: host || null,
        is_vercel_deployment: !!vercelUrl,
        is_production: env.NODE_ENV === "production"
      };
    };
    
    // Get reCAPTCHA configuration info
    const recaptchaInfo = {
      site_key: getEnvInfo("NEXT_PUBLIC_RECAPTCHA_SITE_KEY"),
      secret_key: getEnvInfo("RECAPTCHA_SECRET_KEY"),
      is_properly_configured: !!(
        env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && 
        env.RECAPTCHA_SECRET_KEY &&
        env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.length > 30 &&
        env.RECAPTCHA_SECRET_KEY.length > 30
      )
    };
    
    return NextResponse.json({
      node_env: env.NODE_ENV || "not set",
      vercel_env: env.VERCEL_ENV || "not set",
      host_info: getHostInfo(),
      recaptcha: recaptchaInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in environment test endpoint:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 