import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock("expo-modules-core", () => ({
  EventEmitter: class {
    addListener() { return { remove: vi.fn() }; }
    removeAllListeners() {}
    emit() {}
  },
  NativeModulesProxy: {},
  Platform: { OS: "android" },
  requireNativeModule: vi.fn(() => ({})),
  requireOptionalNativeModule: vi.fn(() => null),
}));

vi.mock("expo-print", () => ({
  printToFileAsync: vi.fn(async () => ({ uri: "mock-pdf-uri" })),
}));

const xlsxMocks = vi.hoisted(() => ({
  mockJsonToSheet: vi.fn(),
  mockAoaToSheet: vi.fn(),
  mockBookNew: vi.fn(),
  mockBookAppendSheet: vi.fn(),
  mockWrite: vi.fn(),
}));

vi.mock('xlsx', () => ({
  default: {
    utils: {
      json_to_sheet: xlsxMocks.mockJsonToSheet,
      aoa_to_sheet: xlsxMocks.mockAoaToSheet,
      book_new: xlsxMocks.mockBookNew,
      book_append_sheet: xlsxMocks.mockBookAppendSheet,
    },
    write: xlsxMocks.mockWrite,
  },
  utils: {
    json_to_sheet: xlsxMocks.mockJsonToSheet,
    aoa_to_sheet: xlsxMocks.mockAoaToSheet,
    book_new: xlsxMocks.mockBookNew,
    book_append_sheet: xlsxMocks.mockBookAppendSheet,
  },
  write: xlsxMocks.mockWrite,
}));

vi.mock('../lib/store');

import type { Agendamento } from '../lib/store';
import { gerarRelatorioExcel, gerarRelatorioPDF, gerarRelatorioCSV, gerarRelatorioAgendamentosPDF } from '../lib/report-service';
import { getAgendamentos } from '../lib/store';

const mockGetAgendamentos = vi.mocked(getAgendamentos);

