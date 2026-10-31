import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Concluir sessões web pendentes (necessário para Android / iOS)
WebBrowser.maybeCompleteAuthSession();

// ─── Tipos e Interfaces ─────────────────────────────────────────────────────────

export interface GoogleUserProfile {
  id: string;
  email: string;
  verifiedEmail: boolean;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  locale?: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Timestamp em milissegundos
  tokenType: string;
  scope: string;
  idToken?: string;
}

export interface GoogleAuthState {
  isAuthenticated: boolean;
  user: GoogleUserProfile | null;
  tokens: GoogleTokens | null;
  loading: boolean;
  error: string | null;
}

// ─── Configurações e Constantes ───────────────────────────────────────────────

const STORAGE_KEYS = {
  tokens: "@mobilion:google_tokens",
  user: "@mobilion:google_user",
  autoSync: "@mobilion:google_auto_sync",
};

export const GOOGLE_OAUTH_CONFIG = {
  // Discovery endpoints do Google OAuth 2.0
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  userInfoEndpoint: "https://www.googleapis.com/oauth2/v2/userinfo",

  // Escopos solicitados (mínimos e específicos conforme regras de negócio)
  scopes: [
    "openid",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/gmail.send",
  ],

  // Client IDs configuráveis por variável de ambiente
  getClientId: (): string => {
    if (Platform.OS === "android") {
      return (
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID ||
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
        // ID padrão para desenvolvimento/testes
        "310519663438-mobilion-assistente-android.apps.googleusercontent.com"
      );
    }
    if (Platform.OS === "ios") {
      return (
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ||
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
        "310519663438-mobilion-assistente-ios.apps.googleusercontent.com"
      );
    }
    return (
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ||
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
      "310519663438-mobilion-assistente-web.apps.googleusercontent.com"
    );
  },
};

// ─── Helpers PKCE ─────────────────────────────────────────────────────────────

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateCodeVerifier(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  let binary = "";
  for (let i = 0; i < randomBytes.length; i++) {
    binary += String.fromCharCode(randomBytes[i]);
  }
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return toBase64Url(base64);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return toBase64Url(digest);
}

export function getRedirectUri(): string {
  const scheme = Constants.expoConfig?.scheme || "mobilion";
  const finalScheme = Array.isArray(scheme) ? scheme[0] : scheme;
  return Linking.createURL("oauth/google", { scheme: finalScheme });
}

// ─── Armazenamento Seguro ─────────────────────────────────────────────────────

async function secureSave(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (err) {
    console.error(`[GoogleAuth] Erro ao salvar chave segura ${key}:`, err);
  }
}

async function secureGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.error(`[GoogleAuth] Erro ao obter chave segura ${key}:`, err);
    return null;
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (err) {
    console.error(`[GoogleAuth] Erro ao deletar chave segura ${key}:`, err);
  }
}

// ─── Funções Principais de Autenticação ───────────────────────────────────────

/**
 * Obtém os tokens atualmente armazenados.
 */
