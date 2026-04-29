import { createContext, useContext } from 'react';

export interface AuthState {
  signedIn: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthState>({
  signedIn: false,
  email: null,
  signIn: async () => {},
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);
