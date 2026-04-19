// fix-wizard.mjs - Remove o bloco de lixo do formulário antigo que ficou no novo.tsx
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "app", "agendamento", "novo.tsx");

let src = readFileSync(filePath, "utf8");
const lines = src.split("\n");

// Encontrar índices das linhas marcadoras
const lixoStart = lines.findIndex(l => l.includes("LIXO_MODAL_INICIO"));
if (lixoStart === -1) { console.log("Marcador LIXO_MODAL_INICIO não encontrado — arquivo já limpo?"); process.exit(0); }

// Procurar o segundo Modal de contatos (o real, com "Barra de busca")
const modalRealLine = lines.findIndex((l, i) => i > lixoStart && l.includes("Barra de busca"));
if (modalRealLine === -1) { console.error("Não encontrou 'Barra de busca'"); process.exit(1); }

// O modal real começa 2 linhas acima de "Barra de busca" (tem header + view searchBar)
// Procurar o comentário do modal real acima de "Barra de busca"
let modalRealStartLine = modalRealLine;
for (let i = modalRealLine; i >= lixoStart; i--) {
  if (lines[i].includes("MODAL: Contatos do celular")) {
    modalRealStartLine = i;
    break;
  }
}

console.log(`Removendo linhas ${lixoStart + 1} até ${modalRealStartLine} (${modalRealStartLine - lixoStart} linhas de lixo)`);

// Remover as linhas de lixo (do LIXO_MODAL_INICIO até antes do modal real)
const cleanLines = [...lines.slice(0, lixoStart), ...lines.slice(modalRealStartLine)];
writeFileSync(filePath, cleanLines.join("\n"), "utf8");
console.log("✅ Lixo removido com sucesso! Linhas restantes:", cleanLines.length);
