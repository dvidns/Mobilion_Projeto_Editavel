import * as XLSX from 'xlsx';
import { getAgendamentos, type Agendamento } from './store';

function formatMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Helper para obter o valor a usar (recebido ou orçado)
function getValor(agendamento: Agendamento): number {
  return agendamento.valorRecebido !== undefined ? agendamento.valorRecebido : agendamento.valor;
}

export async function gerarRelatorioExcel(dataInicio: string, dataFim: string): Promise<string> {
  const agendamentos = await getAgendamentos();
  
  // Filtrar por período
  const filtrados = agendamentos.filter(a => {
    const dataAgendamento = a.data;
    return dataAgendamento >= dataInicio && dataAgendamento <= dataFim && a.status === 'concluido';
  });

  // Preparar dados para Excel
  const dados = filtrados.map(a => ({
    'Data': formatDate(a.data),
    'Horário': a.hora,
    'Cliente': a.clienteNome,
    'Telefone': a.clienteTelefone,
    'Serviço': a.tipoServico,
    'Valor Orçado': a.valor,
    'Valor Recebido': getValor(a),
    'Status': a.status,
  }));

  // Calcular totais usando valor recebido
  const total = filtrados.reduce((sum, a) => sum + getValor(a), 0);
  const quantidade = filtrados.length;

  // Criar workbook
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

  // Adicionar resumo
  const wsResumo = XLSX.utils.aoa_to_sheet([
    ['RESUMO DO PERÍODO'],
    [''],
    ['Data Início', dataInicio],
    ['Data Fim', dataFim],
    [''],
    ['Total de Serviços', quantidade],
    ['Faturamento Total (Recebido)', total],
    ['Ticket Médio', total / quantidade || 0],
  ]);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // Gerar arquivo
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const filename = `relatorio_${dataInicio}_${dataFim}.xlsx`;
  
  return wbout;
}

