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
  servicos: Array<{ nome: string; valor: number; quantidade?: number; valorUnitario?: number }>;
  total: number;
  descricao?: string;
  orcamentoNumero?: string;
  logoUrl?: string;
  empresaNome?: string;
  empresaContatoLinha?: string;
  formaPagamento?: string;
}): Promise<string> {
  try {
    const numero = data.orcamentoNumero || String(Date.now()).slice(-4);
    const logoUrl = data.logoUrl || "https://d2xsxph8kpxj0f.cloudfront.net/310519663438980202/eyEcvAko3wkySuXB2paUwC/icon-fuS4q2CmL3LtgfK7i9JJLH.png";
    const empresaNome = data.empresaNome || "MontaFácil";
    const empresaContatoLinha = data.empresaContatoLinha || "Tel: (11) 99999-9999 - Email: contato@montafacil.com.br";
    const formaPagamento = data.formaPagamento || "Pix | Cartão | Boleto | Transferência";

    const formatMoney = (value: number) =>
      value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const tableRows = data.servicos.map((s) => {
      const qtd = Math.max(1, Number(s.quantidade) || 1);
      const totalLinha = Number(s.valor) || 0;
      const unit = s.valorUnitario !== undefined
        ? Number(s.valorUnitario) || 0
        : (qtd > 0 ? totalLinha / qtd : totalLinha);

      return `
        <tr>
          <td>${s.nome}</td>
          <td class="center">${qtd}</td>
          <td class="right">${formatMoney(unit)}</td>
          <td class="right">${formatMoney(totalLinha)}</td>
        </tr>
      `;
    }).join("");

    // Criar HTML do orçamento
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 26px; color: #232323; }
          .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
          .brand { display: flex; align-items: center; gap: 10px; }
          .logo { width: 48px; height: 48px; object-fit: contain; }
          .brand-name { font-size: 28px; font-weight: 800; color: #0d4ea6; letter-spacing: 0.4px; }
          .budget-meta { text-align: right; }
          .budget-title { font-size: 30px; font-weight: 800; color: #202020; }
          .budget-date { margin-top: 6px; font-size: 14px; color: #404040; }
          .line { border-bottom: 1px solid #cfcfcf; margin: 8px 0 14px 0; }
          .company-line { font-size: 13px; color: #4b4b4b; margin-bottom: 10px; }
          .section-title {
            color: #0d4ea6;
            font-weight: 800;
            font-size: 18px;
            border-bottom: 1px solid #d9d9d9;
            padding-bottom: 6px;
            margin: 14px 0 10px 0;
          }
          .info { font-size: 15px; line-height: 1.75; }
          .info b { color: #222; }
          .maps { color: #0d4ea6; text-decoration: none; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
          thead th {
            background: #0d4ea6;
            color: #fff;
            padding: 10px 8px;
            text-align: left;
            border: 1px solid #285ea9;
          }
          td {
            border: 1px solid #d0d0d0;
            padding: 9px 8px;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .total-row td { font-weight: 700; font-size: 17px; color: #0d4ea6; }
          .payment { margin-top: 16px; font-size: 14px; }
          .payment b { color: #0d4ea6; }
          .obs { margin-top: 14px; }
          .obs-text { margin-top: 6px; font-size: 14px; }
          .signatures { display: flex; gap: 22px; margin-top: 48px; }
          .sig { flex: 1; text-align: center; }
          .sig-line { border-top: 2px solid #bcbcbc; margin-bottom: 6px; }
          .sig-text { font-style: italic; color: #2d2d2d; }
        </style>
      </head>
      <body>
        <div class="top">
          <div class="brand">
            <img class="logo" src="${logoUrl}" alt="Logo" />
            <div class="brand-name">${empresaNome}</div>
          </div>
          <div class="budget-meta">
            <div class="budget-title">ORÇAMENTO No ${numero}</div>
            <div class="budget-date">Data: ${new Date().toLocaleDateString("pt-BR")}</div>
          </div>
        </div>
        <div class="line"></div>
        <div class="company-line">${empresaContatoLinha}</div>
        <div class="line"></div>

        <div class="section-title">Dados do Cliente</div>
        <div class="info">
          <div><b>Nome:</b> ${data.clienteNome}</div>
          <div><b>Endereço:</b> ${data.endereco || "-"}</div>
          <div><b>Telefone:</b> ${data.clienteTel || "-"}</div>
          ${data.clienteEmail ? `<div><b>Email:</b> ${data.clienteEmail}</div>` : ""}
        </div>

        <div class="section-title">Detalhes do Serviço</div>
        <div class="info">
          <div><b>Serviço:</b> ${data.servicos[0]?.nome || "Serviço"}</div>
          <div><b>Data:</b> ${data.data} às ${data.hora}</div>
          <div><b>Local:</b> ${data.endereco || "-"}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th class="center">Qtd.</th>
              <th class="right">V. Unitário</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row">
              <td colspan="3">Valor Total:</td>
              <td class="right">${formatMoney(Number(data.total) || 0)}</td>
            </tr>
          </tbody>
        </table>

        <div class="payment"><b>Forma de Pagamento :</b> ${formaPagamento}</div>

        ${data.descricao ? `
          <div class="obs">
            <div class="section-title">Observações:</div>
            <div class="obs-text">${data.descricao}</div>
          </div>
        ` : ''}

        <div class="signatures">
          <div class="sig">
            <div class="sig-line"></div>
            <div class="sig-text">Agradecemos a preferência!</div>
          </div>
          <div class="sig">
            <div class="sig-line"></div>
            <div class="sig-text">Técnico Responsável</div>
          </div>
          <div class="sig">
            <div class="sig-line"></div>
            <div class="sig-text">Cliente</div>
          </div>
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
