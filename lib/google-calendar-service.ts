import AsyncStorage from "@react-native-async-storage/async-storage";
import { getValidAccessToken } from "./google-auth-service";
import { getAgendamentos, type Agendamento } from "./store";

// ─── Tipos e Constantes ─────────────────────────────────────────────────────────

export const MOBILION_CALENDAR_NAME = "Mobilion — Atendimentos";
const CALENDAR_ID_STORAGE_KEY = "@mobilion:google_calendar_id";
const CALENDAR_SYNC_MAP_KEY = "@mobilion:google_calendar_sync_map";

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string; // ISO 8601 com timezone
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

export interface AgendamentoCalendarSyncMapping {
  primaryEventId?: string;
  returnEventId?: string;
  lastSyncedAt: number;
}

export type CalendarSyncMap = Record<string, AgendamentoCalendarSyncMapping>;

// ─── Helpers de Armazenamento de Mapeamento ────────────────────────────────────

export async function loadCalendarSyncMap(): Promise<CalendarSyncMap> {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_SYNC_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("[GoogleCalendar] Erro ao carregar mapa de sincronização:", err);
    return {};
  }
}

export async function saveCalendarSyncMap(map: CalendarSyncMap): Promise<void> {
  try {
    await AsyncStorage.setItem(CALENDAR_SYNC_MAP_KEY, JSON.stringify(map));
  } catch (err) {
    console.error("[GoogleCalendar] Erro ao salvar mapa de sincronização:", err);
  }
}

// ─── Helpers de Construção de Data e Evento ───────────────────────────────────

export function calculateEventDateTime(dateStr: string, timeStr: string, durationMinutes = 120): { startIso: string; endIso: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = (timeStr || "09:00").split(":").map(Number);

  // Timezone padrão Brasil (São Paulo / UTC-3)
  const pad = (n: number) => String(n).padStart(2, "0");
  const startIso = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00-03:00`;

  // Calcular término
  const startDate = new Date(year, month - 1, day, hours, minutes);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const endIso = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00-03:00`;

  return { startIso, endIso };
}

function buildPrimaryEventDescription(agendamento: Agendamento): string {
  const lines = [
    `🔨 SERVIÇO MOBILION: ${agendamento.tipoServico}`,
    `👤 Cliente: ${agendamento.clienteNome}`,
    `📞 Telefone: ${agendamento.clienteTelefone}`,
    `📍 Endereço: ${agendamento.endereco || "Não informado"}`,
    `💰 Valor do serviço: R$ ${agendamento.valor.toFixed(2)}`,
    `📊 Status: ${agendamento.status.toUpperCase()}`,
  ];

  if (agendamento.moveis && agendamento.moveis.length > 0) {
    lines.push("\n📦 MÓVEIS / ITENS:");
    for (const m of agendamento.moveis) {
      lines.push(` • ${m.quantidade}x ${m.servicoNome} (R$ ${m.valor.toFixed(2)})${m.observacao ? ` - Obs: ${m.observacao}` : ""}`);
    }
  }

  if (agendamento.temRetorno) {
    lines.push(`\n🔁 SERVIÇO COM RETORNO/MONTAGEM PROGRAMADA:`);
    lines.push(` • Data Retorno: ${agendamento.dataRetorno || "A definir"}`);
    lines.push(` • Horário: ${agendamento.horaRetorno || "A definir"}`);
    lines.push(` • Endereço Retorno: ${agendamento.enderecoRetorno || agendamento.endereco || "Mesmo endereço"}`);
  }

  if (agendamento.descricao) {
    lines.push(`\n📝 Observações gerais:\n${agendamento.descricao}`);
  }

  lines.push(`\n--- ID Mobilion: ${agendamento.id} ---`);
  return lines.join("\n");
}

function buildReturnEventDescription(agendamento: Agendamento): string {
  const lines = [
    `🔁 ETAPA 2 - RETORNO / MONTAGEM: ${agendamento.tipoServico}`,
    `👤 Cliente: ${agendamento.clienteNome}`,
    `📞 Telefone: ${agendamento.clienteTelefone}`,
    `📍 Endereço de Retorno: ${agendamento.enderecoRetorno || agendamento.endereco || "Não informado"}`,
    `💰 Orçamento Geral: R$ ${agendamento.valor.toFixed(2)}`,
    `📅 Atendimento Inicial: ${agendamento.data} às ${agendamento.hora}`,
    `\n--- Vinculado ao Atendimento Mobilion ID: ${agendamento.id} ---`,
  ];
  return lines.join("\n");
}

