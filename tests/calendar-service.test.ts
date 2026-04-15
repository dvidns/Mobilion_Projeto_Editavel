import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => {
  const getItem = vi.fn();
  const setItem = vi.fn();
  const removeItem = vi.fn();
  return {
    default: {
      getItem,
      setItem,
      removeItem,
    },
  };
});

vi.mock("expo-calendar", () => ({
  createEventAsync: vi.fn(),
  updateEventAsync: vi.fn(),
  deleteEventAsync: vi.fn(),
  getCalendarsAsync: vi.fn(),
  requestCalendarPermissionsAsync: vi.fn(),
  EntityTypes: { EVENT: "event" },
}));

vi.mock("../lib/store", () => ({
  getAgendamentos: vi.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { getAgendamentos } from "../lib/store";
import { syncAgendamentosToCalendar } from "../lib/calendar-service";

const mockedAsyncStorage = vi.mocked(AsyncStorage, true);
const mockedCalendar = vi.mocked(Calendar, true);
const mockedGetAgendamentos = vi.mocked(getAgendamentos, true);

beforeEach(() => {
  mockedAsyncStorage.getItem.mockReset();
  mockedAsyncStorage.setItem.mockReset();
  mockedAsyncStorage.removeItem.mockReset();
  mockedCalendar.createEventAsync.mockReset();
  mockedCalendar.updateEventAsync.mockReset();
  mockedCalendar.deleteEventAsync.mockReset();
  mockedGetAgendamentos.mockReset();
});

describe("calendar-service sync", () => {
  it("creates events and stores calendar IDs for new agendamentos", async () => {
    mockedGetAgendamentos.mockResolvedValue([
      {
        id: "a1",
        clienteId: "c1",
        clienteNome: "Pedro",
        clienteTelefone: "11999999999",
        data: "2025-12-25",
        hora: "09:00",
        tipoServico: "Guarda-roupa 3 portas",
        descricao: "Montagem completa",
        endereco: "Rua A, 10",
        valor: 200,
        status: "pendente",
        criadoEm: "2025-01-01",
        temRetorno: true,
        dataRetorno: "2025-12-26",
        horaRetorno: "14:00",
        enderecoRetorno: "Rua B, 11",
      },
    ]);
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedCalendar.createEventAsync.mockResolvedValueOnce("event-1").mockResolvedValueOnce("event-2");

    const count = await syncAgendamentosToCalendar("calendar-123");

    expect(count).toBe(2);
    expect(mockedCalendar.createEventAsync).toHaveBeenCalledTimes(2);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      "@montafacil:calendar_event_ids",
      expect.stringContaining('"agendamento_a1":"event-1"')
    );
    expect(setItem).toHaveBeenCalledWith(
      "@montafacil:calendar_event_ids",
      expect.stringContaining('"retorno_a1":"event-2"')
    );
  });

  it("updates existing calendar events when IDs are already stored", async () => {
    mockedGetAgendamentos.mockResolvedValue([
      {
        id: "a2",
        clienteId: "c2",
        clienteNome: "Ana",
        clienteTelefone: "11888888888",
        data: "2025-12-27",
        hora: "10:00",
        tipoServico: "Cama de casal",
        descricao: "Montagem rápida",
        endereco: "Rua C, 20",
        valor: 150,
        status: "confirmado",
        criadoEm: "2025-01-02",
      },
    ]);
    mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify({ agendamento_a2: "event-3" }));
    mockedCalendar.updateEventAsync.mockResolvedValue(undefined);

    const count = await syncAgendamentosToCalendar("calendar-456");

    expect(count).toBe(1);
    expect(mockedCalendar.updateEventAsync).toHaveBeenCalledTimes(1);
    expect(mockedCalendar.createEventAsync).not.toHaveBeenCalled();
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      "@montafacil:calendar_event_ids",
      expect.stringContaining('"agendamento_a2":"event-3"')
    );
  });

  it("removes canceled events from the calendar mapping", async () => {
    mockedGetAgendamentos.mockResolvedValue([
      {
        id: "a3",
        clienteId: "c3",
        clienteNome: "João",
        clienteTelefone: "11777777777",
        data: "2025-12-28",
        hora: "11:00",
        tipoServico: "Guarda-roupa 2 portas",
        valor: 120,
        status: "cancelado",
        criadoEm: "2025-01-03",
      },
    ]);
    mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify({ agendamento_a3: "event-4", retorno_a3: "event-5" }));
    mockedCalendar.deleteEventAsync.mockResolvedValue(undefined);

    const count = await syncAgendamentosToCalendar("calendar-789");

    expect(count).toBe(0);
    expect(mockedCalendar.deleteEventAsync).toHaveBeenCalledTimes(2);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("@montafacil:calendar_event_ids", "{}");
  });
});
