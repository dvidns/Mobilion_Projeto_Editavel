import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock AsyncStorage
const storage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
      return Promise.resolve();
    }),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach((k) => delete storage[k]);
      return Promise.resolve();
    }),
  },
}));

import {
  getClientes, addCliente, deleteCliente,
  getAgendamentos, addAgendamento, updateAgendamento,
  getServicos, SERVICOS_PADRAO,
  getOrcamentos, addOrcamento, updateOrcamento, deleteOrcamento,
} from "../lib/store";

beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
});

describe("Clientes", () => {
  it("retorna lista vazia inicialmente", async () => {
    const clientes = await getClientes();
    expect(clientes).toEqual([]);
  });

  it("adiciona e recupera cliente", async () => {
    const c = await addCliente({ nome: "João Silva", telefone: "11999999999" });
    expect(c.nome).toBe("João Silva");
    expect(c.id).toBeTruthy();
    const all = await getClientes();
    expect(all).toHaveLength(1);
    expect(all[0].nome).toBe("João Silva");
  });

  it("exclui cliente", async () => {
    const c = await addCliente({ nome: "Maria", telefone: "11888888888" });
    await deleteCliente(c.id);
    const all = await getClientes();
    expect(all).toHaveLength(0);
  });
});

describe("Agendamentos", () => {
  it("retorna lista vazia inicialmente", async () => {
    const ags = await getAgendamentos();
    expect(ags).toEqual([]);
  });

  it("adiciona agendamento com dados corretos", async () => {
    const ag = await addAgendamento({
      clienteId: "c1",
      clienteNome: "Pedro",
      clienteTelefone: "11777777777",
      data: "2025-12-25",
      hora: "09:00",
      tipoServico: "Guarda-roupa 3 portas",
      valor: 130,
      status: "pendente",
      moveis: [
        {
          id: "m1",
          servicoNome: "Guarda-roupa 3 portas",
          valor: 130,
          quantidade: 1,
        },
      ],
    });
    expect(ag.tipoServico).toBe("Guarda-roupa 3 portas");
    expect(ag.valor).toBe(130);
    expect(ag.status).toBe("pendente");
  });

  it("atualiza status do agendamento", async () => {
    const ag = await addAgendamento({
      clienteId: "c2",
      clienteNome: "Ana",
      clienteTelefone: "11666666666",
      data: "2025-12-26",
      hora: "10:00",
      tipoServico: "Cama de casal",
      valor: 100,
      moveis: [
        {
          id: "m2",
          servicoNome: "Cama de casal",
          valor: 100,
          quantidade: 1,
        },
      ],
      status: "pendente",
    });
    await updateAgendamento(ag.id, { status: "concluido" });
    const all = await getAgendamentos();
    const updated = all.find((a) => a.id === ag.id);
    expect(updated?.status).toBe("concluido");
  });
});

describe("Serviços", () => {
  it("retorna serviços padrão quando não há dados salvos", async () => {
    const servicos = await getServicos();
    expect(servicos.length).toBe(SERVICOS_PADRAO.length);
    expect(servicos[0].nome).toBe("Guarda-roupa 2 portas");
  });

  it("serviços padrão têm valores min/max/sugerido válidos", () => {
    for (const s of SERVICOS_PADRAO) {
      expect(s.valorMin).toBeGreaterThan(0);
      expect(s.valorMax).toBeGreaterThanOrEqual(s.valorMin);
      expect(s.valorSugerido).toBeGreaterThanOrEqual(s.valorMin);
      expect(s.valorSugerido).toBeLessThanOrEqual(s.valorMax);
    }
  });
});

