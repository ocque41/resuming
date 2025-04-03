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

    // Hardcoded Cognito configuration for testing
    const clientId = '2ch1vr3hl90lp2iaelstn8bmbs';
    const clientSecret = '1olkeuaficga2m3i7opf7lsftn223nb9tmrsoe106bvhl5u92kf6';
    const region = 'eu-north-1';

    console.log('Using hardcoded Cognito configuration for testing');

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

    console.log('Attempting to authenticate with Cognito');

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

    console.log('Cognito API response status:', response.status);

    // Parse the response
    const data = await response.json();

    // Check for errors
    if (!response.ok) {
      console.error('Cognito API error:', data);
      return NextResponse.json(
        { 
          error: data.__type || data.message || 'Authentication failed',
          detail: data.message || 'No detailed error provided',
          requestId: data.requestId
        },
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
      { 
        error: 'Internal server error',
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 