export async function gerarRelatorioPDF(dataInicio: string, dataFim: string): Promise<string> {
  const agendamentos = await getAgendamentos();
  
  // Filtrar por período
  const filtrados = agendamentos.filter(a => {
    const dataAgendamento = a.data;
    return dataAgendamento >= dataInicio && dataAgendamento <= dataFim && a.status === 'concluido';
  });

  // Calcular totais usando valor recebido
  const total = filtrados.reduce((sum, a) => sum + getValor(a), 0);
  const quantidade = filtrados.length;
  const ticket = quantidade > 0 ? total / quantidade : 0;

  // Agrupar por tipo de serviço usando valor recebido
  const porServico: { [key: string]: number } = {};
  filtrados.forEach(a => {
    porServico[a.tipoServico] = (porServico[a.tipoServico] || 0) + getValor(a);
  });

  // Criar HTML para PDF
  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          h1 { color: #0a7ea4; margin-bottom: 10px; }
          h2 { color: #0a7ea4; font-size: 16px; margin-top: 20px; margin-bottom: 10px; }
          .resumo { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .resumo-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #0a7ea4; color: white; padding: 10px; text-align: left; font-weight: bold; }
          td { padding: 10px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background: #f9f9f9; }
          .total { font-weight: bold; background: #e8f4f8; }
          .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <h1>📊 Relatório de Faturamento</h1>
        <p><strong>Período:</strong> ${formatDate(dataInicio)} a ${formatDate(dataFim)}</p>
        
        <div class="resumo">
          <div class="resumo-item">
            <span>Total de Serviços Realizados:</span>
            <strong>${quantidade}</strong>
          </div>
          <div class="resumo-item">
            <span>Faturamento Total (Recebido):</span>
            <strong>${formatMoney(total)}</strong>
          </div>
          <div class="resumo-item">
            <span>Ticket Médio:</span>
            <strong>${formatMoney(ticket)}</strong>
          </div>
        </div>

        <h2>Faturamento por Tipo de Serviço</h2>
        <table>
          <tr>
            <th>Tipo de Serviço</th>
            <th style="text-align: right;">Total</th>
          </tr>
          ${Object.entries(porServico).map(([servico, valor]) => `
            <tr>
              <td>${servico}</td>
              <td style="text-align: right;">${formatMoney(valor)}</td>
            </tr>
          `).join('')}
          <tr class="total">
            <td>TOTAL</td>
            <td style="text-align: right;">${formatMoney(total)}</td>
          </tr>
        </table>

        <h2>Serviços Realizados</h2>
        <table>
          <tr>
            <th>Data</th>
            <th>Cliente</th>
            <th>Serviço</th>
            <th style="text-align: right;">Valor Orçado</th>
            <th style="text-align: right;">Valor Recebido</th>
          </tr>
          ${filtrados.map(a => `
            <tr>
              <td>${formatDate(a.data)}</td>
              <td>${a.clienteNome}</td>
              <td>${a.tipoServico}</td>
              <td style="text-align: right;">${formatMoney(a.valor)}</td>
              <td style="text-align: right;">${formatMoney(getValor(a))}</td>
            </tr>
          `).join('')}
        </table>

        <div class="footer">
          <p>Relatório gerado automaticamente pelo MontaFácil</p>
          <p>${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </body>
    </html>
  `;

  return html;
}

export async function gerarRelatorioAgendamentosPDF(dataInicio: string, dataFim: string): Promise<string> {
  const agendamentos = await getAgendamentos();
  
  // Filtrar por período (todos os status)
  const filtrados = agendamentos.filter(a => {
    const dataAgendamento = a.data;
    return dataAgendamento >= dataInicio && dataAgendamento <= dataFim;
  });

  // Agrupar por status
  const porStatus: { [key: string]: typeof filtrados } = {};
  filtrados.forEach(a => {
    if (!porStatus[a.status]) porStatus[a.status] = [];
    porStatus[a.status].push(a);
  });

  // Calcular estatísticas
  const totalAgendamentos = filtrados.length;
  const concluidos = porStatus['concluido']?.length || 0;
  const pendentes = porStatus['pendente']?.length || 0;
  const cancelados = porStatus['cancelado']?.length || 0;

  // Criar HTML para PDF
  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          h1 { color: #0a7ea4; margin-bottom: 10px; }
          h2 { color: #0a7ea4; font-size: 16px; margin-top: 20px; margin-bottom: 10px; }
          .resumo { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .resumo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
          .resumo-item { text-align: center; padding: 10px; background: white; border-radius: 4px; }
          .resumo-label { font-size: 12px; color: #666; margin-bottom: 5px; }
          .resumo-value { font-size: 18px; font-weight: bold; color: #0a7ea4; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #0a7ea4; color: white; padding: 10px; text-align: left; font-weight: bold; }
          td { padding: 10px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background: #f9f9f9; }
          .status-pendente { color: #f59e0b; font-weight: bold; }
          .status-concluido { color: #10b981; font-weight: bold; }
          .status-cancelado { color: #ef4444; font-weight: bold; }
          .footer { margin-top: 30px; font-size: 12px; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <h1>📅 Relatório de Agendamentos</h1>
        <p><strong>Período:</strong> ${formatDate(dataInicio)} a ${formatDate(dataFim)}</p>
        
        <div class="resumo">
          <div class="resumo-grid">
            <div class="resumo-item">
              <div class="resumo-label">Total de Agendamentos</div>
              <div class="resumo-value">${totalAgendamentos}</div>
            </div>
            <div class="resumo-item">
              <div class="resumo-label">Concluídos</div>
              <div class="resumo-value">${concluidos}</div>
            </div>
            <div class="resumo-item">
              <div class="resumo-label">Pendentes</div>
              <div class="resumo-value">${pendentes}</div>
            </div>
            <div class="resumo-item">
              <div class="resumo-label">Cancelados</div>
              <div class="resumo-value">${cancelados}</div>
            </div>
          </div>
        </div>

        ${Object.entries(porStatus).map(([status, agendamentos]) => `
          <h2>${status.charAt(0).toUpperCase() + status.slice(1)}s</h2>
          <table>
            <tr>
              <th>Data</th>
              <th>Hora</th>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>Serviço</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
            ${agendamentos.map(a => `
              <tr>
                <td>${formatDate(a.data)}</td>
                <td>${a.hora}</td>
                <td>${a.clienteNome}</td>
                <td>${a.clienteTelefone}</td>
                <td>${a.tipoServico}</td>
                <td>${formatMoney(getValor(a))}</td>
                <td class="status-${a.status}">${a.status}</td>
              </tr>
            `).join('')}
          </table>
        `).join('')}

        <div class="footer">
          <p>Relatório gerado automaticamente pelo MontaFácil</p>
          <p>${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </body>
    </html>
  `;

  return html;
}

export async function gerarRelatorioCSV(dataInicio: string, dataFim: string): Promise<string> {
  const agendamentos = await getAgendamentos();
  
  // Filtrar por período
  const filtrados = agendamentos.filter(a => {
    const dataAgendamento = a.data;
    return dataAgendamento >= dataInicio && dataAgendamento <= dataFim && a.status === 'concluido';
  });

  // Cabeçalho CSV
  const cabecalho = ['Data', 'Horário', 'Cliente', 'Telefone', 'Serviço', 'Valor Orçado', 'Valor Recebido', 'Status'];
  
  // Dados CSV
  const linhas = filtrados.map(a => [
    formatDate(a.data),
    a.hora,
    a.clienteNome,
    a.clienteTelefone,
    a.tipoServico,
    a.valor,
    getValor(a),
    a.status,
  ]);

  // Montar CSV
  const csv = [
    cabecalho.join(','),
    ...linhas.map(linha => linha.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csv;
}