// ─── Operações na Google Calendar API ─────────────────────────────────────────

/**
 * Localiza ou cria o calendário exclusivo "Mobilion — Atendimentos".
 */
export async function getOrCreateMobilionCalendar(): Promise<string> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Conta Google não conectada. Faça login com a conta da Mobilion.");
  }

  // Verificar cache local
  const cachedId = await AsyncStorage.getItem(CALENDAR_ID_STORAGE_KEY);
  if (cachedId) {
    // Validar se o calendário ainda existe no Google
    try {
      const checkRes = await fetch(
        `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(cachedId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkRes.ok) {
        return cachedId;
      }
    } catch {
      // Ignora e faz busca
    }
  }

  // Listar calendários do usuário
  const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listRes.ok) {
    throw new Error(`Falha ao listar calendários do Google: ${listRes.status}`);
  }

  const listData = await listRes.json();
  const items = listData.items || [];
  const existing = items.find((c: any) => c.summary === MOBILION_CALENDAR_NAME && !c.deleted);

  if (existing?.id) {
    await AsyncStorage.setItem(CALENDAR_ID_STORAGE_KEY, existing.id);
    return existing.id;
  }

  // Criar o calendário "Mobilion — Atendimentos"
  console.log(`[GoogleCalendar] Criando calendário dedicado '${MOBILION_CALENDAR_NAME}'...`);
  const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: MOBILION_CALENDAR_NAME,
      timeZone: "America/Sao_Paulo",
      description: "Agendamentos e atendimentos de montagem de móveis da Mobilion Assistente.",
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    console.error("[GoogleCalendar] Erro ao criar calendário:", createRes.status, errorText);
    throw new Error(`Não foi possível criar o calendário do Google: ${createRes.status}`);
  }

  const newCal = await createRes.json();
  await AsyncStorage.setItem(CALENDAR_ID_STORAGE_KEY, newCal.id);
  return newCal.id;
}

/**
 * Cria ou atualiza evento na Google Calendar API.
 */
async function upsertCalendarEvent(
  calendarId: string,
  eventId: string | undefined,
  eventData: GoogleCalendarEvent,
  token: string
): Promise<string | null> {
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  if (eventId) {
    // Atualizar evento existente (reagendamento ou edição)
    const updateRes = await fetch(`${baseUrl}/${encodeURIComponent(eventId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    });

    if (updateRes.ok) {
      const data = await updateRes.json();
      return data.id;
    }

    if (updateRes.status !== 404) {
      console.warn(`[GoogleCalendar] Erro ao atualizar evento ${eventId}:`, updateRes.status);
    }
    // Se 404, cai para criação
  }

  // Criar novo evento
  const createRes = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventData),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    console.error("[GoogleCalendar] Erro ao criar evento:", createRes.status, errorText);
    return null;
  }

  const data = await createRes.json();
  return data.id;
}

/**
 * Remove um evento da Google Calendar API.
 */
export async function deleteGoogleCalendarEvent(calendarId: string, eventId: string): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token || !eventId) return false;

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return res.status === 204 || res.status === 404;
  } catch (err) {
    console.error(`[GoogleCalendar] Falha ao deletar evento ${eventId}:`, err);
    return false;
  }
}

/**
 * Sincroniza um único agendamento com o Google Calendar.
 * Suporta desmontagem e montagem em datas diferentes (evento de retorno vinculado).
 * Evita duplicações consultando o mapa de sincronização.
 */
