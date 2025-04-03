import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Calculates the SECRET_HASH required for Cognito authentication
 */
function calculateSecretHash(username: string, clientId: string, clientSecret: string): string {
  const message = username + clientId;
  const hmac = crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('base64');
  return hmac;
}

export async function POST(request: NextRequest) {
  try {
    // Get credentials from request body
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Get Cognito configuration from environment variables
    const clientId = process.env.COGNITO_CLIENT_ID;
    const clientSecret = process.env.COGNITO_CLIENT_SECRET;
    const region = process.env.COGNITO_REGION || 'eu-north-1';

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Cognito configuration is missing' },
        { status: 500 }
      );
    }

    // Calculate secret hash
    const secretHash = calculateSecretHash(username, clientId, clientSecret);

    // Set up the authentication request
    const authParams = {
      ClientId: clientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: secretHash
      }
    };

    // Call the Cognito API
    const response = await fetch(
      `https://cognito-idp.${region}.amazonaws.com/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
        },
        body: JSON.stringify(authParams)
      }
    );

    // Parse the response
    const data = await response.json();

    // Check for errors
    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Authentication failed' },
        { status: response.status }
      );
    }

    // Return authentication tokens
    return NextResponse.json({
      idToken: data.AuthenticationResult.IdToken,
      accessToken: data.AuthenticationResult.AccessToken,
      refreshToken: data.AuthenticationResult.RefreshToken,
      expiresIn: data.AuthenticationResult.ExpiresIn
    });
  } catch (error) {
    console.error('Error authenticating with Cognito:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 