describe('Report Service', () => {
  const mockAgendamentos: Agendamento[] = [
    {
      id: '1',
      clienteId: 'c1',
      data: '2024-01-15',
      hora: '10:00',
      clienteNome: 'João Silva',
      clienteTelefone: '11999999999',
      tipoServico: 'Montagem de guarda-roupa',
      valor: 150,
      valorRecebido: 150,
      status: 'concluido' as const,
      criadoEm: '2024-01-10T10:00:00.000Z',
    },
    {
      id: '2',
      clienteId: 'c2',
      data: '2024-01-16',
      hora: '14:00',
      clienteNome: 'Maria Santos',
      clienteTelefone: '11888888888',
      tipoServico: 'Montagem de cama',
      valor: 100,
      valorRecebido: 120,
      status: 'concluido' as const,
      criadoEm: '2024-01-11T10:00:00.000Z',
    },
    {
      id: '3',
      clienteId: 'c3',
      data: '2024-01-17',
      hora: '09:00',
      clienteNome: 'Pedro Oliveira',
      clienteTelefone: '11777777777',
      tipoServico: 'Montagem de mesa',
      valor: 80,
      status: 'pendente' as const,
      criadoEm: '2024-01-12T10:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgendamentos.mockResolvedValue(mockAgendamentos);
  });

  describe('gerarRelatorioExcel', () => {
    it('deve gerar relatório Excel apenas com agendamentos concluídos no período', async () => {
      const dataInicio = '2024-01-01';
      const dataFim = '2024-01-31';

      xlsxMocks.mockJsonToSheet.mockReturnValue({});
      xlsxMocks.mockAoaToSheet.mockReturnValue({});
      xlsxMocks.mockBookNew.mockReturnValue({});
      xlsxMocks.mockBookAppendSheet.mockImplementation(() => {});
      xlsxMocks.mockWrite.mockReturnValue('mocked-base64-data');

      const result = await gerarRelatorioExcel(dataInicio, dataFim);

      expect(mockGetAgendamentos).toHaveBeenCalledTimes(1);
      expect(xlsxMocks.mockJsonToSheet).toHaveBeenCalledWith([
        {
          'Data': '15/01/2024',
          'Horário': '10:00',
          'Cliente': 'João Silva',
          'Telefone': '11999999999',
          'Serviço': 'Montagem de guarda-roupa',
          'Valor Orçado': 150,
          'Valor Recebido': 150,
          'Status': 'concluido',
        },
        {
          'Data': '16/01/2024',
          'Horário': '14:00',
          'Cliente': 'Maria Santos',
          'Telefone': '11888888888',
          'Serviço': 'Montagem de cama',
          'Valor Orçado': 100,
          'Valor Recebido': 120,
          'Status': 'concluido',
        },
      ]);

      expect(result).toBe('mocked-base64-data');
    });

    it('deve calcular totais corretamente', async () => {
      const dataInicio = '2024-01-01';
      const dataFim = '2024-01-31';

      xlsxMocks.mockJsonToSheet.mockReturnValue({});
      xlsxMocks.mockAoaToSheet.mockReturnValue({});
      xlsxMocks.mockBookNew.mockReturnValue({});
      xlsxMocks.mockBookAppendSheet.mockImplementation(() => {});
      xlsxMocks.mockWrite.mockReturnValue('mocked-base64-data');

      await gerarRelatorioExcel(dataInicio, dataFim);

      // Verifica se o resumo foi criado com os valores corretos
      expect(xlsxMocks.mockAoaToSheet).toHaveBeenCalledWith([
        ['RESUMO DO PERÍODO'],
        [''],
        ['Data Início', '2024-01-01'],
        ['Data Fim', '2024-01-31'],
        [''],
        ['Total de Serviços', 2],
        ['Faturamento Total (Recebido)', 270], // 150 + 120
        ['Ticket Médio', 135], // 270 / 2
      ]);
    });

    it('deve filtrar agendamentos fora do período', async () => {
      const dataInicio = '2024-01-20';
      const dataFim = '2024-01-31';

      xlsxMocks.mockJsonToSheet.mockReturnValue({});
      xlsxMocks.mockAoaToSheet.mockReturnValue({});
      xlsxMocks.mockBookNew.mockReturnValue({});
      xlsxMocks.mockBookAppendSheet.mockImplementation(() => {});
      xlsxMocks.mockWrite.mockReturnValue('mocked-base64-data');

      await gerarRelatorioExcel(dataInicio, dataFim);

      // Nenhum agendamento deve ser incluído pois estão antes de 20/01
      expect(xlsxMocks.mockJsonToSheet).toHaveBeenCalledWith([]);
    });
  });

  describe('gerarRelatorioPDF', () => {
    it('deve gerar HTML com faturamento e serviços concluídos', async () => {
      const result = await gerarRelatorioPDF('2024-01-01', '2024-01-31');

      expect(result).toContain('Relatório de Faturamento');
      expect(result).toContain('João Silva');
      expect(result).toContain('Maria Santos');
      expect(result).not.toContain('Pedro Oliveira');
      expect(result).toContain('R$ 270,00');
    });
  });

  describe('gerarRelatorioAgendamentosPDF', () => {
    it('deve gerar relatório PDF de agendamentos com todos os status', async () => {
      const dataInicio = '2024-01-01';
      const dataFim = '2024-01-31';

      const result = await gerarRelatorioAgendamentosPDF(dataInicio, dataFim);

      expect(result).toContain('Relatório de Agendamentos');
      expect(result).toContain('João Silva');
      expect(result).toContain('Pedro Oliveira');
      expect(mockGetAgendamentos).toHaveBeenCalledTimes(1);
    });
  });

  describe('gerarRelatorioCSV', () => {
    it('deve gerar relatório CSV apenas com agendamentos concluídos', async () => {
      const dataInicio = '2024-01-01';
      const dataFim = '2024-01-31';

      const result = await gerarRelatorioCSV(dataInicio, dataFim);

      expect(result).toContain('Data');
      expect(result).toContain('João Silva');
      expect(result).toContain('Maria Santos');
      expect(result).not.toContain('Pedro Oliveira'); // Status pendente
      expect(result.split('\n').length).toBeGreaterThan(2); // Cabeçalho + pelo menos 2 linhas
    });
  });
});
