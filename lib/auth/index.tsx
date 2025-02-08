'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from 'react';
import { User } from '@/lib/db/schema';

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
};

const UserContext = createContext<UserContextType | null>(null);

export function useUser(): UserContextType {
  let context = useContext(UserContext);
  if (context === null) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export function UserProvider({
  children,
  userPromise,
}: {
  children: ReactNode;
  userPromise: Promise<User | null>;
}) {
  let [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    userPromise.then(setUser);
  }, [userPromise]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}
