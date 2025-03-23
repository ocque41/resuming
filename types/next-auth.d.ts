import { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's id. */
      id?: string;
      /** The user's admin status. */
      admin?: boolean;
      /** The user's email verification status. */
      emailVerified?: boolean;
    } & DefaultSession["user"];
  }
  
  interface User {
    /** The user's admin status. */
    admin?: boolean;
    /** The user's email verification status. */
    emailVerified?: boolean | Date;
  }
} 