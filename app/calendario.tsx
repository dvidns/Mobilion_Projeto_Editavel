import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Calendar from "expo-calendar";

import { ScreenContainer } from "@/components/screen-container";
import { Button } from "@/components/ui/button";
import { useColors } from "@/hooks/use-colors";
import {
  requestCalendarPermission,
  getAvailableCalendars,
  syncAgendamentosToCalendar,
  getDefaultCalendar,
} from "@/lib/calendar-service";
import { useAuth } from "@/hooks/use-auth";

export default function CalendarioScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<Calendar.Calendar | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    initializeCalendar();
  }, []);

  async function initializeCalendar() {
    try {
      setLoading(true);

      // Verificar permissão
      const hasPermissionResult = await requestCalendarPermission();
      setHasPermission(hasPermissionResult);

      if (hasPermissionResult) {
        // Obter calendários
        const cals = await getAvailableCalendars();
        setCalendars(cals);

        // Obter calendário padrão
        const defaultCal = await getDefaultCalendar();
        setSelectedCalendar(defaultCal);

        // Carregar último sync
        const lastSyncStr = localStorage.getItem("@montafacil:last_sync");
        if (lastSyncStr) {
          setLastSync(parseInt(lastSyncStr, 10));
        }
      }
    } catch (err) {
      console.error("Erro ao inicializar calendário:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!selectedCalendar) {
      Alert.alert("Erro", "Nenhum calendário selecionado.");
      return;
    }

    Alert.alert(
      "Sincronizar com Calendário?",
      `Seus agendamentos serão adicionados ao calendário "${selectedCalendar.title}".`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sincronizar",
          onPress: async () => {
            setSyncing(true);
            try {
              const count = await syncAgendamentosToCalendar(selectedCalendar.id, user?.email || "");
              setLastSync(Date.now());
              localStorage.setItem("@montafacil:last_sync", Date.now().toString());
              Alert.alert(
                "Sucesso!",
                `${count} agendamento(s) sincronizado(s) com o calendário.`
              );
            } catch (err) {
              Alert.alert("Erro", "Não foi possível sincronizar com o calendário.");
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Calendário</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!hasPermission) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Calendário</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.content}>
          <View style={[styles.permissionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name="lock" size={48} color={colors.error} />
            <Text style={[styles.permissionTitle, { color: colors.foreground }]}>
              Permissão Necessária
            </Text>
            <Text style={[styles.permissionDesc, { color: colors.muted }]}>
              Para sincronizar seus agendamentos com o Google Calendar, precisamos de acesso ao calendário do seu celular.
            </Text>
            <Button
              title="Conceder Permissão"
              onPress={initializeCalendar}
              variant="primary"
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sincronizar Calendário</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statusHeader}>
            <MaterialIcons name="event-available" size={28} color={colors.primary} />
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                Calendário Conectado
              </Text>
              <Text style={[styles.statusDesc, { color: colors.muted }]}>
                Seus agendamentos sincronizados
              </Text>
            </View>
          </View>

          {lastSync && (
            <View style={[styles.lastSyncRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.lastSyncLabel, { color: colors.muted }]}>
                Última sincronização
              </Text>
              <Text style={[styles.lastSyncValue, { color: colors.foreground }]}>
                {new Date(lastSync).toLocaleString("pt-BR")}
              </Text>
            </View>
          )}
        </View>

        {/* Seleção de Calendário */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>CALENDÁRIO</Text>

          {calendars.length > 0 ? (
            <View style={[styles.calendarList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {calendars.map((cal) => (
                <TouchableOpacity
                  key={cal.id}
                  style={[
                    styles.calendarItem,
                    selectedCalendar?.id === cal.id && { backgroundColor: colors.primary + "15" },
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => setSelectedCalendar(cal)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.calendarDot,
                      { backgroundColor: cal.color || colors.primary },
                    ]}
                  />
                  <View style={styles.calendarInfo}>
                    <Text style={[styles.calendarName, { color: colors.foreground }]}>
                      {cal.title}
                    </Text>
                    <Text style={[styles.calendarSource, { color: colors.muted }]}>
                      {cal.source?.name || "Local"}
                    </Text>
                  </View>
                  {selectedCalendar?.id === cal.id && (
                    <MaterialIcons name="check-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="calendar-today" size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Nenhum calendário encontrado
              </Text>
            </View>
          )}
        </View>

        {/* Ação de Sincronização */}
        <Button
          title={syncing ? "Sincronizando..." : "Sincronizar Agora"}
          onPress={handleSync}
          variant="primary"
          disabled={syncing || !selectedCalendar}
        />

        {/* Informações */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <MaterialIcons name="info" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.muted }]}>
              Seus agendamentos serão adicionados ao calendário selecionado. Você pode sincronizar quantas vezes quiser.
            </Text>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <MaterialIcons name="sync" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.muted }]}>
              A sincronização é unidirecional: seus agendamentos são enviados para o calendário, mas mudanças no calendário não são sincronizadas de volta.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  permissionDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  statusDesc: {
    fontSize: 12,
  },
  lastSyncRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  lastSyncLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  lastSyncValue: {
    fontSize: 12,
    fontWeight: "500",
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  calendarList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  calendarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  calendarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  calendarInfo: {
    flex: 1,
  },
  calendarName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  calendarSource: {
    fontSize: 11,
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
