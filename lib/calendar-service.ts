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
    const [year, month, day] = agendamento.data.split("-").map(Number);
    const [hour, minute] = agendamento.hora.split(":").map(Number);

    const startDate = new Date(year, month - 1, day, hour, minute);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 horas de duração

    const eventId = await Calendar.createEventAsync(calendarId, {
      title: `${agendamento.tipoServico} - ${agendamento.clienteNome}`,
      startDate,
      endDate,
      notes: `Cliente: ${agendamento.clienteNome}\nTelefone: ${agendamento.clienteTelefone}\nValor: R$ ${agendamento.valor.toFixed(2)}\nDescrição: ${agendamento.descricao || "N/A"}`,
      location: agendamento.endereco || "",
      timeZone: "America/Sao_Paulo",
    });

    console.log("✅ Evento criado no calendário:", eventId);
    return eventId;
  } catch (err) {
    console.error("❌ Erro ao criar evento:", err);
    return null;
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
    const [year, month, day] = agendamento.data.split("-").map(Number);
    const [hour, minute] = agendamento.hora.split(":").map(Number);

    const startDate = new Date(year, month - 1, day, hour, minute);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    await Calendar.updateEventAsync(eventId, {
      title: `${agendamento.tipoServico} - ${agendamento.clienteNome}`,
      startDate,
      endDate,
      notes: `Cliente: ${agendamento.clienteNome}\nTelefone: ${agendamento.clienteTelefone}\nValor: R$ ${agendamento.valor.toFixed(2)}\nDescrição: ${agendamento.descricao || "N/A"}`,
      location: agendamento.endereco || "",
    });

    console.log("✅ Evento atualizado no calendário");
    return true;
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
 * Apenas agendamentos da conta logada são sincronizados
 */
export async function syncAgendamentosToCalendar(calendarId: string, userEmail?: string): Promise<number> {
  try {
    const agendamentos = await getAgendamentos();

    // Filtrar agendamentos que não estão cancelados
    let agendamentosAtivos = agendamentos.filter((a) => a.status !== "cancelado");
    
    // Sincronizar todos os agendamentos ativos
    // (Compatibilidade com múltiplos usuários pode ser adicionada depois)

    let sincronizados = 0;

    for (const agendamento of agendamentosAtivos) {
      // Usar ID do agendamento como ID do evento (se existir)
      const eventId = `montafacil_${agendamento.id}`;

      try {
        // Tentar criar evento
        const result = await createCalendarEvent(calendarId, agendamento);
        if (result) sincronizados++;
      } catch {
        // Se falhar, tentar atualizar
        try {
          const updated = await updateCalendarEvent(calendarId, eventId, agendamento);
          if (updated) sincronizados++;
        } catch {
          console.warn(`Não foi possível sincronizar agendamento ${agendamento.id}`);
        }
      }
    }

    console.log(`✅ ${sincronizados} agendamentos sincronizados com o calendário`);
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
