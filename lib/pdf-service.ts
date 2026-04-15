import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

/**
 * Gerar PDF de orçamento
 */
export async function generateOrcamentoPDF(data: {
  clienteNome: string;
  clienteTel: string;
  clienteEmail: string;
  data: string;
  hora: string;
  endereco: string;
  servicos: Array<{ nome: string; valor: number }>;
  total: number;
  descricao?: string;
}): Promise<string> {
  try {
    // Criar HTML do orçamento
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0a7ea4; padding-bottom: 15px; }
          .title { font-size: 24px; font-weight: bold; color: #0a7ea4; }
          .subtitle { font-size: 12px; color: #666; margin-top: 5px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; font-size: 14px; color: #0a7ea4; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .info-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
          .label { font-weight: bold; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #0a7ea4; color: white; padding: 8px; text-align: left; font-size: 12px; }
          td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
          .total-row { font-weight: bold; background-color: #f5f5f5; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ORÇAMENTO</div>
          <div class="subtitle">Montador de Móveis - MontaFácil</div>
        </div>

        <div class="section">
          <div class="section-title">Dados do Cliente</div>
          <div class="info-row">
            <span class="label">Nome:</span>
            <span>${data.clienteNome}</span>
          </div>
          <div class="info-row">
            <span class="label">Telefone:</span>
            <span>${data.clienteTel}</span>
          </div>
          <div class="info-row">
            <span class="label">Email:</span>
            <span>${data.clienteEmail}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Dados do Serviço</div>
          <div class="info-row">
            <span class="label">Data:</span>
            <span>${data.data}</span>
          </div>
          <div class="info-row">
            <span class="label">Horário:</span>
            <span>${data.hora}</span>
          </div>
          <div class="info-row">
            <span class="label">Endereço:</span>
            <span>${data.endereco}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Serviços</div>
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th style="text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${data.servicos.map(s => `
                <tr>
                  <td>${s.nome}</td>
                  <td style="text-align: right;">R$ ${s.valor.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td>TOTAL</td>
                <td style="text-align: right;">R$ ${data.total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${data.descricao ? `
          <div class="section">
            <div class="section-title">Observações</div>
            <p style="font-size: 12px; line-height: 1.6;">${data.descricao}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>Este orçamento é válido por 7 dias.</p>
          <p>Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </body>
      </html>
    `;

    // Salvar PDF (simulado - em produção usar biblioteca PDF)
    const fileName = `orcamento_${data.clienteNome.replace(/\s+/g, '_')}_${Date.now()}.html`;
    const filePath = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}${fileName}`;

    if (Platform.OS !== "web") {
      await FileSystem.writeAsStringAsync(filePath, html);
      return filePath;
    }

    // Web: retornar blob URL
    const blob = new Blob([html], { type: "text/html" });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("[PDF] Erro ao gerar orçamento:", err);
    throw err;
  }
}

/**
 * Gerar PDF de ordem de serviço
 */
export async function generateOrdemServiçoPDF(data: {
  clienteNome: string;
  clienteTel: string;
  endereco: string;
  data: string;
  hora: string;
  servicos: Array<{ nome: string; valor: number }>;
  total: number;
  descricao?: string;
  temRetorno?: boolean;
  dataRetorno?: string;
  horaRetorno?: string;
}): Promise<string> {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0a7ea4; padding-bottom: 15px; }
          .title { font-size: 24px; font-weight: bold; color: #0a7ea4; }
          .subtitle { font-size: 12px; color: #666; margin-top: 5px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; font-size: 14px; color: #0a7ea4; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .info-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
          .label { font-weight: bold; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #0a7ea4; color: white; padding: 8px; text-align: left; font-size: 12px; }
          td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
          .total-row { font-weight: bold; background-color: #f5f5f5; }
          .signature-area { margin-top: 40px; display: flex; justify-content: space-around; }
          .signature-line { border-top: 1px solid #000; width: 150px; text-align: center; font-size: 11px; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ORDEM DE SERVIÇO</div>
          <div class="subtitle">Montador de Móveis - MontaFácil</div>
        </div>

        <div class="section">
          <div class="section-title">Dados do Cliente</div>
          <div class="info-row">
            <span class="label">Nome:</span>
            <span>${data.clienteNome}</span>
          </div>
          <div class="info-row">
            <span class="label">Telefone:</span>
            <span>${data.clienteTel}</span>
          </div>
          <div class="info-row">
            <span class="label">Endereço:</span>
            <span>${data.endereco}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Dados do Serviço</div>
          <div class="info-row">
            <span class="label">Data:</span>
            <span>${data.data}</span>
          </div>
          <div class="info-row">
            <span class="label">Horário:</span>
            <span>${data.hora}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Serviços a Executar</div>
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th style="text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${data.servicos.map(s => `
                <tr>
                  <td>${s.nome}</td>
                  <td style="text-align: right;">R$ ${s.valor.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td>TOTAL</td>
                <td style="text-align: right;">R$ ${data.total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${data.descricao ? `
          <div class="section">
            <div class="section-title">Observações</div>
            <p style="font-size: 12px; line-height: 1.6;">${data.descricao}</p>
          </div>
        ` : ''}

        ${data.temRetorno ? `
          <div class="section">
            <div class="section-title">Retorno Agendado</div>
            <div class="info-row">
              <span class="label">Data:</span>
              <span>${data.dataRetorno}</span>
            </div>
            <div class="info-row">
              <span class="label">Horário:</span>
              <span>${data.horaRetorno}</span>
            </div>
          </div>
        ` : ''}

        <div class="signature-area">
          <div>
            <div class="signature-line">Assinatura do Cliente</div>
          </div>
          <div>
            <div class="signature-line">Assinatura do Montador</div>
          </div>
        </div>

        <div class="footer">
          <p>Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </body>
      </html>
    `;

    const fileName = `ordem_${data.clienteNome.replace(/\s+/g, '_')}_${Date.now()}.html`;
    const filePath = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}${fileName}`;

    if (Platform.OS !== "web") {
      await FileSystem.writeAsStringAsync(filePath, html);
      return filePath;
    }

    const blob = new Blob([html], { type: "text/html" });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("[PDF] Erro ao gerar ordem de serviço:", err);
    throw err;
  }
}

/**
 * Compartilhar PDF
 */
export async function sharePDF(filePath: string, fileName: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // Web: abrir em nova aba
      window.open(filePath, "_blank");
      return;
    }

    // Native: usar Sharing
    await Sharing.shareAsync(filePath, {
      mimeType: "text/html",
      dialogTitle: `Compartilhar ${fileName}`,
    });
  } catch (err) {
    console.error("[PDF] Erro ao compartilhar:", err);
    throw err;
  }
}
