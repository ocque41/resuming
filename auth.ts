import NextAuth from "next-auth";
import { getSession } from "@/lib/auth/session";

// This is a simple adapter that uses our custom session management
export const { handlers, auth, signIn, signOut } = NextAuth({
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