import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AsyncStorage
const storage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
      return Promise.resolve();
    }),
  },
}));

// Mock google-auth-service
vi.mock("../lib/google-auth-service", () => ({
  getValidAccessToken: vi.fn(async () => "mock-google-calendar-token"),
}));

import {
  MOBILION_CALENDAR_NAME,
  calculateEventDateTime,
  loadCalendarSyncMap,
  saveCalendarSyncMap,
  syncAgendamentoToGoogleCalendar,
} from "../lib/google-calendar-service";
import type { Agendamento } from "../lib/store";

describe("google-calendar-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(storage).forEach((k) => delete storage[k]);
  });

  it("deve definir o nome oficial do calendário como 'Mobilion — Atendimentos'", () => {
    expect(MOBILION_CALENDAR_NAME).toBe("Mobilion — Atendimentos");
  });

  it("deve calcular data de início e término com fuso horário correto", () => {
    const { startIso, endIso } = calculateEventDateTime("2026-11-10", "14:30", 120);
    expect(startIso).toContain("2026-11-10T14:30:00-03:00");
    expect(endIso).toContain("2026-11-10T16:30:00-03:00");
  });

  it("deve carregar e salvar mapa de sincronização sem duplicações", async () => {
    const initialMap = await loadCalendarSyncMap();
    expect(initialMap).toEqual({});

    await saveCalendarSyncMap({
      "ag-123": {
        primaryEventId: "google-event-1",
        returnEventId: "google-event-2",
        lastSyncedAt: 123456789,
      },
    });

    const updated = await loadCalendarSyncMap();
    expect(updated["ag-123"]?.primaryEventId).toBe("google-event-1");
    expect(updated["ag-123"]?.returnEventId).toBe("google-event-2");
  });

  it("deve remover evento do mapa e da agenda ao cancelar agendamento", async () => {
    // Simular que já existe evento mapeado
    await saveCalendarSyncMap({
      "ag-cancel": {
        primaryEventId: "ev-prim-99",
        returnEventId: "ev-ret-99",
        lastSyncedAt: 1000,
      },
    });

    // Mock fetch global para interceptar DELETE
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      return {
        ok: true,
        status: 204,
        json: async () => ({}),
      } as any;
    });

    const agendamentoCancelado: Agendamento = {
      id: "ag-cancel",
      clienteId: "c1",
      clienteNome: "João Silva",
      clienteTelefone: "11999998888",
      data: "2026-11-15",
      hora: "10:00",
      tipoServico: "Montagem de Guarda-roupa",
      valor: 200,
      status: "cancelado",
      criadoEm: "2026-11-01T10:00:00.000Z",
    };

    const res = await syncAgendamentoToGoogleCalendar(agendamentoCancelado, "cal-mobilion-id");
    expect(res.success).toBe(true);

    const mapAfter = await loadCalendarSyncMap();
    expect(mapAfter["ag-cancel"]).toBeUndefined();

    fetchSpy.mockRestore();
  });
});

