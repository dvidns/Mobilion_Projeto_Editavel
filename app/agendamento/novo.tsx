import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
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
  addAgendamento, getClientes, addCliente, updateCliente, atualizarEnderecoCliente, getServicos, addServico,
  getItensEstoque, getMargemPecas, addItemEstoque,
  type Cliente, type Servico, type ItemEstoque,
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
  observacao?: string;
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
        {!!movel.observacao?.trim() && (
          <Text style={[styles.movelValor, { color: colors.muted, marginTop: 2 }]}>📝 {movel.observacao}</Text>
        )}
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
  const [observacaoMovel, setObservacaoMovel] = useState("");
  const [descricao, setDescricao] = useState("");

  const [moveis, setMoveis] = useState<ItemMovel[]>([]);
  const [temRetorno, setTemRetorno] = useState(false);
  const [dataRetorno, setDataRetorno] = useState("");
  const [horaRetorno, setHoraRetorno] = useState("08:00");
  const [enderecoRetorno, setEnderecoRetorno] = useState("");
  const [servicoCustomizado, setServicoCustomizado] = useState("");
  const [mostraInputCustomizado, setMostraInputCustomizado] = useState(false);

  // Autocomplete state for service search
  const [buscaServico, setBuscaServico] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

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
  const [step, setStep] = useState(1);
  const STEPS = ["Cliente", "Serviço & Detalhes", "Peças", "Confirmação"];

  // Peças & Materiais
  const [itensEstoque, setItensEstoque] = useState<ItemEstoque[]>([]);
  const [margemPecas, setMargemPecas] = useState(30);
  const [pecasSelecionadas, setPecasSelecionadas] = useState<{ id: string; nome: string; preco: number; qtd: number }[]>([]);

  // Modal cadastro de nova peça
  const [modalNovaPeca, setModalNovaPeca] = useState(false);
  const [novaPecaNome, setNovaPecaNome] = useState("");
  const [novaPecaPreco, setNovaPecaPreco] = useState("");
  const [novaPecaEstoque, setNovaPecaEstoque] = useState("1");
  const [salvandoPeca, setSalvandoPeca] = useState(false);

  useEffect(() => {
    getClientes().then(setClientes);
    getServicos().then(setServicos);
    getItensEstoque().then(setItensEstoque);
    getMargemPecas().then(setMargemPecas);
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

  // Autocomplete: filtrar serviços conforme digitação
  const sugestoesServico = useMemo(() => {
    if (!buscaServico.trim()) return servicos.slice(0, 8);
    const q = buscaServico.toLowerCase();
    return servicos.filter((s) => s.nome.toLowerCase().includes(q)).slice(0, 8);
  }, [buscaServico, servicos]);

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
    
    // Inclui automaticamente o item que está preenchido no formulário, mesmo se já houver outros na lista
    let moveisParaSalvar = [...moveis];
    if (servicoSelecionado && valor) {
      const quantidadeInicial = Math.max(1, parseInt(quantidadeMovel, 10) || 1);
      const novoMovel: ItemMovel = {
        id: Math.random().toString(36).slice(2),
        servicoId: servicoSelecionado.id,
        servicoNome: servicoSelecionado.nome,
        valor: valor,
        quantidade: quantidadeInicial,
        observacao: observacaoMovel.trim() || undefined,
      };

      const itemJaAdicionado = moveisParaSalvar.some((movel) =>
        movel.servicoId === novoMovel.servicoId
        && movel.valor === novoMovel.valor
        && movel.quantidade === novoMovel.quantidade
        && (movel.observacao || "") === (novoMovel.observacao || "")
      );

      if (!itemJaAdicionado) {
        moveisParaSalvar.push(novoMovel);
      }
    }
    
    // Adicionar peças selecionadas como itens
    for (const p of pecasSelecionadas) {
      if (p.qtd > 0) {
        moveisParaSalvar.push({
          id: Math.random().toString(36).slice(2),
          servicoId: p.id,
          servicoNome: p.nome,
          valor: String((p.preco * (1 + margemPecas / 100)).toFixed(2)),
          quantidade: p.qtd,
        });
      }
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

      // Update the client's address if one was entered and the client doesn't have one yet
      const enderecoTrimmed = endereco.trim();
      if (enderecoTrimmed && !clienteSelecionado.endereco) {
        await updateCliente(clienteSelecionado.id, { endereco: enderecoTrimmed });
      }

      // Atualizar endereço do cliente quando há endereço de retorno definido
      if (temRetorno && enderecoRetorno.trim()) {
        await atualizarEnderecoCliente(clienteSelecionado.id, enderecoRetorno.trim());
      }

      router.back();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      Alert.alert("Erro", "Não foi possível salvar o agendamento.");
    } finally {
      setSaving(false);
    }
  }, [clienteSelecionado, moveis, servicoSelecionado, valor, quantidadeMovel, observacaoMovel, data, hora, descricao, endereco, temRetorno, dataRetorno, horaRetorno, enderecoRetorno, pecasSelecionadas, margemPecas, router]);

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
      observacao: observacaoMovel.trim() || undefined,
    };
    setMoveis(prev => [...prev, novoMovel]);
    setServicoSelecionado(null);
    setBuscaServico("");
    setValor("");
    setQuantidadeMovel("1");
    setObservacaoMovel("");
  }, [servicoSelecionado, valor, quantidadeMovel, observacaoMovel]);

  // ── Navegação entre passos ──────────────────────────────────────────────
  function avancar() {
    if (step === 1) {
      if (!clienteSelecionado) { Alert.alert("Atenção", "Selecione um cliente para continuar."); return; }
    }
    // step 2 = Serviço & Detalhes (merged)
    if (step === 2) {
      if (!servicoSelecionado && moveis.length === 0) { Alert.alert("Atenção", "Selecione o tipo de serviço ou adicione pelo menos um serviço à lista."); return; }
      if (!data) { Alert.alert("Atenção", "Informe a data."); return; }
      const temItemAtual = !!servicoSelecionado && !!valor;
      if (moveis.length === 0 && !temItemAtual) { Alert.alert("Atenção", "Adicione pelo menos um móvel/serviço."); return; }
      if (temRetorno && !dataRetorno) { Alert.alert("Atenção", "Informe a data do retorno."); return; }
    }
    setStep(s => s + 1);
  }

  function voltar() {
    if (step === 1) { router.back(); return; }
    setStep(s => s - 1);
  }

  function calcTotal() {
    let lista = [...moveis];
    if (servicoSelecionado && valor) {
      const qtd = Math.max(1, parseInt(quantidadeMovel, 10) || 1);
      lista = [...lista, { id: "_cur", servicoId: servicoSelecionado.id, servicoNome: servicoSelecionado.nome, valor, quantidade: qtd }];
    }
    const totalMoveis = lista.reduce((sum, m) => sum + parseFloat((m.valor || "0").replace(",", ".")) * m.quantidade, 0);
    const totalPecas = pecasSelecionadas.reduce((sum, p) => sum + p.preco * (1 + margemPecas / 100) * p.qtd, 0);
    return totalMoveis + totalPecas;
  }

  // ── Stepper ─────────────────────────────────────────────────────────────
  function renderStepper() {
    return (
      <View style={styles.stepper}>
        {STEPS.map((label, i) => {
          const num = i + 1;
          const done = num < step;
          const active = num === step;
          return (
            <React.Fragment key={num}>
              {i > 0 && (
                <View style={[styles.stepLine, { backgroundColor: done || active ? colors.primary : colors.border }]} />
              )}
              <View style={styles.stepCol}>
                <View style={[
                  styles.stepCircle,
                  { backgroundColor: done || active ? colors.primary : colors.surface, borderColor: done || active ? colors.primary : colors.border },
                ]}>
                  {done
                    ? <MaterialIcons name="check" size={12} color="#fff" />
                    : <Text style={[styles.stepNum, { color: active ? "#fff" : colors.muted }]}>{num}</Text>
                  }
                </View>
                <Text style={[styles.stepLabel, { color: active ? colors.primary : done ? colors.primary : colors.muted }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    );
  }

  // ── Passo 1: Cliente ─────────────────────────────────────────────────────
  function renderPasso1() {
    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>Cliente</Text>
        <Text style={[styles.label, { color: colors.muted }]}>Selecione o cliente *</Text>
        <View style={styles.clienteOpcoes}>
          <TouchableOpacity
            style={[styles.clienteOpcaoBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => setModalCliente(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="people" size={20} color={colors.primary} />
            <Text style={[styles.clienteOpcaoText, { color: colors.foreground }]}>{"Clientes\ncadastrados"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.clienteOpcaoBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "10" }]}
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
        {clienteSelecionado ? (
          <View style={[styles.clienteSelecionado, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
            <View style={[styles.clienteAvatar, { backgroundColor: colors.primary + "25" }]}>
              <Text style={[styles.clienteAvatarText, { color: colors.primary }]}>
                {clienteSelecionado.nome.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.clienteInfo}>
              <Text style={[styles.clienteNome, { color: colors.foreground }]}>{clienteSelecionado.nome}</Text>
              <Text style={[styles.clienteTel, { color: colors.muted }]}>{clienteSelecionado.telefone}</Text>
            </View>
            <TouchableOpacity onPress={() => setClienteSelecionado(null)} activeOpacity={0.7} style={styles.clienteClear}>
              <MaterialIcons name="close" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.emptyClienteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name="person-outline" size={40} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
              {"Nenhum cliente selecionado\nUse os botões acima para selecionar"}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── Passo 2: Serviço ─────────────────────────────────────────────────────
  function usarTextoComoServico(texto: string) {
    if (!texto.trim()) return;
    const novoServico = {
      id: "custom-" + Date.now(),
      nome: texto.trim(),
      categoria: "Customizado",
      valorMin: 0,
      valorMax: 0,
      valorSugerido: 0,
    };
    setServicoSelecionado(novoServico);
    setBuscaServico(novoServico.nome);
    setMostrarSugestoes(false);
  }

  function renderPasso2() {
    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>Serviço & Detalhes</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.label, { color: colors.muted }]}>Tipo de Serviço</Text>
          <TouchableOpacity onPress={() => setModalServico(true)} activeOpacity={0.8}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>Ver todos</Text>
          </TouchableOpacity>
        </View>
        <View style={{ position: "relative", zIndex: 10 }}>
          <View style={[styles.picker, { borderColor: mostrarSugestoes ? colors.primary : colors.border, backgroundColor: colors.surface, marginBottom: 0 }]}>
            <MaterialIcons name="search" size={18} color={colors.muted} style={{ marginRight: 6 }} />
            <TextInput
              style={[styles.pickerText, { color: colors.foreground, flex: 1, paddingVertical: 0 }]}
              value={buscaServico}
              onChangeText={(text) => { setBuscaServico(text); setMostrarSugestoes(true); if (!text.trim()) setServicoSelecionado(null); }}
              onFocus={() => setMostrarSugestoes(true)}
              onSubmitEditing={() => {
                if (buscaServico.trim() && !servicoSelecionado) {
                  usarTextoComoServico(buscaServico);
                } else {
                  setMostrarSugestoes(false);
                }
              }}
              placeholder="Digite ou selecione o serviço"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
            />
            {(buscaServico.length > 0 || servicoSelecionado) && (
              <TouchableOpacity onPress={() => { setBuscaServico(""); setServicoSelecionado(null); setMostrarSugestoes(false); }} activeOpacity={0.7}>
                <MaterialIcons name="close" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
          {mostrarSugestoes && (buscaServico.trim().length > 0 || sugestoesServico.length > 0) && (
            <View style={[styles.sugestoesBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {buscaServico.trim().length > 0 && !servicoSelecionado && (
                <TouchableOpacity
                  style={[styles.sugestaoItem, { borderBottomColor: colors.border, backgroundColor: colors.primary + "10" }]}
                  onPress={() => usarTextoComoServico(buscaServico)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={[styles.sugestaoNome, { color: colors.primary }]}>Usar "{buscaServico.trim()}" como serviço</Text>
                </TouchableOpacity>
              )}
              {sugestoesServico.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.sugestaoItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setServicoSelecionado(item); setBuscaServico(item.nome); setValor(String(item.valorSugerido)); setMostrarSugestoes(false); }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sugestaoNome, { color: colors.foreground }]}>{item.nome}</Text>
                    <Text style={[styles.sugestaoSub, { color: colors.muted }]}>{item.categoria} · R$ {item.valorMin}–{item.valorMax}</Text>
                  </View>
                  <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>R$ {item.valorSugerido}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {servicoSelecionado && !mostrarSugestoes && (
          <View style={[styles.servicoSelecionadoCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "40", marginTop: 8 }]}>
            <MaterialIcons name="check-circle" size={16} color={colors.primary} />
            <Text style={{ flex: 1, color: colors.primary, fontSize: 13, fontWeight: "600" }}>{servicoSelecionado.nome}</Text>
            {servicoSelecionado.categoria !== "Customizado" && (
              <Text style={{ color: colors.muted, fontSize: 12 }}>Ref: R$ {servicoSelecionado.valorMin}–{servicoSelecionado.valorMax}</Text>
            )}
          </View>
        )}
        <DatePicker label="Data *" value={data} onChange={setData} />
        <Text style={[styles.label, { color: colors.muted }]}>Horário *</Text>
        <TouchableOpacity
          style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => { setTimePickerMode("hora"); setShowTimePicker(true); }}
          activeOpacity={0.8}
        >
          <MaterialIcons name="access-time" size={20} color={colors.primary} />
          <Text style={[styles.pickerText, { color: colors.foreground }]}>{hora}</Text>
          <MaterialIcons name="expand-more" size={22} color={colors.muted} />
        </TouchableOpacity>
        {/* ── Detalhes inline ── */}
        <Input label="Endereço / Bairro" value={endereco} onChangeText={setEndereco} placeholder="Rua, número, bairro..." />
        <Input label="Valor (R$) *" value={valor} onChangeText={setValor} placeholder="0,00" keyboardType="decimal-pad" />
        <Input label="Observação do Item" value={observacaoMovel} onChangeText={setObservacaoMovel} placeholder="Detalhe específico deste móvel/serviço" multiline numberOfLines={2} />
        <View style={styles.movelConfigRow}>
          <View style={styles.movelQtdBox}>
            <Text style={[styles.label, { color: colors.muted }]}>Quantidade</Text>
            <TextInput
              value={quantidadeMovel}
              onChangeText={(t) => setQuantidadeMovel(t.replace(/\D/g, ""))}
              keyboardType="number-pad"
              style={[styles.input, styles.movelQtdInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="1"
              placeholderTextColor={colors.muted}
            />
          </View>
          <TouchableOpacity
            style={[styles.addMovelActionBtn, { backgroundColor: servicoSelecionado && valor ? colors.primary : colors.border }]}
            onPress={handleAddMovel}
            activeOpacity={0.8}
            disabled={!servicoSelecionado || !valor}
          >
            <MaterialIcons name="playlist-add" size={20} color="#fff" />
            <Text style={styles.addMovelActionText}>Adicionar à lista</Text>
          </TouchableOpacity>
        </View>
        {moveis.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.label, { color: colors.muted }]}>Itens adicionados</Text>
            {moveis.map((m, idx) => (
              <MovelItem key={m.id} movel={m} index={idx} colors={colors} onUpdateQuantidade={handleUpdateQuantidade} onRemove={handleRemoveMovel} />
            ))}
          </View>
        )}
        <Input label="Observações gerais" value={descricao} onChangeText={setDescricao} placeholder="Detalhes do serviço..." multiline numberOfLines={3} style={{ height: 80, textAlignVertical: "top" }} />
        <View style={{ marginTop: 8 }}>
          <TouchableOpacity onPress={() => setTemRetorno(!temRetorno)} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View style={[styles.checkbox, { backgroundColor: temRetorno ? colors.primary : colors.surface, borderColor: colors.border }]}>
              {temRetorno && <MaterialIcons name="check" size={16} color="#fff" />}
            </View>
            <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>Agendar retorno para finalizar</Text>
          </TouchableOpacity>
          {temRetorno && (
            <View style={{ gap: 12 }}>
              <DatePicker label="Data do Retorno" value={dataRetorno} onChange={setDataRetorno} />
              <TouchableOpacity
                onPress={() => { setTimePickerMode("retorno"); setShowTimePicker(true); }}
                style={[styles.dateInput, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                <Text style={[styles.dateInputText, { color: colors.foreground }]}>{horaRetorno || "Selecionar horário"}</Text>
              </TouchableOpacity>
              <TextInput
                placeholder="Endereço do retorno (opcional)"
                placeholderTextColor={colors.muted}
                value={enderecoRetorno}
                onChangeText={setEnderecoRetorno}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              />
            </View>
          )}
        </View>
      </View>
    );
  }
  async function salvarNovaPeca() {
    const nomeT = novaPecaNome.trim();
    if (!nomeT) { Alert.alert("Atenção", "Informe o nome da peça."); return; }
    const precoN = parseFloat(novaPecaPreco.replace(",", "."));
    if (isNaN(precoN) || precoN < 0) { Alert.alert("Atenção", "Informe um preço válido."); return; }
    const estN = Math.max(0, parseInt(novaPecaEstoque, 10) || 0);
    setSalvandoPeca(true);
    try {
      const novo = await addItemEstoque({ nome: nomeT, categoria: "peca", precoUnitario: precoN, estoque: estN, estoqueMinimo: 1 });
      const novosItens = await getItensEstoque();
      setItensEstoque(novosItens);
      // Já adiciona direto na seleção
      setPecasSelecionadas((prev) => [...prev, { id: novo.id, nome: novo.nome, preco: novo.precoUnitario, qtd: 1 }]);
      setModalNovaPeca(false);
      setNovaPecaNome(""); setNovaPecaPreco(""); setNovaPecaEstoque("1");
    } catch {
      Alert.alert("Erro", "Não foi possível cadastrar a peça.");
    } finally {
      setSalvandoPeca(false);
    }
  }

  function renderPasso3() {
    const pecas = itensEstoque.filter((i) => i.categoria === "peca");
    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>Peças & Materiais</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
          Selecione as peças que serão utilizadas (opcional). Preço já inclui {margemPecas}% de margem.
        </Text>
        {/* Botão cadastrar nova peça */}
        <TouchableOpacity
          onPress={() => setModalNovaPeca(true)}
          activeOpacity={0.8}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
            backgroundColor: colors.primary + "15", borderColor: colors.primary + "50", borderWidth: 1,
            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginBottom: 12 }}
        >
          <MaterialIcons name="add" size={16} color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "700" }}>Cadastrar nova peça</Text>
        </TouchableOpacity>
        {pecas.length === 0 ? (
          <View style={[styles.emptyClienteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name="inventory-2" size={40} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 20 }}>
              {"Nenhuma peça cadastrada.\nCadastre em Estoque & Materiais."}
            </Text>
          </View>
        ) : (
          pecas.map((item) => {
            const sel = pecasSelecionadas.find((p) => p.id === item.id);
            const precoVenda = item.precoUnitario * (1 + margemPecas / 100);
            return (
              <View
                key={item.id}
                style={[styles.movelItem, { backgroundColor: colors.surface, borderColor: sel ? colors.primary : colors.border, marginBottom: 8 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.movelNome, { color: colors.foreground }]}>{item.nome}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 3, alignItems: "center", flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 11, color: colors.muted }}>Custo: R$ {item.precoUnitario.toFixed(2)}</Text>
                    <MaterialIcons name="arrow-forward" size={11} color={colors.muted} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#34A853" }}>R$ {precoVenda.toFixed(2)}</Text>
                  </View>
                  {item.estoque <= item.estoqueMinimo && (
                    <Text style={{ fontSize: 11, color: "#CA8A04", marginTop: 2 }}>⚠ Estoque baixo ({item.estoque} un)</Text>
                  )}
                </View>
                <View style={{ alignItems: "center" }}>
                  {sel ? (
                    <View style={{ alignItems: "center", gap: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <TouchableOpacity
                          onPress={() => {
                            if (sel.qtd <= 1) setPecasSelecionadas((prev) => prev.filter((p) => p.id !== item.id));
                            else setPecasSelecionadas((prev) => prev.map((p) => p.id === item.id ? { ...p, qtd: p.qtd - 1 } : p));
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="remove-circle-outline" size={26} color={colors.primary} />
                        </TouchableOpacity>
                        <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 18, minWidth: 24, textAlign: "center" }}>{sel.qtd}</Text>
                        <TouchableOpacity
                          onPress={() => setPecasSelecionadas((prev) => prev.map((p) => p.id === item.id ? { ...p, qtd: p.qtd + 1 } : p))}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="add-circle-outline" size={26} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                      <Text style={{ fontSize: 12, color: "#34A853", fontWeight: "600" }}>= R$ {(precoVenda * sel.qtd).toFixed(2)}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setPecasSelecionadas((prev) => [...prev, { id: item.id, nome: item.nome, preco: item.precoUnitario, qtd: 1 }])}
                      activeOpacity={0.8}
                      style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 }}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Adicionar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
        {pecasSelecionadas.length > 0 && (
          <View style={[styles.confirmaCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "40", marginTop: 12 }]}>
            <Text style={[styles.confirmaSection, { color: colors.muted }]}>SUBTOTAL PEÇAS</Text>
            {pecasSelecionadas.map((p) => {
              const pm = p.preco * (1 + margemPecas / 100);
              return (
                <View key={p.id} style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 2 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13 }}>{p.nome} ×{p.qtd}</Text>
                  <Text style={{ color: "#34A853", fontSize: 13, fontWeight: "600" }}>R$ {(pm * p.qtd).toFixed(2)}</Text>
                </View>
              );
            })}
            <View style={[styles.confirmaDivider, { backgroundColor: colors.border }]} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Total Peças</Text>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>
                R$ {pecasSelecionadas.reduce((s, p) => s + p.preco * (1 + margemPecas / 100) * p.qtd, 0).toFixed(2)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }


  // ── Passo 4: Confirmação ─────────────────────────────────────────────────
  function renderPasso5() {
    const total = calcTotal();
    const valorEntrada = temRetorno ? total / 2 : total;
    const valorRetornoVal = temRetorno ? total / 2 : 0;
    let listaItens = [...moveis];
    if (servicoSelecionado && valor) {
      const qtd = Math.max(1, parseInt(quantidadeMovel, 10) || 1);
      listaItens = [...listaItens, { id: "_cur", servicoId: servicoSelecionado.id, servicoNome: servicoSelecionado.nome, valor, quantidade: qtd, observacao: observacaoMovel.trim() || undefined }];
    }
    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>Confirmação</Text>
        <View style={[styles.confirmaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.confirmaSection, { color: colors.muted }]}>CLIENTE</Text>
          <Text style={[styles.confirmaValue, { color: colors.foreground }]}>{clienteSelecionado?.nome}</Text>
          <Text style={[styles.confirmaSmall, { color: colors.muted }]}>{clienteSelecionado?.telefone}</Text>
          <View style={[styles.confirmaDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.confirmaSection, { color: colors.muted }]}>SERVIÇO</Text>
          <Text style={[styles.confirmaValue, { color: colors.foreground }]}>{servicoSelecionado?.nome || moveis[0]?.servicoNome || "—"}</Text>
          <View style={[styles.confirmaDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.confirmaSection, { color: colors.muted }]}>DATA E HORÁRIO</Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialIcons name="event" size={14} color={colors.primary} />
              <Text style={[styles.confirmaValue, { color: colors.foreground }]}>
                {data ? new Date(data + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialIcons name="access-time" size={14} color={colors.primary} />
              <Text style={[styles.confirmaValue, { color: colors.foreground }]}>{hora}</Text>
            </View>
          </View>
          {!!endereco && (
            <>
              <View style={[styles.confirmaDivider, { backgroundColor: colors.border }]} />
              <Text style={[styles.confirmaSection, { color: colors.muted }]}>ENDEREÇO</Text>
              <Text style={[styles.confirmaValue, { color: colors.foreground }]}>{endereco}</Text>
            </>
          )}
          <View style={[styles.confirmaDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.confirmaSection, { color: colors.muted }]}>ITENS</Text>
          {listaItens.map((m, i) => {
            const v = parseFloat((m.valor || "0").replace(",", "."));
            return (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 2 }}>
                <Text style={[styles.confirmaSmall, { color: colors.foreground }]}>{m.servicoNome} ({m.quantidade}x)</Text>
                <Text style={[styles.confirmaSmall, { color: colors.foreground }]}>R$ {(v * m.quantidade).toFixed(2)}</Text>
              </View>
            );
          })}
          {pecasSelecionadas.length > 0 && (
            <>
              <View style={[styles.confirmaDivider, { backgroundColor: colors.border }]} />
              <Text style={[styles.confirmaSection, { color: colors.muted }]}>PEÇAS & MATERIAIS</Text>
              {pecasSelecionadas.map((p) => {
                const pm = p.preco * (1 + margemPecas / 100);
                return (
                  <View key={p.id} style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 2 }}>
                    <Text style={[styles.confirmaSmall, { color: colors.foreground }]}>{p.nome} ×{p.qtd}</Text>
                    <Text style={[styles.confirmaSmall, { color: "#34A853" }]}>R$ {(pm * p.qtd).toFixed(2)}</Text>
                  </View>
                );
              })}
            </>
          )}
          <View style={[styles.confirmaDivider, { backgroundColor: colors.border }]} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[styles.confirmaSection, { color: colors.muted }]}>VALOR TOTAL</Text>
            <Text style={[styles.confirmaTotal, { color: colors.success }]}>R$ {total.toFixed(2)}</Text>
          </View>
          {temRetorno && (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={[styles.confirmaSmall, { color: colors.muted }]}>Entrada (50%)</Text>
                <Text style={[styles.confirmaSmall, { color: colors.foreground }]}>R$ {valorEntrada.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.confirmaSmall, { color: colors.muted }]}>Retorno (50%)</Text>
                <Text style={[styles.confirmaSmall, { color: colors.foreground }]}>R$ {valorRetornoVal.toFixed(2)}</Text>
              </View>
              <View style={[styles.confirmaDivider, { backgroundColor: colors.border }]} />
              <Text style={[styles.confirmaSection, { color: colors.muted }]}>RETORNO</Text>
              <Text style={[styles.confirmaValue, { color: colors.foreground }]}>
                {dataRetorno ? new Date(dataRetorno + "T12:00:00").toLocaleDateString("pt-BR") : "—"} às {horaRetorno}
              </Text>
              {!!enderecoRetorno && <Text style={[styles.confirmaSmall, { color: colors.muted }]}>{enderecoRetorno}</Text>}
            </>
          )}
          {!!descricao && (
            <>
              <View style={[styles.confirmaDivider, { backgroundColor: colors.border }]} />
              <Text style={[styles.confirmaSection, { color: colors.muted }]}>OBSERVAÇÕES</Text>
              <Text style={[styles.confirmaSmall, { color: colors.foreground }]}>{descricao}</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={voltar} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Agendamento</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Stepper */}
      {renderStepper()}

      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => setMostrarSugestoes(false)}
      >
        {step === 1 && renderPasso1()}
        {step === 2 && renderPasso2()}
        {step === 3 && renderPasso3()}
        {step === 4 && renderPasso5()}
      </ScrollView>

      {/* Footer wizard */}
      <View style={[styles.wizardFooter, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.wizardBtnVoltar, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={voltar}
          activeOpacity={0.8}
        >
          <Text style={[styles.wizardBtnVoltarText, { color: colors.foreground }]}>
            {step === 1 ? "Cancelar" : "Voltar"}
          </Text>
        </TouchableOpacity>
        {step < 4 ? (
          <TouchableOpacity
            style={[styles.wizardBtnProximo, { backgroundColor: colors.primary }]}
            onPress={avancar}
            activeOpacity={0.8}
          >
            <Text style={styles.wizardBtnProximoText}>Próximo</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.wizardBtnProximo, { backgroundColor: saving ? colors.border : colors.primary }]}
            onPress={salvar}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <Text style={styles.wizardBtnProximoText}>Salvando...</Text>
            ) : (
              <>
                <MaterialIcons name="check" size={18} color="#fff" />
                <Text style={styles.wizardBtnProximoText}>Salvar</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ══ MODAL: Cadastrar Nova Peça ══════════════════════════════════════ */}
      <Modal visible={modalNovaPeca} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Nova Peça / Material</Text>
              <TouchableOpacity onPress={() => setModalNovaPeca(false)}>
                <MaterialIcons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.muted }]}>Nome *</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Ex: Dobradiça, Parafuso, Trilho..."
              placeholderTextColor={colors.muted}
              value={novaPecaNome}
              onChangeText={setNovaPecaNome}
              autoFocus
            />

            <Text style={[styles.label, { color: colors.muted }]}>Preço de custo (R$) *</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Ex: 5,50"
              placeholderTextColor={colors.muted}
              value={novaPecaPreco}
              onChangeText={setNovaPecaPreco}
              keyboardType="decimal-pad"
            />
            {!!novaPecaPreco && !isNaN(parseFloat(novaPecaPreco.replace(",", "."))) && (
              <Text style={{ color: "#34A853", fontSize: 12, marginBottom: 8, marginTop: -6 }}>
                Venda sugerida (+{margemPecas}%): R$ {(parseFloat(novaPecaPreco.replace(",", ".")) * (1 + margemPecas / 100)).toFixed(2)}
              </Text>
            )}

            <Text style={[styles.label, { color: colors.muted }]}>Quantidade em estoque</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="1"
              placeholderTextColor={colors.muted}
              value={novaPecaEstoque}
              onChangeText={setNovaPecaEstoque}
              keyboardType="number-pad"
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.wizardBtnVoltar, { flex: 1, borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setModalNovaPeca(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.wizardBtnVoltarText, { color: colors.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wizardBtnProximo, { flex: 1, backgroundColor: salvandoPeca ? colors.border : colors.primary }]}
                onPress={salvarNovaPeca}
                disabled={salvandoPeca}
                activeOpacity={0.8}
              >
                <MaterialIcons name="check" size={16} color="#fff" />
                <Text style={styles.wizardBtnProximoText}>{salvandoPeca ? "Salvando..." : "Salvar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ MODAL: Contatos do celular ══════════════════════════════════════ */}
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
                    setBuscaServico(item.nome);
                    setValor(String(item.valorSugerido));
                    setModalServico(false);
                    setMostrarSugestoes(false);
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
                        setBuscaServico(novoServico.nome);
                        setValor(""); // Limpar valor para obrigar usuário a digitar
                        setMostrarSugestoes(false);
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

  // ── Autocomplete / Sugestões ─────────────────────────────────────────────
  sugestoesBox: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    maxHeight: 260,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 999,
  },
  sugestaoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sugestaoNome: {
    fontSize: 14,
    fontWeight: "600",
  },
  sugestaoSub: {
    fontSize: 12,
    marginTop: 2,
  },
  servicoSelecionadoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    marginTop: 4,
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

  // Wizard styles
  stepper: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 10 },
  stepCol: { alignItems: "center", gap: 4 },
  stepLine: { height: 2, width: 20, marginHorizontal: 2, marginTop: 10, alignSelf: "flex-start" },
  stepCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: 12, fontWeight: "700" },
  stepLabel: { fontSize: 10, fontWeight: "600", maxWidth: 60, textAlign: "center" },
  stepContent: { gap: 4 },
  stepTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  wizardFooter: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  wizardBtnVoltar: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  wizardBtnVoltarText: { fontSize: 15, fontWeight: "600" },
  wizardBtnProximo: { flex: 2, flexDirection: "row", paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6 },
  wizardBtnProximoText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptyClienteCard: { alignItems: "center", justifyContent: "center", gap: 10, padding: 32, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", marginTop: 8 },
  confirmaCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6, marginBottom: 12 },
  confirmaSection: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginTop: 4 },
  confirmaValue: { fontSize: 15, fontWeight: "600" },
  confirmaSmall: { fontSize: 13 },
  confirmaDivider: { height: 1, marginVertical: 8 },
  confirmaTotal: { fontSize: 20, fontWeight: "800" },
});
