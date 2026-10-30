import { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Contacts from "expo-contacts";

import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { useColors } from "@/hooks/use-colors";
import { getClientes, addCliente, deleteCliente, type Cliente } from "@/lib/store";

export default function ClientesScreen() {
  const colors = useColors();
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [importando, setImportando] = useState(false);

  const load = useCallback(async () => {
    const all = await getClientes();
    setClientes(all.sort((a, b) => a.nome.localeCompare(b.nome)));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtrados = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.telefone.includes(busca)
  );

  async function importarContatos() {
    if (Platform.OS === "web") {
      Alert.alert("Não disponível", "Importação de contatos não disponível no web.");
      return;
    }
    setImportando(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão negada", "Permita o acesso aos contatos nas configurações.");
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      const comTelefone = data.filter(
        (c) => c.phoneNumbers && c.phoneNumbers.length > 0 && c.name
      );

      if (comTelefone.length === 0) {
        Alert.alert("Nenhum contato", "Nenhum contato com telefone encontrado.");
        return;
      }

      // Show picker
      const existentes = new Set(clientes.map((c) => c.telefone));
      const novos = comTelefone.filter((c) => {
        const tel = c.phoneNumbers![0].number?.replace(/\D/g, "") ?? "";
        return !existentes.has(tel);
      });

      if (novos.length === 0) {
        Alert.alert("Todos importados", "Todos os contatos já foram importados.");
        return;
      }

      Alert.alert(
        "Importar contatos",
        `${novos.length} contato(s) novo(s) encontrado(s). Importar todos?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Importar todos",
            onPress: async () => {
              for (const c of novos) {
                const tel = c.phoneNumbers![0].number?.replace(/\D/g, "") ?? "";
                await addCliente({ nome: c.name!, telefone: tel });
              }
              load();
              Alert.alert("Pronto!", `${novos.length} contato(s) importado(s).`);
            },
          },
        ]
      );
    } catch {
      Alert.alert("Erro", "Não foi possível acessar os contatos.");
    } finally {
      setImportando(false);
    }
  }

  function confirmDelete(id: string, nome: string) {
    Alert.alert("Excluir cliente", `Excluir ${nome}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          await deleteCliente(id);
          load();
        },
      },
    ]);
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>Clientes</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
            onPress={importarContatos}
            activeOpacity={0.8}
            disabled={importando}
          >
            <MaterialIcons name="contacts" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: "#fff" }]}
            onPress={() => router.push("/cliente/novo" as any)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <MaterialIcons name="search" size={20} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Buscar cliente..."
          placeholderTextColor={colors.muted}
          value={busca}
          onChangeText={setBusca}
          returnKeyType="search"
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca("")} activeOpacity={0.7}>
            <MaterialIcons name="close" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="people-outline" size={52} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </Text>
            {!busca && (
              <View style={styles.emptyBtns}>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/cliente/novo" as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyBtnText}>+ Novo cliente</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.success }]}
                  onPress={importarContatos}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyBtnText}>Importar contatos</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/cliente/${item.id}` as any)}>
            <View style={styles.clientRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {item.nome.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.clientInfo}>
                <Text style={[styles.clientName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.nome}
                </Text>
                <Text style={[styles.clientPhone, { color: colors.muted }]}>
                  {item.telefone}
                </Text>
                {item.bairro ? (
                  <Text style={[styles.clientAddr, { color: colors.muted }]} numberOfLines={1}>
                    📍 {item.bairro}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => confirmDelete(item.id, item.nome)}
                activeOpacity={0.7}
                style={styles.deleteBtn}
              >
                <MaterialIcons name="delete-outline" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
          </Card>
        )}
      />
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
    fontSize: 20,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
  },
  clientInfo: {
    flex: 1,
    gap: 2,
  },
  clientName: {
    fontSize: 15,
    fontWeight: "600",
  },
  clientPhone: {
    fontSize: 13,
  },
  clientAddr: {
    fontSize: 12,
  },
  deleteBtn: {
    padding: 4,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  emptyBtns: {
    gap: 10,
    marginTop: 8,
    width: "100%",
    paddingHorizontal: 20,
  },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  emptyBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
