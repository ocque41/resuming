/**
 * Mock authentication utilities
 * This is a simplified implementation for development purposes
 */

import { NextRequest } from "next/server";

// Mock user type
export interface User {
  id: string;
  name?: string | null;
  email?: string | null;
}

// Mock session type
export interface Session {
  user: User;
  expires: string;
}

// Mock authentication options
export const authOptions = {
  providers: [
    {
      id: "credentials",
      name: "Credentials"
    }
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  callbacks: {
    session: async ({ session, token }: any) => {
      return session;
    }
  }
};

/**
 * Get the current user from the request
 * For development, this always returns a mock user
 */
export async function getUser(req?: NextRequest): Promise<User | null> {
  // In a real implementation, this would verify the session token
  // For development, we'll return a mock user
  return {
    id: "mock-user-id",
    name: "Mock User",
    email: "mock@example.com"
  };
}

/**
 * Get the current session
 * For development, this always returns a mock session
 */
export async function getSession(): Promise<Session | null> {
  const user = await getUser();
  if (!user) return null;
  
  return {
    user,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
}

/**
 * Check if a user is authenticated
 * For development, this always returns true
 */
export async function isAuthenticated(req?: NextRequest): Promise<boolean> {
  const user = await getUser(req);
  return !!user;
}

/**
 * Mock PrismaAdapter function
 * This is a placeholder that doesn't actually use Prisma
 */
export function PrismaAdapter() {
  return {
    createUser: async (data: any) => {
      return {
        id: "mock-user-id",
        ...data
      };
    },
    getUser: async (id: string) => {
      return {
        id,
        name: "Mock User",
        email: "mock@example.com"
      };
    },
    getUserByEmail: async (email: string) => {
      return {
        id: "mock-user-id",
        name: "Mock User",
        email
      };
    },
    updateUser: async (data: any) => {
      return {
        id: "mock-user-id",
        ...data
      };
    },
    deleteUser: async (id: string) => {
      return { id };
    }
  };
} 