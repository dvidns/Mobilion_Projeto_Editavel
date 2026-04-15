import { useEffect, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { getAgendamentos, type Agendamento } from "@/lib/store";

// Configurar o handler de notificações recebidas
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Hook para gerenciar notificações de lembrete 1 hora antes de cada agendamento
 * Verifica a cada minuto se há agendamentos próximos e agenda notificações
 */
export function useNotifications() {
  // Solicitar permissão de notificações
  const requestPermission = useCallback(async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === "granted";
    } catch (err) {
      console.error("Erro ao solicitar permissão de notificações:", err);
      return false;
    }
  }, []);

  // Agendar notificação de lembrete
  const scheduleReminder = useCallback(async (agendamento: Agendamento) => {
    try {
      const [year, month, day] = agendamento.data.split("-").map(Number);
      const [hour, minute] = agendamento.hora.split(":").map(Number);

      // Data e hora do serviço
      const servicoTime = new Date(year, month - 1, day, hour, minute);

      // 1 hora antes
      const lembreteTime = new Date(servicoTime.getTime() - 60 * 60 * 1000);
      const agora = new Date();

      // Se o lembrete já passou, não agenda
      if (lembreteTime <= agora) {
        return;
      }

      // Calcular segundos até o lembrete
      const segundosAte = Math.floor((lembreteTime.getTime() - agora.getTime()) / 1000);

      if (segundosAte > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Lembrete de Serviço",
            body: `Serviço de ${agendamento.tipoServico} com ${agendamento.clienteNome} em 1 hora (${agendamento.hora})`,
            data: { agendamentoId: agendamento.id },
          },
          trigger: {
            seconds: segundosAte,
          } as any,
        });
      }
    } catch (err) {
      console.error("Erro ao agendar notificação:", err);
    }
  }, []);

  // Verificar e agendar lembretes para todos os agendamentos
  const checkAndScheduleReminders = useCallback(async () => {
    try {
      const agendamentos = await getAgendamentos();
      const hoje = new Date().toISOString().split("T")[0];

      // Filtrar agendamentos de hoje e amanhã
      const agendamentosProximos = agendamentos.filter((a) => {
        const dataAgendamento = a.data;
        return dataAgendamento >= hoje && a.status !== "concluido" && a.status !== "cancelado";
      });

      for (const agendamento of agendamentosProximos) {
        await scheduleReminder(agendamento);
      }
    } catch (err) {
      console.error("Erro ao verificar agendamentos:", err);
    }
  }, [scheduleReminder]);

  // Inicializar: solicitar permissão e agendar lembretes
  useEffect(() => {
    requestPermission().then(() => {
      checkAndScheduleReminders();
    });

    // Verificar a cada 5 minutos
    const interval = setInterval(() => {
      checkAndScheduleReminders();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [requestPermission, checkAndScheduleReminders]);

  return { checkAndScheduleReminders };
}