export async function syncAgendamentoToGoogleCalendar(
  agendamento: Agendamento,
  calendarId?: string
): Promise<{ primaryEventId?: string; returnEventId?: string; success: boolean }> {
  const token = await getValidAccessToken();
  if (!token) {
    return { success: false };
  }

  const calId = calendarId || (await getOrCreateMobilionCalendar());
  const syncMap = await loadCalendarSyncMap();
  const currentMapping = syncMap[agendamento.id] || { lastSyncedAt: 0 };

  // Tratamento de cancelamento: se o agendamento foi cancelado, remove os eventos da agenda
  if (agendamento.status === "cancelado") {
    if (currentMapping.primaryEventId) {
      await deleteGoogleCalendarEvent(calId, currentMapping.primaryEventId);
    }
    if (currentMapping.returnEventId) {
      await deleteGoogleCalendarEvent(calId, currentMapping.returnEventId);
    }
    delete syncMap[agendamento.id];
    await saveCalendarSyncMap(syncMap);
    return { success: true };
  }

  // 1. Preparar e sincronizar evento principal (Montagem ou Desmontagem)
  const { startIso, endIso } = calculateEventDateTime(agendamento.data, agendamento.hora);
  const primaryEventData: GoogleCalendarEvent = {
    summary: `${agendamento.tipoServico} — ${agendamento.clienteNome}`,
    description: buildPrimaryEventDescription(agendamento),
    location: agendamento.endereco || "",
    start: { dateTime: startIso, timeZone: "America/Sao_Paulo" },
    end: { dateTime: endIso, timeZone: "America/Sao_Paulo" },
    extendedProperties: {
      private: {
        mobilionAgendamentoId: agendamento.id,
        mobilionClienteId: agendamento.clienteId,
        mobilionRole: "primary",
      },
    },
  };

  const savedPrimaryId = await upsertCalendarEvent(
    calId,
    currentMapping.primaryEventId,
    primaryEventData,
    token
  );

  // 2. Preparar e sincronizar evento de Retorno (se aplicável)
  let savedReturnId: string | undefined = undefined;

  if (agendamento.temRetorno && agendamento.dataRetorno && agendamento.horaRetorno) {
    const returnTimes = calculateEventDateTime(agendamento.dataRetorno, agendamento.horaRetorno);
    const returnLocation = agendamento.enderecoRetorno || agendamento.endereco || "";

    const returnEventData: GoogleCalendarEvent = {
      summary: `🔁 Retorno / Montagem: ${agendamento.tipoServico} — ${agendamento.clienteNome}`,
      description: buildReturnEventDescription(agendamento),
      location: returnLocation,
      start: { dateTime: returnTimes.startIso, timeZone: "America/Sao_Paulo" },
      end: { dateTime: returnTimes.endIso, timeZone: "America/Sao_Paulo" },
      extendedProperties: {
        private: {
          mobilionAgendamentoId: agendamento.id,
          mobilionClienteId: agendamento.clienteId,
          mobilionRole: "return",
        },
      },
    };

    const res = await upsertCalendarEvent(
      calId,
      currentMapping.returnEventId,
      returnEventData,
      token
    );
    if (res) savedReturnId = res;
  } else if (currentMapping.returnEventId) {
    // Se tinha retorno antes e agora foi desmarcado, remove do calendário
    await deleteGoogleCalendarEvent(calId, currentMapping.returnEventId);
  }

  // Atualizar mapa de sincronização
  syncMap[agendamento.id] = {
    primaryEventId: savedPrimaryId || currentMapping.primaryEventId,
    returnEventId: savedReturnId,
    lastSyncedAt: Date.now(),
  };

  await saveCalendarSyncMap(syncMap);

  return {
    primaryEventId: syncMap[agendamento.id].primaryEventId,
    returnEventId: syncMap[agendamento.id].returnEventId,
    success: Boolean(savedPrimaryId),
  };
}

/**
 * Sincroniza todos os agendamentos cadastrados com o calendário "Mobilion — Atendimentos".
 */
export async function syncAllAgendamentosToGoogleCalendar(): Promise<{
  syncedCount: number;
  errorCount: number;
  totalAgendamentos: number;
  errors: string[];
}> {
  const agendamentos = await getAgendamentos();
  const token = await getValidAccessToken();

  if (!token) {
    throw new Error("Conta Google não conectada.");
  }

  const calendarId = await getOrCreateMobilionCalendar();
  let synced = 0;
  let errors: string[] = [];

  for (const ag of agendamentos) {
    try {
      const res = await syncAgendamentoToGoogleCalendar(ag, calendarId);
      if (res.success) {
        synced++;
      } else {
        errors.push(`Falha no agendamento #${ag.id} (${ag.clienteNome})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      errors.push(`Erro no agendamento #${ag.id}: ${msg}`);
    }
  }

  return {
    syncedCount: synced,
    errorCount: errors.length,
    totalAgendamentos: agendamentos.length,
    errors,
  };
}