describe("Orçamentos", () => {
  it("retorna lista vazia inicialmente", async () => {
    const ors = await getOrcamentos();
    expect(ors).toEqual([]);
  });

  it("adiciona orçamento e calcula total", async () => {
    const itens = [
      { servicoId: "s1", servicoNome: "Guarda-roupa 2 portas", quantidade: 1, valor: 100 },
      { servicoId: "s2", servicoNome: "Cama de casal", quantidade: 2, valor: 80 },
    ];
    const total = itens.reduce((s, i) => s + i.valor * i.quantidade, 0);
    const or = await addOrcamento({
      clienteId: "c1",
      clienteNome: "Carlos",
      clienteTelefone: "11555555555",
      itens,
      total,
      status: "pendente",
    });
    expect(or.total).toBe(260);
    expect(or.itens).toHaveLength(2);
  });

  it("atualiza status do orçamento", async () => {
    const or = await addOrcamento({
      clienteId: "c3",
      clienteNome: "Lucia",
      clienteTelefone: "11444444444",
      itens: [{ servicoId: "s3", servicoNome: "Cômoda", quantidade: 1, valor: 80 }],
      total: 80,
      status: "pendente",
    });
    await updateOrcamento(or.id, { status: "aprovado" });
    const all = await getOrcamentos();
    const updated = all.find((o) => o.id === or.id);
    expect(updated?.status).toBe("aprovado");
  });

  it("exclui orçamento", async () => {
    const or = await addOrcamento({
      clienteId: "c4",
      clienteNome: "Teste",
      clienteTelefone: "11333333333",
      itens: [],
      total: 0,
      status: "pendente",
    });
    await deleteOrcamento(or.id);
    const all = await getOrcamentos();
    expect(all.find((o) => o.id === or.id)).toBeUndefined();
  });
});


describe("Agendamentos com Retorno", () => {
  it("adiciona agendamento com retorno e endereço de retorno", async () => {
    const ag = await addAgendamento({
      clienteId: "c1",
      clienteNome: "Pedro",
      clienteTelefone: "11777777777",
      data: "2025-12-25",
      hora: "09:00",
      tipoServico: "Guarda-roupa 3 portas",
      endereco: "Rua A, 123, São Paulo",
      valor: 65, // 50% do valor total (130/2)
      status: "pendente",
      moveis: [
        {
          id: "m1",
          servicoNome: "Guarda-roupa 3 portas",
          valor: 130,
          quantidade: 1,
        },
      ],
      temRetorno: true,
      dataRetorno: "2025-12-26",
      horaRetorno: "14:00",
      enderecoRetorno: "Rua B, 456, São Paulo",
    });
    expect(ag.temRetorno).toBe(true);
    expect(ag.dataRetorno).toBe("2025-12-26");
    expect(ag.horaRetorno).toBe("14:00");
    expect(ag.enderecoRetorno).toBe("Rua B, 456, São Paulo");
    expect(ag.valor).toBe(65); // 50% do valor total
  });

  it("atualiza endereço de retorno", async () => {
    const ag = await addAgendamento({
      clienteId: "c2",
      clienteNome: "Ana",
      clienteTelefone: "11666666666",
      data: "2025-12-26",
      hora: "10:00",
      tipoServico: "Cama de casal",
      endereco: "Rua C, 789, São Paulo",
      valor: 50, // 50% do valor total (100/2)
      status: "pendente",
      moveis: [
        {
          id: "m2",
          servicoNome: "Cama de casal",
          valor: 100,
          quantidade: 1,
        },
      ],
      temRetorno: true,
      dataRetorno: "2025-12-27",
      horaRetorno: "15:00",
      enderecoRetorno: "Rua D, 101, São Paulo",
    });
    
    // Atualizar endereço de retorno
    await updateAgendamento(ag.id, { enderecoRetorno: "Rua E, 202, São Paulo" });
    
    const all = await getAgendamentos();
    const updated = all.find((a) => a.id === ag.id);
    expect(updated?.enderecoRetorno).toBe("Rua E, 202, São Paulo");
  });

  it("agendamento sem retorno não tem endereço de retorno", async () => {
    const ag = await addAgendamento({
      clienteId: "c3",
      clienteNome: "Carlos",
      clienteTelefone: "11555555555",
      data: "2025-12-28",
      hora: "11:00",
      tipoServico: "Cômoda",
      endereco: "Rua F, 303, São Paulo",
      valor: 80,
      status: "pendente",
      moveis: [
        {
          id: "m3",
          servicoNome: "Cômoda",
          valor: 80,
          quantidade: 1,
        },
      ],
    });
    expect(ag.temRetorno).toBeUndefined();
    expect(ag.enderecoRetorno).toBeUndefined();
  });
});


