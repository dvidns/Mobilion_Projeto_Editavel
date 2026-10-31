import { useState, useEffect, useCallback } from "react";
import {
  GoogleUserProfile,
  GoogleTokens,
  getStoredUserProfile,
  getStoredTokens,
  signInWithGoogle,
  logoutGoogle,
  getValidAccessToken,
} from "@/lib/google-auth-service";

export interface UseGoogleAuthReturn {
  isAuthenticated: boolean;
  user: GoogleUserProfile | null;
  tokens: GoogleTokens | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

export function useGoogleAuth(): UseGoogleAuthReturn {
  const [user, setUser] = useState<GoogleUserProfile | null>(null);
  const [tokens, setTokens] = useState<GoogleTokens | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [storedUser, storedTokens] = await Promise.all([
        getStoredUserProfile(),
        getStoredTokens(),
      ]);
      setUser(storedUser);
      setTokens(storedTokens);
    } catch (err) {
      console.error("[useGoogleAuth] Erro ao carregar sessão:", err);
      setError("Falha ao recuperar dados da conta Google.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  const signIn = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const result = await signInWithGoogle();
      setUser(result.user);
      setTokens(result.tokens);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido ao entrar com Google";
      console.warn("[useGoogleAuth] Falha no login:", message);
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      await logoutGoogle();
      setUser(null);
      setTokens(null);
      setError(null);
    } catch (err) {
      console.error("[useGoogleAuth] Erro ao sair:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return await getValidAccessToken();
  }, []);

  return {
    isAuthenticated: Boolean(user && tokens?.accessToken),
    user,
    tokens,
    loading,
    error,
    signIn,
    signOut,
    refresh: loadAuth,
    getAccessToken,
  };
}

