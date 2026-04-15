import { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, FlatList,
  TextInput, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Contacts from "expo-contacts";
import DateTimePicker from "@react-native-community/datetimepicker";

import { ScreenContainer } from "@/components/screen-container";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { useColors } from "@/hooks/use-colors";
import {
  addAgendamento, getClientes, addCliente, getServicos, addServico,
  type Cliente, type Servico,
} from "@/lib/store";

// Componente memoizado para item de contato
const ContatoItem = memo(({ item, clientes, colors, onPress }: {
  item: Contacts.Contact;
  clientes: Cliente[];
  colors: any;
  onPress: (contato: Contacts.Contact) => void;
}) => {
  const tel = item.phoneNumbers?.[0]?.number?.replace(/\D/g, "") ?? "";
  const jaCadastrado = clientes.some(c => c.telefone === tel);
  return (
    <TouchableOpacity
      style={[styles.contatoItem, { borderBottomColor: colors.border }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.contatoAvatar, { backgroundColor: colors.primary + "15" }]}>
        <Text style={[styles.contatoAvatarText, { color: colors.primary }]}>
          {(item.name ?? "?").charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.contatoInfo}>
        <Text style={[styles.contatoNome, { color: colors.foreground }]}>{item.name ?? "Sem nome"}</Text>
        <Text style={[styles.contatoTel, { color: colors.muted }]}>
          {item.phoneNumbers?.[0]?.number ?? ""}
        </Text>
      </View>
      {jaCadastrado && (
        <View style={[styles.jaCadastradoBadge, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.jaCadastradoText, { color: colors.primary }]}>Cadastrado</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// Tipo para item de móvel/serviço no agendamento
interface ItemMovel {
  id: string;
  servicoId: string;
  servicoNome: string;
  valor: string;
  quantidade: number;
  temRetorno?: boolean;
  dataRetorno?: string;
  horaRetorno?: string;
  enderecoRetorno?: string;
}

// Componente memoizado para item de móvel
const MovelItem = memo(({ movel, index, colors, onUpdateQuantidade, onRemove }: {
  movel: ItemMovel;
  index: number;
  colors: any;
  onUpdateQuantidade: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
}) => {
  const valorUnitario = parseFloat(movel.valor || "0");
  const valorTotal = valorUnitario * movel.quantidade;
  return (
    <View
      style={[styles.movelItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.movelNome, { color: colors.foreground }]}>
          {movel.servicoNome}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
          <TouchableOpacity
            onPress={() => onUpdateQuantidade(index, -1)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="remove-circle-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.movelQtd, { color: colors.foreground }]}>
            {movel.quantidade}x
          </Text>
          <TouchableOpacity
            onPress={() => onUpdateQuantidade(index, 1)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="add-circle-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.movelValor, { color: colors.muted, marginTop: 4 }]}>
          R$ {valorUnitario.toFixed(2)} → R$ {valorTotal.toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => onRemove(index)}
        activeOpacity={0.7}
      >
        <MaterialIcons name="close" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
});

export default function NovoAgendamentoScreen() {
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(null);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("08:00");
  const [endereco, setEndereco] = useState("");
  const [valor, setValor] = useState("");
  const [quantidadeMovel, setQuantidadeMovel] = useState("1");
  const [descricao, setDescricao] = useState("");

  const [moveis, setMoveis] = useState<ItemMovel[]>([]);
  const [temRetorno, setTemRetorno] = useState(false);
  const [dataRetorno, setDataRetorno] = useState("");
  const [horaRetorno, setHoraRetorno] = useState("08:00");
  const [enderecoRetorno, setEnderecoRetorno] = useState("");
  const [servicoCustomizado, setServicoCustomizado] = useState("");
  const [mostraInputCustomizado, setMostraInputCustomizado] = useState(false);

  // Modal states
  const [modalCliente, setModalCliente] = useState(false);
  const [modalServico, setModalServico] = useState(false);
  const [modalHora, setModalHora] = useState(false);
  const [modalContatos, setModalContatos] = useState(false);
  const [horaCustomizada, setHoraCustomizada] = useState("");
  const [mostraInputHora, setMostraInputHora] = useState(false);
  const [modalRetorno, setModalRetorno] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<"hora" | "retorno">("hora");

  // Contact search state
  const [contatosBusca, setContatosBusca] = useState("");
  const [contatosLista, setContatosLista] = useState<Contacts.Contact[]>([]);
  const [carregandoContatos, setCarregandoContatos] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getClientes().then(setClientes);
    getServicos().then(setServicos);
  }, []);

  // Memoizar cores para evitar re-renders
  const colors = useColors();

  const timePickerDisplay = Platform.OS === "android" ? "clock" : "spinner";

  // Memoizar contatos filtrados
  const contatosFiltrados = useMemo(() => {
    return contatosBusca.trim()
      ? contatosLista.filter(
          (c) =>
            c.name?.toLowerCase().includes(contatosBusca.toLowerCase()) ||
            c.phoneNumbers?.[0]?.number?.includes(contatosBusca)
        )
      : contatosLista;
  }, [contatosBusca, contatosLista]);

  // ── Abrir picker de contato único ─────────────────────────────────────────
  const abrirPickerContato = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Não disponível", "Importação de contatos não disponível no navegador.");
      return;
    }
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão negada", "Permita o acesso aos contatos nas configurações do celular.");
      return;
    }
    setCarregandoContatos(true);
    setContatosBusca("");
    try {
      const { data: todos } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      const comTel = todos.filter(
        (c) => c.name && c.phoneNumbers && c.phoneNumbers.length > 0
      );
      setContatosLista(comTel);
      setModalContatos(true);
    } catch {
      Alert.alert("Erro", "Não foi possível acessar os contatos.");
    } finally {
      setCarregandoContatos(false);
    }
  }, []);

  // ── Selecionar contato e criar/reusar cliente ─────────────────────────────
  const selecionarContato = useCallback(async (contato: Contacts.Contact) => {
    const tel = contato.phoneNumbers![0].number?.replace(/\D/g, "") ?? "";
    const nome = contato.name!;
    // Tentar extrair endereço do contato (se disponível)
    const enderecoDoPerfil = contato.addresses?.[0]?.street || "";

    // Verificar se já existe na lista de clientes
    const existente = clientes.find((c) => c.telefone === tel || c.nome === nome);
    if (existente) {
      setClienteSelecionado(existente);
      // Se o cliente existente não tem endereço, usar o do contato
      if (!existente.endereco && enderecoDoPerfil) {
        setEndereco(enderecoDoPerfil);
      }
    } else {
      // Criar novo cliente automaticamente
      const novo = await addCliente({ nome, telefone: tel, endereco: enderecoDoPerfil });
      setClientes((prev) => [...prev, novo]);
      setClienteSelecionado(novo);
      if (enderecoDoPerfil) {
        setEndereco(enderecoDoPerfil);
      }
    }
    setModalContatos(false);
  }, [clientes]);

  // ── Filtrar contatos pela busca ───────────────────────────────────────────
  // Removido: agora usa useMemo acima

  // ── Registrar novo serviço na tabela de preços ──────────────────────────────
  const registrarNovoServico = useCallback(async (nome: string, valor: number) => {
    try {
      await addServico({
        nome,
        categoria: "Customizado",
        valorMin: valor,
        valorMax: valor,
        valorSugerido: valor,
      });
      // Recarregar lista de serviços
      const updated = await getServicos();
      setServicos(updated);
      console.log("✅ Novo serviço registrado:", nome);
    } catch (error) {
      console.error("❌ Erro ao registrar serviço:", error);
    }
  }, []);

  // ── Salvar agendamento ────────────────────────────────────────────────────
  const salvar = useCallback(async () => {
    if (!clienteSelecionado) { Alert.alert("Atenção", "Selecione um cliente."); return; }
    
    // Se não há móveis adicionados, mas há serviço selecionado, adicionar automaticamente
    let moveisParaSalvar = moveis;
    if (moveis.length === 0 && servicoSelecionado && valor) {
      const quantidadeInicial = Math.max(1, parseInt(quantidadeMovel, 10) || 1);
      const novoMovel: ItemMovel = {
        id: Math.random().toString(36).slice(2),
        servicoId: servicoSelecionado.id,
        servicoNome: servicoSelecionado.nome,
        valor: valor,
        quantidade: quantidadeInicial,
      };
      moveisParaSalvar = [novoMovel];
    }
    
    if (moveisParaSalvar.length === 0) { Alert.alert("Atenção", "Adicione pelo menos um móvel/serviço."); return; }
    if (!data) { Alert.alert("Atenção", "Informe a data."); return; }
    if (!hora) { Alert.alert("Atenção", "Informe a hora."); return; }
    if (temRetorno && !dataRetorno) { Alert.alert("Atenção", "Informe a data do retorno."); return; }
    if (temRetorno && !horaRetorno) { Alert.alert("Atenção", "Informe a hora do retorno."); return; }

    // Calcular valor total dos móveis
    const valorTotal = moveisParaSalvar.reduce((sum, movel) => {
      const valor = parseFloat((movel.valor || "0").replace(",", "."));
      return sum + (valor * movel.quantidade);
    }, 0);

    if (valorTotal <= 0) { Alert.alert("Atenção", "Valor total deve ser maior que zero."); return; }

    // Dividir 50/50 se houver retorno
    const valorAgendamento = temRetorno ? valorTotal / 2 : valorTotal;
    const valorRetorno = temRetorno ? valorTotal / 2 : 0;

    setSaving(true);
    try {
      // Se for serviço customizado, registrar na tabela de preços
      if (servicoSelecionado && servicoSelecionado.categoria === "Customizado" && valorAgendamento > 0) {
        await registrarNovoServico(servicoSelecionado.nome, valorAgendamento);
      }
      
      await addAgendamento({
        clienteId: clienteSelecionado.id,
        clienteNome: clienteSelecionado.nome,
        clienteTelefone: clienteSelecionado.telefone,
        data,
        hora,
        tipoServico: servicoSelecionado?.nome || moveisParaSalvar[0]?.servicoNome || "Serviço",
        descricao,
        endereco,
        valor: valorAgendamento,
        moveis: moveisParaSalvar as any,
        status: "pendente",
        temRetorno,
        dataRetorno: temRetorno ? dataRetorno : undefined,
        horaRetorno: temRetorno ? horaRetorno : undefined,
        enderecoRetorno: temRetorno ? enderecoRetorno : undefined,
      });
      router.back();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      Alert.alert("Erro", "Não foi possível salvar o agendamento.");
    } finally {
      setSaving(false);
    }
  }, [clienteSelecionado, moveis, servicoSelecionado, valor, quantidadeMovel, data, hora, descricao, endereco, temRetorno, dataRetorno, horaRetorno, enderecoRetorno, router]);

  // Callbacks para otimizar re-renders
  const handleUpdateQuantidade = useCallback((index: number, delta: number) => {
    setMoveis(prev => {
      const updated = [...prev];
      if (updated[index].quantidade + delta > 0) {
        updated[index].quantidade += delta;
      }
      return updated;
    });
  }, []);

  const handleRemoveMovel = useCallback((index: number) => {
    setMoveis(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddMovel = useCallback(() => {
    if (!servicoSelecionado || !valor) return;
    const quantidade = Math.max(1, parseInt(quantidadeMovel, 10) || 1);
    const novoMovel: ItemMovel = {
      id: Math.random().toString(36).slice(2),
      servicoId: servicoSelecionado.id,
      servicoNome: servicoSelecionado.nome,
      valor,
      quantidade,
    };
    setMoveis(prev => [...prev, novoMovel]);
    setQuantidadeMovel("1");
  }, [servicoSelecionado, valor, quantidadeMovel]);

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Agendamento</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

        {/* ── CLIENTE ─────────────────────────────────────────────────────── */}
        <Text style={[styles.label, { color: colors.muted }]}>Cliente *</Text>

        {/* Botões de origem do cliente */}
        <View style={styles.clienteOpcoes}>
          {/* Opção 1: buscar nos já cadastrados */}
          <TouchableOpacity
            style={[
              styles.clienteOpcaoBtn,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            onPress={() => setModalCliente(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="people" size={20} color={colors.primary} />
            <Text style={[styles.clienteOpcaoText, { color: colors.foreground }]}>
              Clientes{"\n"}cadastrados
            </Text>
          </TouchableOpacity>

          {/* Opção 2: buscar nos contatos do celular */}
          <TouchableOpacity
            style={[
              styles.clienteOpcaoBtn,
              { borderColor: colors.primary, backgroundColor: colors.primary + "10" },
            ]}
            onPress={abrirPickerContato}
            activeOpacity={0.8}
            disabled={carregandoContatos}
          >
            <MaterialIcons name="contact-phone" size={20} color={colors.primary} />
            <Text style={[styles.clienteOpcaoText, { color: colors.primary }]}>
              {carregandoContatos ? "Carregando..." : "Buscar no\ncelular"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cliente selecionado */}
        {clienteSelecionado ? (
          <View style={[styles.clienteSelecionado, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
            <View style={[styles.clienteAvatar, { backgroundColor: colors.primary + "25" }]}>
              <Text style={[styles.clienteAvatarText, { color: colors.primary }]}>
                {clienteSelecionado.nome.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.clienteInfo}>
              <Text style={[styles.clienteNome, { color: colors.foreground }]}>
                {clienteSelecionado.nome}
              </Text>
              <Text style={[styles.clienteTel, { color: colors.muted }]}>
                {clienteSelecionado.telefone}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setClienteSelecionado(null)}
              activeOpacity={0.7}
              style={styles.clienteClear}
            >
              <MaterialIcons name="close" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.clienteHint, { color: colors.muted }]}>
            Nenhum cliente selecionado
          </Text>
        )}

        {/* ── SERVIÇO ─────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <Text style={[styles.label, { color: colors.muted }]}>Tipo de Serviço *</Text>
        </View>
        <TouchableOpacity
          style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => setModalServico(true)}
          activeOpacity={0.8}
        >
          <Text style={[styles.pickerText, { color: servicoSelecionado ? colors.foreground : colors.muted }]}>
            {servicoSelecionado ? servicoSelecionado.nome : "Selecionar serviço..."}
          </Text>
          <MaterialIcons name="expand-more" size={22} color={colors.muted} />
        </TouchableOpacity>

        {/* ── DATA ────────────────────────────────────────────────────────── */}
        <DatePicker
          label="Data *"
          value={data}
          onChange={setData}
        />

        {/* ── HORA ────────────────────────────────────────────────────────── */}
        <Text style={[styles.label, { color: colors.muted }]}>Horário *</Text>
        <TouchableOpacity
          style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => {
            setTimePickerMode("hora");
            setShowTimePicker(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.pickerText, { color: colors.foreground }]}>{hora}</Text>
          <MaterialIcons name="access-time" size={22} color={colors.muted} />
        </TouchableOpacity>
        <Text style={[styles.hint, { color: colors.muted, fontSize: 11 }]}>
          Toque para selecionar o horário
        </Text>

        {/* ── ENDEREÇO ────────────────────────────────────────────────────── */}
        <Input
          label="Endereço / Bairro"
          value={endereco}
          onChangeText={setEndereco}
          placeholder="Rua, número, bairro..."
        />

        {/* ── VALOR ───────────────────────────────────────────────────────── */}
        <Input
          label="Valor (R$) *"
          value={valor}
          onChangeText={setValor}
          placeholder="0,00"
          keyboardType="decimal-pad"
        />

        <View style={styles.movelConfigRow}>
          <View style={styles.movelQtdBox}>
            <Text style={[styles.label, { color: colors.muted }]}>Quantidade</Text>
            <TextInput
              value={quantidadeMovel}
              onChangeText={(text) => setQuantidadeMovel(text.replace(/\D/g, ""))}
              keyboardType="number-pad"
              style={[styles.input, styles.movelQtdInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="1"
              placeholderTextColor={colors.muted}
            />
          </View>

          <TouchableOpacity
            style={[styles.addMovelActionBtn, { backgroundColor: colors.primary }]}
            onPress={handleAddMovel}
            activeOpacity={0.8}
            disabled={!servicoSelecionado || !valor}
          >
            <MaterialIcons name="playlist-add" size={20} color="#fff" />
            <Text style={styles.addMovelActionText}>Adicionar à lista</Text>
          </TouchableOpacity>
        </View>

        {servicoSelecionado && (
          <Text style={[styles.hint, { color: colors.muted }]}>
            Referência: R$ {servicoSelecionado.valorMin} – R$ {servicoSelecionado.valorMax}
          </Text>
        )}

        {/* ── LISTA DE MÓVEIS ADICIONAIS ──────────────────────────────────── */}
        {moveis.length > 0 && (
          <View style={{ marginTop: 16, marginBottom: 12 }}>
            <Text style={[styles.label, { color: colors.muted }]}>Móveis/Serviços Adicionais</Text>
            {moveis.map((movel, idx) => (
              <MovelItem
                key={movel.id}
                movel={movel}
                index={idx}
                colors={colors}
                onUpdateQuantidade={handleUpdateQuantidade}
                onRemove={handleRemoveMovel}
              />
            ))}
          </View>
        )}

        {/* ── BOTÃO ADICIONAR MÓVEL ───────────────────────────────────────────────────── */}
        {servicoSelecionado && valor && moveis.length > 0 && (
          <TouchableOpacity
            style={[styles.addMovelBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}
            onPress={handleAddMovel}
            activeOpacity={0.7}
          >
            <MaterialIcons name="add-circle-outline" size={22} color={colors.primary} />
            <Text style={[styles.addMovelText, { color: colors.primary }]}>
              {moveis.length === 0 ? "Adicionar móvel/serviço" : "Adicionar outro móvel/serviço"}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── OBSERVAÇÕES ─────────────────────────────────────────────────── */}
        <Input
          label="Observações"
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Detalhes do serviço..."
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
        />

        {/* ── RETORNO PARA FINALIZAR ──────────────────────────────────────── */}
        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => setTemRetorno(!temRetorno)}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: temRetorno ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {temRetorno && <MaterialIcons name="check" size={16} color="#fff" />}
              </View>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Agendar retorno para finalizar
              </Text>
            </TouchableOpacity>
          </View>

          {temRetorno && (
            <View style={{ gap: 12 }}>
              <DatePicker
                label="Data do Retorno"
                value={dataRetorno}
                onChange={setDataRetorno}
              />

              <TouchableOpacity
                onPress={() => {
                  setTimePickerMode("retorno");
                  setShowTimePicker(true);
                }}
                style={[
                  styles.dateInput,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                <Text style={[styles.dateInputText, { color: colors.foreground }]}>
                  {horaRetorno || "Selecionar horário"}
                </Text>
              </TouchableOpacity>

              <TextInput
                placeholder="Endereço do retorno (opcional)"
                placeholderTextColor={colors.muted}
                value={enderecoRetorno}
                onChangeText={setEnderecoRetorno}
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                ]}
              />
            </View>
          )}
        </View>

        {/* ── RESUMO DE VALORES ───────────────────────────────────────────── */}
        {moveis.length > 0 && (
          <View style={[styles.resumoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.resumoTitle, { color: colors.foreground }]}>Resumo de Valores</Text>
            {moveis.map((movel, idx) => {
              const valor = parseFloat((movel.valor || "0").replace(",", "."));
              const total = valor * movel.quantidade;
              return (
                <View key={idx} style={[styles.resumoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.resumoLabel, { color: colors.muted }]}>
                    {movel.servicoNome} ({movel.quantidade}x)
                  </Text>
                  <Text style={[styles.resumoValue, { color: colors.foreground }]}>
                    R$ {total.toFixed(2)}
                  </Text>
                </View>
              );
            })}
            {(() => {
              const valorTotal = moveis.reduce((sum, movel) => {
                const valor = parseFloat((movel.valor || "0").replace(",", "."));
                return sum + (valor * movel.quantidade);
              }, 0);
              const valorAgendamento = temRetorno ? valorTotal / 2 : valorTotal;
              const valorRetorno = temRetorno ? valorTotal / 2 : 0;
              return (
                <>
                  <View style={[styles.resumoRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.resumoTotal, { color: colors.foreground }]}>Valor Total</Text>
                    <Text style={[styles.resumoTotal, { color: colors.primary }]}>
                      R$ {valorTotal.toFixed(2)}
                    </Text>
                  </View>
                  {temRetorno && (
                    <>
                      <View style={[styles.resumoRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.resumoLabel, { color: colors.muted }]}>Agendamento (50%)</Text>
                        <Text style={[styles.resumoValue, { color: colors.foreground }]}>
                          R$ {valorAgendamento.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.resumoRow}>
                        <Text style={[styles.resumoLabel, { color: colors.muted }]}>Retorno (50%)</Text>
                        <Text style={[styles.resumoValue, { color: colors.foreground }]}>
                          R$ {valorRetorno.toFixed(2)}
                        </Text>
                      </View>
                    </>
                  )}
                </>
              );
            })()}
          </View>
        )}

        <Button title="Salvar Agendamento" onPress={salvar} loading={saving} style={styles.saveBtn} />
      </ScrollView>

      {/* ══ MODAL: Contatos do celular (busca + seleção única) ══════════════ */}
      <Modal visible={modalContatos} animationType="slide">
        <ScreenContainer edges={["top", "left", "right", "bottom"]}>
          <View style={[styles.header, { backgroundColor: colors.primary }]}>
            <TouchableOpacity onPress={() => setModalContatos(false)} activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Selecionar Contato</Text>
            <View style={{ width: 26 }} />
          </View>

          {/* Barra de busca */}
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Buscar por nome ou número..."
              placeholderTextColor={colors.muted}
              value={contatosBusca}
              onChangeText={setContatosBusca}
              returnKeyType="search"
              autoFocus
            />
            {contatosBusca.length > 0 && (
              <TouchableOpacity onPress={() => setContatosBusca("")} activeOpacity={0.7}>
                <MaterialIcons name="close" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.contatosCount, { color: colors.muted }]}>
            {contatosFiltrados.length} contato(s)
          </Text>

          <FlatList
            data={contatosFiltrados}
              keyExtractor={(_, idx) => String(idx)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.contatosList}
            renderItem={({ item }) => (
              <ContatoItem
                item={item}
                clientes={clientes}
                colors={colors}
                onPress={selecionarContato}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContatos}>
                <MaterialIcons name="search-off" size={48} color={colors.border} />
                <Text style={[styles.emptyContatosText, { color: colors.muted }]}>
                  {contatosBusca ? "Nenhum contato encontrado" : "Nenhum contato com telefone"}
                </Text>
              </View>
            }
          />
        </ScreenContainer>
      </Modal>

      {/* ══ MODAL: Clientes cadastrados ════════════════════════════════════ */}
      <Modal visible={modalCliente} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Clientes Cadastrados</Text>
              <TouchableOpacity onPress={() => setModalCliente(false)}>
                <MaterialIcons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={clientes}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setClienteSelecionado(item);
                    setEndereco(item.endereco ?? "");
                    setModalCliente(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.contatoAvatar, { backgroundColor: colors.primary + "15" }]}>
                    <Text style={[styles.contatoAvatarText, { color: colors.primary }]}>
                      {item.nome.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.contatoInfo}>
                    <Text style={[styles.modalItemText, { color: colors.foreground }]}>{item.nome}</Text>
                    <Text style={[styles.modalItemSub, { color: colors.muted }]}>{item.telefone}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContatos}>
                  <MaterialIcons name="people-outline" size={40} color={colors.border} />
                  <Text style={[styles.emptyContatosText, { color: colors.muted }]}>
                    Nenhum cliente cadastrado.{"\n"}Use "Buscar no celular" acima.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ══ MODAL: Serviços ════════════════════════════════════════════════ */}
      <Modal visible={modalServico} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Tipo de Serviço</Text>
              <TouchableOpacity onPress={() => setModalServico(false)}>
                <MaterialIcons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {!mostraInputCustomizado ? (
              <>
                <TouchableOpacity
                  style={[styles.modalItem, { borderBottomColor: colors.border, backgroundColor: colors.primary + "15" }]}
                  onPress={() => setMostraInputCustomizado(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalItemText, { color: colors.primary }]}>+ Novo Serviço</Text>
                  <Text style={[styles.modalItemSub, { color: colors.muted }]}>Digitar móvel customizado</Text>
                </TouchableOpacity>
                <FlatList
                  data={servicos}
                  keyExtractor={(i) => i.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.modalItem, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setServicoSelecionado(item);
                        setValor(String(item.valorSugerido));
                        setModalServico(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalItemText, { color: colors.foreground }]}>{item.nome}</Text>
                      <Text style={[styles.modalItemSub, { color: colors.muted }]}>
                        {item.categoria} · R$ {item.valorMin}–{item.valorMax}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </>
            ) : (
              <View style={{ padding: 16, gap: 12 }}>
                <TextInput
                  placeholder="Nome do móvel/serviço"
                  placeholderTextColor={colors.muted}
                  value={servicoCustomizado}
                  onChangeText={setServicoCustomizado}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.btn, { flex: 1, backgroundColor: colors.primary }]}
                    onPress={() => {
                      if (servicoCustomizado.trim()) {
                        // Criar serviço customizado com nome válido
                        const novoServico = {
                          id: "custom-" + Date.now(),
                          nome: servicoCustomizado.trim(),
                          categoria: "Customizado",
                          valorMin: 0,
                          valorMax: 0,
                          valorSugerido: 0,
                        };
                        setServicoSelecionado(novoServico);
                        setValor(""); // Limpar valor para obrigar usuário a digitar
                        setServicoCustomizado("");
                        setMostraInputCustomizado(false);
                        setModalServico(false);
                      } else {
                        Alert.alert("Atenção", "Digite um nome para o serviço.");
                      }
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>Usar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { flex: 1, backgroundColor: colors.border }]}
                    onPress={() => {
                      setServicoCustomizado("");
                      setMostraInputCustomizado(false);
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de hora removido - agora usa DateTimePicker nativo */}

      {/* ══ TIME PICKER (Relógio Nativo) ════════════════════════════════════ */}
      {showTimePicker && (
        <DateTimePicker
          value={new Date(`2000-01-01T${timePickerMode === "hora" ? hora : horaRetorno}:00`)}
          mode="time"
          display={timePickerDisplay}
          onChange={(event, selectedDate) => {
            if (event.type === "dismissed") {
              setShowTimePicker(false);
            } else if (selectedDate) {
              const hours = String(selectedDate.getHours()).padStart(2, "0");
              const minutes = String(selectedDate.getMinutes()).padStart(2, "0");
              const timeStr = `${hours}:${minutes}`;
              if (timePickerMode === "hora") {
                setHora(timeStr);
              } else {
                setHoraRetorno(timeStr);
              }
              setShowTimePicker(false);
            }
          }}
        />
      )}

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
  form: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
  },

  // ── Cliente opcoes ──────────────────────────────────────────────────────
  clienteOpcoes: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  clienteOpcaoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  clienteOpcaoText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  clienteSelecionado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  clienteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  clienteAvatarText: {
    fontSize: 18,
    fontWeight: "700",
  },
  clienteInfo: {
    flex: 1,
    gap: 2,
  },
  clienteNome: {
    fontSize: 15,
    fontWeight: "600",
  },
  clienteTel: {
    fontSize: 13,
  },
  clienteClear: {
    padding: 4,
  },
  clienteHint: {
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 4,
  },

  // ── Botão Adicionar ──────────────────────────────────────────────────────
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Picker ──────────────────────────────────────────────────────────────
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  pickerText: {
    fontSize: 15,
    flex: 1,
  },
  hint: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
  },
  saveBtn: {
    marginTop: 8,
  },

  movelItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 10,
  },
  movelNome: {
    fontSize: 14,
    fontWeight: "600",
  },
  movelValor: {
    fontSize: 12,
    marginTop: 2,
  },
  movelConfigRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 4,
  },
  movelQtdBox: {
    flex: 1,
  },
  movelQtdInput: {
    marginBottom: 0,
  },
  addMovelActionBtn: {
    minWidth: 170,
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 12,
  },
  addMovelActionText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  addMovelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  addMovelText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Search bar (modal contatos) ─────────────────────────────────────────
  searchBar: {
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
  contatosCount: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  contatosList: {
    paddingBottom: 40,
  },
  contatoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  contatoAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  contatoAvatarText: {
    fontSize: 18,
    fontWeight: "700",
  },
  contatoInfo: {
    flex: 1,
    gap: 2,
  },
  contatoNome: {
    fontSize: 15,
    fontWeight: "600",
  },
  contatoTel: {
    fontSize: 13,
  },
  jaCadastradoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  jaCadastradoText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyContatos: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyContatosText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },

  // ── Modal bottom sheet ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalBox: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: "500",
  },
  modalItemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  customTimeInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  timeInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dateInputText: {
    fontSize: 15,
    flex: 1,
  },
  resumoCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  resumoTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  resumoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  resumoLabel: {
    fontSize: 13,
  },
  resumoValue: {
    fontSize: 13,
    fontWeight: "500",
  },
  resumoTotal: {
    fontSize: 14,
    fontWeight: "600",
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 15,
  },
  movelQtd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
});
