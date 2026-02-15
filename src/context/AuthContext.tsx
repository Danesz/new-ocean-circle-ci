import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { CircleCIClient } from '../api/circleci';
import type { User } from '../types/circleci';

interface AuthState {
  token: string | null;
  projectSlug: string | null;
  user: User | null;
  client: CircleCIClient | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, projectSlug: string) => Promise<void>;
  logout: () => void;
  setProjectSlug: (slug: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY_TOKEN = 'ocean-ci-token';
const STORAGE_KEY_PROJECT = 'ocean-ci-project';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const projectSlug = localStorage.getItem(STORAGE_KEY_PROJECT);
    return {
      token,
      projectSlug,
      user: null,
      client: token ? new CircleCIClient(token) : null,
    };
  });

  // Validate saved token on mount
  useEffect(() => {
    if (state.client && !state.user) {
      state.client.getMe().then(
        (user) => setState((s) => ({ ...s, user })),
        () => {
          // Token invalid, clear it
          localStorage.removeItem(STORAGE_KEY_TOKEN);
          setState({ token: null, projectSlug: null, user: null, client: null });
        },
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (token: string, projectSlug: string) => {
    const client = new CircleCIClient(token);
    const user = await client.getMe();
    // Validate project access
    await client.getProject(projectSlug);

    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem(STORAGE_KEY_PROJECT, projectSlug);
    setState({ token, projectSlug, user, client });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_PROJECT);
    setState({ token: null, projectSlug: null, user: null, client: null });
  }, []);

  const setProjectSlug = useCallback((slug: string) => {
    localStorage.setItem(STORAGE_KEY_PROJECT, slug);
    setState((s) => ({ ...s, projectSlug: slug }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setProjectSlug }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
