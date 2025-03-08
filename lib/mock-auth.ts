// Mock implementation of clerk auth for development
export function auth() {
  return {
    userId: 'mock-user-id'
  };
}

export async function currentUser() {
  return {
    id: 'mock-user-id',
    firstName: 'Mock',
    lastName: 'User',
    emailAddresses: [
      {
        emailAddress: 'mock@example.com'
      }
    ]
  };
} 