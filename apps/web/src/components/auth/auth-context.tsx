"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type { MePerson } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface AuthUser {
  actor: { id: string; type: string; displayName: string; personalSpaceId?: string | null };
  person: MePerson | null;
  isSuperAdmin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

async function fetchUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as Partial<AuthUser>;
      return {
        actor: data.actor ?? { id: "", type: "unknown", displayName: "" },
        person: data.person ?? null,
        isSuperAdmin: Boolean(data.isSuperAdmin),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(await fetchUser());
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore network errors on sign-out
    }
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await fetchUser();
      if (!cancelled) {
        setUser(current);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export { API_URL };
