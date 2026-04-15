import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { getAgendamentos, type Agendamento } from "@/lib/store";

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes: string;
  location?: string;
}

const CALENDAR_EVENT_MAP_KEY = "@montafacil:calendar_event_ids";

interface CalendarSyncEntry {
  key: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes: string;
  location?: string;
}

async function loadCalendarEventMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_EVENT_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Erro ao carregar mapa de eventos do calendário:", err);
    return {};
  }
}

async function saveCalendarEventMap(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(CALENDAR_EVENT_MAP_KEY, JSON.stringify(map));
  } catch (err) {
    console.error("Erro ao salvar mapa de eventos do calendário:", err);
  }
}

function buildCalendarNotes(agendamento: Agendamento): string {
  return `Cliente: ${agendamento.clienteNome}\nTelefone: ${agendamento.clienteTelefone}\nValor: R$ ${agendamento.valor.toFixed(2)}\nDescrição: ${agendamento.descricao || "N/A"}`;
}

function buildSyncEntries(agendamento: Agendamento): CalendarSyncEntry[] {
  const [year, month, day] = agendamento.data.split("-").map(Number);
  const [hour, minute] = agendamento.hora.split(":").map(Number);
  const startDate = new Date(year, month - 1, day, hour, minute);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  const entries: CalendarSyncEntry[] = [
    {
      key: `agendamento_${agendamento.id}`,
      title: `${agendamento.tipoServico} - ${agendamento.clienteNome}`,
      startDate,
      endDate,
      notes: buildCalendarNotes(agendamento),
      location: agendamento.endereco || "",
    },
  ];

  if (agendamento.temRetorno && agendamento.dataRetorno && agendamento.horaRetorno) {
    const [returnYear, returnMonth, returnDay] = agendamento.dataRetorno.split("-").map(Number);
    const [returnHour, returnMinute] = agendamento.horaRetorno.split(":").map(Number);
    const returnStartDate = new Date(returnYear, returnMonth - 1, returnDay, returnHour, returnMinute);
    const returnEndDate = new Date(returnStartDate.getTime() + 2 * 60 * 60 * 1000);

    entries.push({
      key: `retorno_${agendamento.id}`,
      title: `🔁 Retorno - ${agendamento.tipoServico}`,
      startDate: returnStartDate,
      endDate: returnEndDate,
      notes: `${buildCalendarNotes(agendamento)}\nEndereço de retorno: ${agendamento.enderecoRetorno || agendamento.endereco || "N/A"}`,
      location: agendamento.enderecoRetorno || agendamento.endereco || "",
    });
  }

  return entries;
}

/**
 * Solicitar permissão para acessar calendário
 */
export async function requestCalendarPermission(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === "granted";
  } catch (err) {
    console.error("Erro ao solicitar permissão:", err);
    return false;
  }
}

/**
 * Obter calendários disponíveis
 */
export async function getAvailableCalendars(): Promise<Calendar.Calendar[]> {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars;
  } catch (err) {
    console.error("Erro ao obter calendários:", err);
    return [];
  }
}

/**
 * Criar evento no calendário
 */
export async function createCalendarEvent(
  calendarId: string,
  agendamento: Agendamento
): Promise<string | null> {
  try {
    const entries = buildSyncEntries(agendamento);
    const entry = entries[0];

    const eventId = await Calendar.createEventAsync(calendarId, {
      title: entry.title,
      startDate: entry.startDate,
      endDate: entry.endDate,
      notes: entry.notes,
      location: entry.location || "",
      timeZone: "America/Sao_Paulo",
    });

    console.log("✅ Evento criado no calendário:", eventId);
    return eventId;
  } catch (err) {
    console.error("❌ Erro ao criar evento:", err);
    return null;
  }
}

async function createCalendarEntry(calendarId: string, entry: CalendarSyncEntry): Promise<string | null> {
  try {
    const eventId = await Calendar.createEventAsync(calendarId, {
      title: entry.title,
      startDate: entry.startDate,
      endDate: entry.endDate,
      notes: entry.notes,
      location: entry.location || "",
      timeZone: "America/Sao_Paulo",
    });

    return eventId;
  } catch (err) {
    console.error("❌ Erro ao criar evento de calendário:", err);
    return null;
  }
}

async function updateCalendarEntry(calendarId: string, eventId: string, entry: CalendarSyncEntry): Promise<boolean> {
  try {
    await Calendar.updateEventAsync(eventId, {
      title: entry.title,
      startDate: entry.startDate,
      endDate: entry.endDate,
      notes: entry.notes,
      location: entry.location || "",
      timeZone: "America/Sao_Paulo",
    });
    return true;
  } catch (err) {
    console.error("❌ Erro ao atualizar evento de calendário:", err);
    return false;
  }
}

/**
 * Atualizar evento no calendário
 */
export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  agendamento: Agendamento
): Promise<boolean> {
  try {
    const entries = buildSyncEntries(agendamento);
    const entry = entries[0];

    return await updateCalendarEntry(calendarId, eventId, entry);
  } catch (err) {
    console.error("❌ Erro ao atualizar evento:", err);
    return false;
  }
}

/**
 * Deletar evento do calendário
 */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    await Calendar.deleteEventAsync(eventId);
    console.log("✅ Evento deletado do calendário");
    return true;
  } catch (err) {
    console.error("❌ Erro ao deletar evento:", err);
    return false;
  }
}

/**
 * Sincronizar todos os agendamentos com calendário
 * Apenas agendamentos não cancelados são sincronizados
 */
export async function syncAgendamentosToCalendar(calendarId: string, userEmail?: string): Promise<number> {
  try {
    const agendamentos = await getAgendamentos();
    const eventMap = await loadCalendarEventMap();
    let sincronizados = 0;

    for (const agendamento of agendamentos) {
      const entries = buildSyncEntries(agendamento);

      if (agendamento.status === "cancelado") {
        for (const entry of entries) {
          const mappedEventId = eventMap[entry.key];
          if (mappedEventId) {
            await deleteCalendarEvent(mappedEventId);
            delete eventMap[entry.key];
          }
        }
        continue;
      }

      for (const entry of entries) {
        const mappedEventId = eventMap[entry.key];
        let synced = false;

        if (mappedEventId) {
          synced = await updateCalendarEntry(calendarId, mappedEventId, entry);
          if (!synced) {
            const created = await createCalendarEntry(calendarId, entry);
            if (created) {
              eventMap[entry.key] = created;
              synced = true;
            }
          }
        } else {
          const created = await createCalendarEntry(calendarId, entry);
          if (created) {
            eventMap[entry.key] = created;
            synced = true;
          }
        }

        if (synced) {
          sincronizados += 1;
        }
      }
    }

    await saveCalendarEventMap(eventMap);
    console.log(`✅ ${sincronizados} eventos sincronizados com o calendário`);
    return sincronizados;
  } catch (err) {
    console.error("❌ Erro ao sincronizar agendamentos:", err);
    return 0;
  }
}

/**
 * Obter calendário padrão do sistema
 */
export async function getDefaultCalendar(): Promise<Calendar.Calendar | null> {
  try {
    const calendars = await getAvailableCalendars();

    // Tentar encontrar calendário "Calendar" ou "Calendário"
    let defaultCalendar = calendars.find(
      (c) => c.title === "Calendar" || c.title === "Calendário"
    );

    // Se não encontrar, usar o primeiro disponível
    if (!defaultCalendar && calendars.length > 0) {
      defaultCalendar = calendars[0];
    }

    return defaultCalendar || null;
  } catch (err) {
    console.error("Erro ao obter calendário padrão:", err);
    return null;
  }
}
