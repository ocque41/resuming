import NextAuth from "next-auth";
import { getSession } from "@/lib/auth/session";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Session } from "next-auth";

// Extend the built-in session type
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    }
  }
}

// This is a simple adapter that uses our custom session management
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Use Credentials provider as a placeholder since we're using a custom system
    CredentialsProvider({
      name: "Custom Auth",
      credentials: {
        // This won't actually be used as we're using our custom session
      },
      async authorize() {
        // The actual authorization is handled by our custom session system
        return { id: "1" }; // Just a placeholder
      }
    })
  ],
  callbacks: {
    async session({ session }) {
      // Get the custom session from our auth system
      const customSession = await getSession();
      
      if (customSession && customSession.user) {
        // Add the user ID to the session
        session.user = {
          ...session.user,
          id: customSession.user.id.toString()
        };
      }
      
      return session;
    }
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in"
  }
});

// Export the auth function for use in API routes
export default auth; 