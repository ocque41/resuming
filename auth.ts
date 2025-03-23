import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getSession } from "@/lib/auth/session";

// Extend the built-in session type
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      admin?: boolean;
    }
  }
}

// This is a simple adapter that uses our custom session management
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Use Credentials provider as a placeholder since we're using a custom system
    CredentialsProvider({
      name: "Custom Auth",
      credentials: {},
      async authorize() {
        // The actual authorization is handled by our custom session system
        return { id: "1" }; // Just a placeholder
      }
    })
  ],
  callbacks: {
    async session({ session }) {
      try {
        // Get the custom session from our auth system
        const customSession = await getSession();
        
        if (customSession && customSession.user) {
          // Add the user ID and admin status to the session
          session.user = {
            ...session.user,
            id: customSession.user.id.toString(),
            admin: customSession.user.admin || false
          };
        }
        
        return session;
      } catch (error) {
        console.error("Error in session callback:", error);
        return session;
      }
    }
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in"
  }
});

// Export the auth function for use in API routes
export default auth; 