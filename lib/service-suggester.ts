import { type Servico } from "./store";

export type SugestaoServico = {
  valor: number;
  razao: string;
};

/**
 * Suggests a price for a new service name based on historical data.
 * 1. Exact name match → use stored valorSugerido
 * 2. Similar services found → average of valorSugerido
 * 3. Hourly rate fallback
 */
export function sugerirValorServico(
  nomeBusca: string,
  servicos: Servico[],
  valorHora: number,
): SugestaoServico | null {
  const nome = nomeBusca.trim();
  if (!nome) return null;

  const q = nome.toLowerCase();

  // 1. Exact match
  const exato = servicos.find((s) => s.nome.toLowerCase() === q);
  if (exato) {
    return {
      valor: exato.valorSugerido,
      razao: `Baseado no serviço "${exato.nome}" já cadastrado`,
    };
  }

  // 2. Similar services (name contains query or query contains first keyword of service name)
  const similares = servicos.filter((s) => {
    const sNome = s.nome.toLowerCase();
    const primeiraPalavra = sNome.split(" ")[0];
    return sNome.includes(q) || (primeiraPalavra.length >= 4 && q.includes(primeiraPalavra));
  });

  if (similares.length > 0) {
    const media = similares.reduce((sum, s) => sum + s.valorSugerido, 0) / similares.length;
    const arredondado = Math.round(media);
    const nomes = similares
      .slice(0, 2)
      .map((s) => s.nome)
      .join(", ");
    return {
      valor: arredondado,
      razao: `Média de serviços similares: ${nomes}${similares.length > 2 ? " e outros" : ""}`,
    };
  }

  // 3. Based on hourly rate (1 hour estimate)
  if (valorHora > 0) {
    return {
      valor: valorHora,
      razao: `Baseado no seu valor/hora configurado (R$${valorHora}/h × 1h)`,
    };
  }

  return null;
}

/**
 * Analyses an already-selected service and returns a suggestion card content.
 * For services with market range data, shows that context.
 * For custom services (no range data), falls back to similar services.
 */
export function analisarServico(
  servico: Servico,
  todos: Servico[],
  valorHora: number,
): SugestaoServico | null {
  const { valorSugerido, valorMin, valorMax, nome } = servico;

  if (valorMin > 0 && valorMax > valorMin) {
    return {
      valor: valorSugerido,
      razao: `Faixa de mercado para "${nome}": R$${valorMin}–R$${valorMax}`,
    };
  }

  // Custom service with no market data – try similar
  const semElePropio = todos.filter((s) => s.id !== servico.id);
  const sugestao = sugerirValorServico(nome, semElePropio, valorHora);
  if (sugestao) return sugestao;

  if (valorSugerido > 0) {
    return {
      valor: valorSugerido,
      razao: `Valor registrado anteriormente para "${nome}"`,
    };
  }

  return null;
}
