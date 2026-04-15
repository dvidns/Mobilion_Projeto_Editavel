import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { gerarRelatorioExcel, gerarRelatorioPDF, gerarRelatorioCSV, gerarRelatorioAgendamentosPDF } from '../lib/report-service';
import { getAgendamentos } from '../lib/store';

// Mock das dependências
vi.mock('xlsx');
vi.mock('../lib/store');

const mockGetAgendamentos = vi.mocked(getAgendamentos);
const mockXLSX = vi.mocked(XLSX);

describe('Report Service', () => {
  const mockAgendamentos = [
    {
      id: '1',
      data: '2024-01-15',
      hora: '10:00',
      clienteNome: 'João Silva',
      clienteTelefone: '11999999999',
      tipoServico: 'Montagem de guarda-roupa',
      valor: 150,
      valorRecebido: 150,
      status: 'concluido' as const,
    },
    {
      id: '2',
      data: '2024-01-16',
      hora: '14:00',
      clienteNome: 'Maria Santos',
      clienteTelefone: '11888888888',
      tipoServico: 'Montagem de cama',
      valor: 100,
      valorRecebido: 120,
      status: 'concluido' as const,
    },
    {
      id: '3',
      data: '2024-01-17',
      hora: '09:00',
      clienteNome: 'Pedro Oliveira',
      clienteTelefone: '11777777777',
      tipoServico: 'Montagem de mesa',
      valor: 80,
      status: 'pendente' as const,
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

      mockXLSX.utils.json_to_sheet.mockReturnValue({});
      mockXLSX.utils.aoa_to_sheet.mockReturnValue({});
      mockXLSX.utils.book_new.mockReturnValue({});
      mockXLSX.utils.book_append_sheet.mockImplementation(() => {});
      mockXLSX.write.mockReturnValue('mocked-base64-data');

      const result = await gerarRelatorioExcel(dataInicio, dataFim);

      expect(mockGetAgendamentos).toHaveBeenCalledTimes(1);
      expect(mockXLSX.utils.json_to_sheet).toHaveBeenCalledWith([
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

      expect(result).toContain('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,mocked-base64-data');
    });

    it('deve calcular totais corretamente', async () => {
      const dataInicio = '2024-01-01';
      const dataFim = '2024-01-31';

      mockXLSX.utils.json_to_sheet.mockReturnValue({});
      mockXLSX.utils.aoa_to_sheet.mockReturnValue({});
      mockXLSX.utils.book_new.mockReturnValue({});
      mockXLSX.utils.book_append_sheet.mockImplementation(() => {});
      mockXLSX.write.mockReturnValue('mocked-base64-data');

      await gerarRelatorioExcel(dataInicio, dataFim);

      // Verifica se o resumo foi criado com os valores corretos
      expect(mockXLSX.utils.aoa_to_sheet).toHaveBeenCalledWith([
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

      mockXLSX.utils.json_to_sheet.mockReturnValue({});
      mockXLSX.utils.aoa_to_sheet.mockReturnValue({});
      mockXLSX.utils.book_new.mockReturnValue({});
      mockXLSX.utils.book_append_sheet.mockImplementation(() => {});
      mockXLSX.write.mockReturnValue('mocked-base64-data');

      await gerarRelatorioExcel(dataInicio, dataFim);

      // Nenhum agendamento deve ser incluído pois estão antes de 20/01
      expect(mockXLSX.utils.json_to_sheet).toHaveBeenCalledWith([]);
    });
  });

  describe('gerarRelatorioAgendamentosPDF', () => {
    it('deve gerar relatório PDF de agendamentos com todos os status', async () => {
      const dataInicio = '2024-01-01';
      const dataFim = '2024-01-31';

      // Mock Buffer.from
      global.Buffer = {
        from: vi.fn().mockReturnValue('mocked-html-base64'),
      } as any;

      const result = await gerarRelatorioAgendamentosPDF(dataInicio, dataFim);

      expect(result).toBe('data:text/html;base64,mocked-html-base64');
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