export async function getStoredTokens(): Promise<GoogleTokens | null> {
  const raw = await secureGet(STORAGE_KEYS.tokens);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Obtém o perfil do usuário atualmente armazenado.
 */
export async function getStoredUserProfile(): Promise<GoogleUserProfile | null> {
  const raw = await secureGet(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Salva tokens e usuário.
 */
export async function saveAuthData(tokens: GoogleTokens, user: GoogleUserProfile): Promise<void> {
  await Promise.all([
    secureSave(STORAGE_KEYS.tokens, JSON.stringify(tokens)),
    secureSave(STORAGE_KEYS.user, JSON.stringify(user)),
  ]);
}

/**
 * Desconecta a conta Google e remove todos os tokens locais.
 */
export async function logoutGoogle(): Promise<void> {
  try {
    const tokens = await getStoredTokens();
    if (tokens?.accessToken) {
      // Opcional: revoga no Google
      try {
        await fetch(`${GOOGLE_OAUTH_CONFIG.revocationEndpoint}?token=${tokens.accessToken}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } catch {
        // Ignora erro de rede na revogação
      }
    }
  } finally {
    await Promise.all([
      secureDelete(STORAGE_KEYS.tokens),
      secureDelete(STORAGE_KEYS.user),
    ]);
  }
}

/**
 * Busca perfil do usuário no Google People/OAuth2 endpoint usando o access token.
 */
export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch(GOOGLE_OAUTH_CONFIG.userInfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter perfil Google: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    email: data.email,
    verifiedEmail: Boolean(data.verified_email),
    name: data.name || data.email,
    givenName: data.given_name,
    familyName: data.family_name,
    picture: data.picture,
    locale: data.locale,
  };
}

/**
 * Renova o access token usando o refresh token caso esteja prestes a expirar.
 */
export async function refreshGoogleTokenIfNeeded(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  const now = Date.now();
  // Se ainda for válido por pelo menos 5 minutos (300.000 ms), reutiliza
  if (tokens.expiresAt && tokens.expiresAt - now > 5 * 60 * 1000) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    console.warn("[GoogleAuth] Sem refresh token disponível; requer novo login.");
    return tokens.accessToken; // Tenta usar o que tem
  }

  try {
    const clientId = GOOGLE_OAUTH_CONFIG.getClientId();
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    });

    const response = await fetch(GOOGLE_OAUTH_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error("[GoogleAuth] Erro ao renovar token:", response.status);
      return null;
    }

    const data = await response.json();
    const newTokens: GoogleTokens = {
      ...tokens,
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      idToken: data.id_token || tokens.idToken,
    };

    await secureSave(STORAGE_KEYS.tokens, JSON.stringify(newTokens));
    return newTokens.accessToken;
  } catch (err) {
    console.error("[GoogleAuth] Exceção ao renovar token:", err);
    return null;
  }
}

/**
 * Obtém um access token garantidamente válido para as requisições às APIs do Google.
 */
export async function getValidAccessToken(): Promise<string | null> {
  return await refreshGoogleTokenIfNeeded();
}

/**
 * Inicia o fluxo completo de autenticação Google com PKCE via WebBrowser.
 * Seguro, compatível com Expo e sem expor segredos.
 */
export async function signInWithGoogle(): Promise<{ user: GoogleUserProfile; tokens: GoogleTokens }> {
  const clientId = GOOGLE_OAUTH_CONFIG.getClientId();
  const redirectUri = getRedirectUri();
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = await generateCodeVerifier(); // Estado aleatório para proteção CSRF

  const authUrl = new URL(GOOGLE_OAUTH_CONFIG.authorizationEndpoint);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_OAUTH_CONFIG.scopes.join(" "));
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent select_account");

  console.log("[GoogleAuth] Abrindo navegador para autenticação:", redirectUri);

  const result = await WebBrowser.openAuthSessionAsync(authUrl.toString(), redirectUri);

  if (result.type !== "success" || !result.url) {
    if (result.type === "cancel" || result.type === "dismiss") {
      throw new Error("Autenticação cancelada pelo usuário.");
    }
    throw new Error(`Falha no fluxo de autenticação: ${result.type}`);
  }

  // Parse dos parâmetros retornados na URL de redirecionamento
  const parsedUrl = Linking.parse(result.url);
  const params = parsedUrl.queryParams || {};
  const code = params.code as string | undefined;
  const returnedState = params.state as string | undefined;
  const error = params.error as string | undefined;

  if (error) {
    throw new Error(`Erro retornado pelo Google: ${error}`);
  }

  if (!code) {
    throw new Error("Código de autorização não recebido na resposta do Google.");
  }

  if (returnedState && returnedState !== state) {
    throw new Error("Aviso de segurança: parâmetro state não confere (possível CSRF).");
  }

  // Troca do authorization code por tokens com o code_verifier (PKCE)
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch(GOOGLE_OAUTH_CONFIG.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error("[GoogleAuth] Erro ao trocar código por token:", errorBody);
    throw new Error(`Falha na troca de código por token: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  const tokens: GoogleTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
    tokenType: tokenData.token_type || "Bearer",
    scope: tokenData.scope || GOOGLE_OAUTH_CONFIG.scopes.join(" "),
    idToken: tokenData.id_token,
  };

  // Obter perfil do usuário autenticado
  const user = await fetchGoogleUserProfile(tokens.accessToken);

  // Persistir credenciais de forma segura
  await saveAuthData(tokens, user);

  return { user, tokens };
}

