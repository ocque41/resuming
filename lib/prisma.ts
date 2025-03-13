/**
 * Mock Prisma client implementation
 * This is a simplified implementation for development purposes
 */

// Mock User type
export interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  emailVerified?: Date | null;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Mock CV type
export interface CV {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// Mock Prisma client
class MockPrismaClient {
  user = {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
      // Mock implementation that always returns a user
      return {
        id: where.id || 'mock-user-id',
        name: 'Mock User',
        email: where.email || 'mock@example.com',
        emailVerified: new Date(),
        image: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as User;
    },
    create: async ({ data }: { data: Partial<User> }) => {
      return {
        id: 'mock-user-id',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      } as User;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
      return {
        id: where.id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      } as User;
    }
  };

  cv = {
    findUnique: async ({ where }: { where: { id: string } }) => {
      // Mock implementation that always returns a CV
      return {
        id: where.id,
        userId: 'mock-user-id',
        title: 'Mock CV',
        content: 'This is a mock CV content for development purposes.',
        createdAt: new Date(),
        updatedAt: new Date()
      } as CV;
    },
    findMany: async ({ where }: { where: { userId: string } }) => {
      // Mock implementation that returns an array with one CV
      return [
        {
          id: 'mock-cv-id',
          userId: where.userId,
          title: 'Mock CV',
          content: 'This is a mock CV content for development purposes.',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ] as CV[];
    },
    create: async ({ data }: { data: Partial<CV> }) => {
      return {
        id: 'mock-cv-id',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      } as CV;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<CV> }) => {
      return {
        id: where.id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      } as CV;
    }
  };
}

// Export a singleton instance of the mock client
export const prisma = new MockPrismaClient(); 