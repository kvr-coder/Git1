import { createContext, useContext } from 'react';

export interface AuthState {
  signedIn: boolean;
  email: string | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  signedIn: false,
  email: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
