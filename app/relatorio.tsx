import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState, useCallback } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { ScreenContainer } from "@/components/screen-container";
import { DatePicker } from "@/components/ui/date-picker";
import { useColors } from "@/hooks/use-colors";
import { getAgendamentos, type Agendamento } from "@/lib/store";
import { gerarRelatorioExcel, gerarRelatorioPDF, gerarRelatorioCSV } from "@/lib/report-service";

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface MesData {
  mes: number;
  ano: number;
  total: number;
  servicos: number;
}

interface TipoServicoStats {
  nome: string;
  quantidade: number;
  total: number;
}

export default function RelatorioScreen() {
  const colors = useColors();
  const router = useRouter();
  const [mesAtual, setMesAtual] = useState(new Date().getMonth());
  const [anoAtual, setAnoAtual] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<MesData | null>(null);
  const [tiposServico, setTiposServico] = useState<TipoServicoStats[]>([]);
  const [mostraDownload, setMostraDownload] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const calcularStats = useCallback(async () => {
    try {
      const agendamentos = await getAgendamentos();

      // Filtrar agendamentos do mês/ano selecionado e que estão concluídos
      const agendamentosMes = agendamentos.filter((a) => {
        const [ano, mes] = a.data.split("-").map(Number);
        return ano === anoAtual && mes === mesAtual + 1 && a.status === "concluido";
      });

      // Helper para obter valor recebido ou orçado
      const getValor = (a: Agendamento) => a.valorRecebido !== undefined ? a.valorRecebido : a.valor;

      // Calcular total usando valor recebido
      const total = agendamentosMes.reduce((sum, a) => sum + getValor(a), 0);

      // Agrupar por tipo de serviço usando valor recebido
      const porTipo: { [key: string]: TipoServicoStats } = {};
      agendamentosMes.forEach((a) => {
        if (!porTipo[a.tipoServico]) {
          porTipo[a.tipoServico] = { nome: a.tipoServico, quantidade: 0, total: 0 };
        }
        porTipo[a.tipoServico].quantidade += 1;
        porTipo[a.tipoServico].total += getValor(a);
      });

      setStats({ mes: mesAtual, ano: anoAtual, total, servicos: agendamentosMes.length });
      setTiposServico(
        Object.values(porTipo).sort((a, b) => b.total - a.total)
      );

      // Definir datas padrão
      const primeiroDia = new Date(anoAtual, mesAtual, 1).toISOString().slice(0, 10);
      const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).toISOString().slice(0, 10);
      setDataInicio(primeiroDia);
      setDataFim(ultimoDia);
    } catch (err) {
      console.error("Erro ao calcular estatísticas:", err);
    }
  }, [mesAtual, anoAtual]);

  useFocusEffect(useCallback(() => { calcularStats(); }, [calcularStats]));

  function mesAnterior() {
    if (mesAtual === 0) {
      setMesAtual(11);
      setAnoAtual((a) => a - 1);
    } else {
      setMesAtual((m) => m - 1);
    }
  }

  function mesProximo() {
    const hoje = new Date();
    if (anoAtual === hoje.getFullYear() && mesAtual === hoje.getMonth()) return;
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual((a) => a + 1);
    } else {
      setMesAtual((m) => m + 1);
    }
  }

  async function baixarRelatorio(formato: "pdf" | "excel" | "csv") {
    try {
      Alert.alert("Gerando...", "Aguarde enquanto o relatório é gerado");

      let conteudo: string;
      let nomeArquivo: string;
      let tipo: string;

      if (formato === "excel") {
        conteudo = await gerarRelatorioExcel(dataInicio, dataFim);
        nomeArquivo = `relatorio_${dataInicio}_${dataFim}.xlsx`;
        tipo = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else if (formato === "pdf") {
        const pdfUri = await gerarRelatorioPDF(dataInicio, dataFim);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pdfUri, {
            mimeType: "application/pdf",
            dialogTitle: "Compartilhar PDF",
          });
        } else {
          Alert.alert("Sucesso", `Relatório salvo em: ${pdfUri}`);
        }
        setMostraDownload(false);
        return;
      } else {
        conteudo = await gerarRelatorioCSV(dataInicio, dataFim);
        nomeArquivo = `relatorio_${dataInicio}_${dataFim}.csv`;
        tipo = "text/csv";
      }

      // Salvar arquivo
      const fileUri = (FileSystem.documentDirectory || "") + nomeArquivo;
      if (formato === "excel") {
        await FileSystem.writeAsStringAsync(fileUri, conteudo, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.writeAsStringAsync(fileUri, conteudo, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      // Compartilhar
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: tipo,
          dialogTitle: `Compartilhar ${formato.toUpperCase()}`,
        });
      } else {
        Alert.alert("Sucesso", `Relatório salvo em: ${fileUri}`);
      }

      setMostraDownload(false);
    } catch (err) {
      Alert.alert("Erro", "Falha ao gerar relatório: " + String(err));
    }
  }

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const maxValor = Math.max(...tiposServico.map((t) => t.total), 1);

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relatório de Faturamento</Text>
        <TouchableOpacity onPress={() => setMostraDownload(true)} activeOpacity={0.7}>
          <MaterialIcons name="download" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Navegação de Mês */}
        <View style={styles.navMes}>
          <TouchableOpacity onPress={mesAnterior} activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.mesTitulo, { color: colors.foreground }]}>
            {meses[mesAtual]} {anoAtual}
          </Text>
          <TouchableOpacity onPress={mesProximo} activeOpacity={0.7}>
            <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Cards de Resumo */}
        <View style={styles.resumoCards}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.muted }]}>Serviços Realizados</Text>
            <Text style={[styles.cardValue, { color: colors.primary }]}>{stats?.servicos || 0}</Text>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.muted }]}>Faturamento Total</Text>
            <Text style={[styles.cardValue, { color: colors.success }]}>
              {formatMoney(stats?.total || 0)}
            </Text>
          </View>
        </View>

        {/* Gráfico de Barras */}
        {tiposServico.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>Faturamento por Serviço</Text>
            {tiposServico.map((tipo, idx) => (
              <View key={idx} style={styles.barItem}>
                <Text style={[styles.barLabel, { color: colors.muted }]} numberOfLines={1}>
                  {tipo.nome}
                </Text>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        width: `${(tipo.total / maxValor) * 100}%`,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barValue, { color: colors.foreground }]}>
                  {formatMoney(tipo.total)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Mensagem vazia */}
        {!stats || stats.servicos === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name="info-outline" size={32} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Nenhum serviço concluído neste período
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Modal de Download */}
      <Modal visible={mostraDownload} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Baixar Relatório
            </Text>

            <Text style={[styles.modalLabel, { color: colors.muted }]}>Data Início:</Text>
            <DatePicker
              value={dataInicio}
              onChange={setDataInicio}
            />

            <Text style={[styles.modalLabel, { color: colors.muted, marginTop: 12 }]}>Data Fim:</Text>
            <DatePicker
              value={dataFim}
              onChange={setDataFim}
            />

            <Text style={[styles.modalSub, { color: colors.muted }]}>Escolha o formato:</Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={() => baixarRelatorio("excel")}
                activeOpacity={0.8}
              >
                <MaterialIcons name="table-chart" size={20} color="#fff" />
                <Text style={styles.modalBtnText}>Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={() => baixarRelatorio("pdf")}
                activeOpacity={0.8}
              >
                <MaterialIcons name="picture-as-pdf" size={20} color="#fff" />
                <Text style={styles.modalBtnText}>PDF</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.border }]}
              onPress={() => setMostraDownload(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  navMes: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  mesTitulo: {
    fontSize: 18,
    fontWeight: "700",
  },
  resumoCards: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  chartCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  barItem: {
    gap: 4,
  },
  barLabel: {
    fontSize: 12,
  },
  barContainer: {
    height: 24,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 4,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 4,
  },
  barValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  empty: {
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    borderRadius: 16,
    padding: 20,
    width: "85%",
    maxWidth: 400,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalSub: {
    fontSize: 12,
    marginTop: 8,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  modalBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
