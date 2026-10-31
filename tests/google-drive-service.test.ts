import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock google-auth-service
vi.mock("../lib/google-auth-service", () => ({
  getValidAccessToken: vi.fn(async () => "mock-drive-token"),
  getStoredUserProfile: vi.fn(async () => ({
    id: "user-1",
    email: "atendimento.mobilio@gmail.com",
    name: "Mobilion",
    verifiedEmail: true,
  })),
}));

// Mock backup-service
vi.mock("../lib/backup-service", () => ({
  prepareBackupData: vi.fn(async () => ({
    timestamp: 1700000000000,
    version: "1.0.0",
    data: {
      clientes: [],
      agendamentos: [],
      orcamentos: [],
      avaliacaoLink: "https://maps.google.com",
    },
  })),
}));

import {
  getOrCreateDriveFolder,
  uploadBackupToGoogleDrive,
  listDriveBackups,
} from "../lib/google-drive-service";

describe("google-drive-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve localizar ou criar pasta no Google Drive", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      if (String(url).includes("/files?q=")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            files: [{ id: "folder-123", name: "Mobilion Backup" }],
          }),
        } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    });

    const folderId = await getOrCreateDriveFolder();
    expect(folderId).toBe("folder-123");

    fetchSpy.mockRestore();
  });

  it("deve realizar upload multipart de backup para o Google Drive", async () => {
    let capturedBody = "";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any, init: any) => {
      if (String(url).includes("/files?q=")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ files: [{ id: "folder-xyz" }] }),
        } as any;
      }
      if (String(url).includes("upload/drive/v3/files")) {
        capturedBody = init.body;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "file-drive-abc",
            name: "backup_mobilion.json",
          }),
        } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    });

    const res = await uploadBackupToGoogleDrive();
    expect(res.fileId).toBe("file-drive-abc");
    expect(capturedBody).toContain("folder-xyz");
    expect(capturedBody).toContain("Mobilion Assistente");

    fetchSpy.mockRestore();
  });
});