describe("Exibição de Retorno no Calendário", () => {
  it("agendamento com retorno deve ter label correto para cada data", async () => {
    const ag = await addAgendamento({
      clienteId: "c1",
      clienteNome: "Pedro",
      clienteTelefone: "11777777777",
      data: "2025-12-25",
      hora: "09:00",
      tipoServico: "Guarda-roupa 3 portas",
      endereco: "Rua A, 123, São Paulo",
      valor: 65, // 50% do valor total
      status: "pendente",
      moveis: [
        {
          id: "m1",
          servicoNome: "Guarda-roupa 3 portas",
          valor: 130,
          quantidade: 1,
        },
      ],
      temRetorno: true,
      dataRetorno: "2025-12-26",
      horaRetorno: "14:00",
      enderecoRetorno: "Rua B, 456, São Paulo",
    });

    // Simular o que o calendário faria
    const selectedDate = "2025-12-25";
    const dayItems = [];
    
    // Agendamento original
    if (ag.data === selectedDate) {
      dayItems.push({ ...ag, isRetorno: false });
    }
    // Retorno
    if (ag.temRetorno && ag.dataRetorno === selectedDate) {
      dayItems.push({ ...ag, isRetorno: true });
    }

    // Na data original, deve ter apenas o agendamento
    expect(dayItems).toHaveLength(1); // Um item na data original
    expect(dayItems[0].isRetorno).toBe(false); // Deve ser o agendamento original, não o retorno
    
    // Verificar que o agendamento tem os dados corretos
    expect(ag.tipoServico).toBe("Guarda-roupa 3 portas");
    expect(ag.valor).toBe(65); // 50% do valor total
    expect(ag.temRetorno).toBe(true);
    expect(ag.dataRetorno).toBe("2025-12-26");
    expect(ag.horaRetorno).toBe("14:00");
  });

  it("na data de retorno, deve aparecer apenas o retorno", async () => {
    const ag = await addAgendamento({
      clienteId: "c2",
      clienteNome: "Ana",
      clienteTelefone: "11666666666",
      data: "2025-12-26",
      hora: "10:00",
      tipoServico: "Cama de casal",
      endereco: "Rua C, 789, São Paulo",
      valor: 50, // 50% do valor total
      status: "pendente",
      moveis: [
        {
          id: "m2",
          servicoNome: "Cama de casal",
          valor: 100,
          quantidade: 1,
        },
      ],
      temRetorno: true,
      dataRetorno: "2025-12-27",
      horaRetorno: "15:00",
      enderecoRetorno: "Rua D, 101, São Paulo",
    });

    // Simular o que o calendário faria na data de retorno
    const selectedDate = "2025-12-27";
    const dayItems = [];
    
    // Agendamento original
    if (ag.data === selectedDate) {
      dayItems.push({ ...ag, isRetorno: false });
    }
    // Retorno
    if (ag.temRetorno && ag.dataRetorno === selectedDate) {
      dayItems.push({ ...ag, isRetorno: true });
    }

    // Na data de retorno, deve ter apenas o retorno
    expect(dayItems).toHaveLength(1);
    expect(dayItems[0].isRetorno).toBe(true);
    expect(dayItems[0].horaRetorno).toBe("15:00");
    expect(dayItems[0].valor).toBe(50); // 50% do valor total
  });
});
