import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks de dependências nativas para ambiente de testes
vi.mock("expo-modules-core", () => ({
  EventEmitter: class {
    addListener() { return { remove: vi.fn() }; }
    removeAllListeners() {}
    emit() {}
  },
  NativeModulesProxy: {},
  Platform: { OS: "android" },
  requireNativeModule: vi.fn(() => ({})),
  requireOptionalNativeModule: vi.fn(() => null),
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { scheme: "mobilion" },
  },
}));

vi.mock("expo-secure-store", () => {
  let store: Record<string, string> = {};
  return {
    getItemAsync: vi.fn(async (key: string) => store[key] ?? null),
    setItemAsync: vi.fn(async (key: string, val: string) => {
      store[key] = val;
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      delete store[key];
    }),
  };
});

vi.mock("expo-crypto", () => ({
  getRandomBytesAsync: vi.fn(async (len: number) => new Uint8Array(len).fill(42)),
  digestStringAsync: vi.fn(async () => "mocked-sha256-hash"),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  CryptoEncoding: { BASE64: "BASE64" },
}));

vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}));

vi.mock("expo-linking", () => ({
  createURL: vi.fn((path: string, options: any) => `${options?.scheme || "mobilion"}://${path}`),
  parse: vi.fn((url: string) => ({ queryParams: {} })),
}));

import type { GoogleTokens, GoogleUserProfile } from "../lib/google-auth-service";
import {
  GOOGLE_OAUTH_CONFIG,
  getStoredTokens,
  getStoredUserProfile,
  saveAuthData,
  logoutGoogle,
  refreshGoogleTokenIfNeeded,
  getRedirectUri,
} from "../lib/google-auth-service";

describe("google-auth-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve conter os escopos necessários e endpoints corretos do Google", () => {
    expect(GOOGLE_OAUTH_CONFIG.authorizationEndpoint).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(GOOGLE_OAUTH_CONFIG.tokenEndpoint).toBe("https://oauth2.googleapis.com/token");
    expect(GOOGLE_OAUTH_CONFIG.scopes).toContain("https://www.googleapis.com/auth/contacts.readonly");
    expect(GOOGLE_OAUTH_CONFIG.scopes).toContain("https://www.googleapis.com/auth/calendar");
    expect(GOOGLE_OAUTH_CONFIG.scopes).toContain("https://www.googleapis.com/auth/drive.file");
  });

  it("deve gerar o redirectUri esperado", () => {
    const uri = getRedirectUri();
    expect(uri).toContain("oauth/google");
  });

  it("deve salvar e recuperar tokens e perfil com segurança", async () => {
    const mockUser: GoogleUserProfile = {
      id: "google-123",
      email: "atendimento.mobilio@gmail.com",
      verifiedEmail: true,
      name: "Mobilion Atendimento",
    };

    const mockTokens: GoogleTokens = {
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresAt: Date.now() + 3600 * 1000,
      tokenType: "Bearer",
      scope: "openid profile email",
    };

    await saveAuthData(mockTokens, mockUser);

    const storedTokens = await getStoredTokens();
    const storedUser = await getStoredUserProfile();

    expect(storedTokens?.accessToken).toBe("mock-access-token");
    expect(storedTokens?.refreshToken).toBe("mock-refresh-token");
    expect(storedUser?.email).toBe("atendimento.mobilio@gmail.com");
  });

  it("deve reutilizar o access token se ainda estiver no prazo de validade", async () => {
    const mockTokens: GoogleTokens = {
      accessToken: "token-valido-ainda",
      refreshToken: "mock-refresh-token",
      expiresAt: Date.now() + 20 * 60 * 1000, // Válido por 20 minutos
      tokenType: "Bearer",
      scope: "openid",
    };

    const mockUser: GoogleUserProfile = {
      id: "u1",
      email: "test@example.com",
      verifiedEmail: true,
      name: "Test",
    };

    await saveAuthData(mockTokens, mockUser);

    const token = await refreshGoogleTokenIfNeeded();
    expect(token).toBe("token-valido-ainda");
  });

  it("deve limpar dados após logoutGoogle", async () => {
    await logoutGoogle();
    const storedTokens = await getStoredTokens();
    const storedUser = await getStoredUserProfile();

    expect(storedTokens).toBeNull();
    expect(storedUser).toBeNull();
  });
});
