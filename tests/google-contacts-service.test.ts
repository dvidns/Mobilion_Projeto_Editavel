import { describe, it, expect, vi, beforeEach } from "vitest";

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
  },
}));

// Mock google-auth-service
vi.mock("../lib/google-auth-service", () => ({
  getValidAccessToken: vi.fn(async () => "mock-token-xyz"),
}));

import {
  normalizePhoneNumber,
  importSingleGoogleContact,
  importGoogleContactsBatch,
  getGoogleContactsPreview,
  type GoogleContactPerson,
} from "../lib/google-contacts-service";
import { getClientes, addCliente } from "../lib/store";

describe("google-contacts-service", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    Object.keys(storage).forEach((k) => delete storage[k]);
  });

  it("deve normalizar telefones com e sem DDI 55", () => {
    expect(normalizePhoneNumber("(11) 98765-4321")).toBe("11987654321");
    expect(normalizePhoneNumber("+55 (11) 98765-4321")).toBe("11987654321");
    expect(normalizePhoneNumber("5511987654321")).toBe("11987654321");
    expect(normalizePhoneNumber("11987654321")).toBe("11987654321");
  });

  it("deve importar novo contato do Google quando não existir localmente", async () => {
    const contact: GoogleContactPerson = {
      resourceName: "people/c1",
      name: "Carlos Ferreira",
      phoneNumbers: ["(11) 97777-6666"],
      primaryPhone: "(11) 97777-6666",
      emails: ["carlos@example.com"],
      address: "Rua das Flores, 123 - Centro",
    };

    const res = await importSingleGoogleContact(contact);
    expect(res.action).toBe("created");
    expect(res.client.nome).toBe("Carlos Ferreira");
    expect(res.client.telefone).toBe("11977776666");
    expect(res.client.endereco).toBe("Rua das Flores, 123 - Centro");

    const todos = await getClientes();
    expect(todos.length).toBe(1);
    expect(todos[0].nome).toBe("Carlos Ferreira");
  });

  it("deve evitar duplicação se o contato já estiver cadastrado", async () => {
    await addCliente({
      nome: "Carlos Ferreira",
      telefone: "11977776666",
      endereco: "Endereço Antigo",
    });

    const contact: GoogleContactPerson = {
      resourceName: "people/c1",
      name: "Carlos Ferreira",
      phoneNumbers: ["+55 11 97777-6666"],
      primaryPhone: "+55 11 97777-6666",
      emails: [],
      address: "Endereço Novo",
    };

    const res = await importSingleGoogleContact(contact);
    expect(res.action).toBe("exists");

    const todos = await getClientes();
    expect(todos.length).toBe(1); // Não duplicou
    // Endereço foi atualizado e antigo foi para o histórico
    expect(todos[0].endereco).toBe("Endereço Novo");
    expect(todos[0].historicoEnderecos).toContain("Endereço Antigo");
  });

  it("deve importar contatos em lote corretamente reportando contadores", async () => {
    // Cadastrar previamente um cliente
    await addCliente({
      nome: "Cliente Existente",
      telefone: "11911112222",
    });

    const contatosGoogle: GoogleContactPerson[] = [
      {
        resourceName: "people/1",
        name: "Cliente Existente",
        phoneNumbers: ["11911112222"],
        primaryPhone: "11911112222",
        emails: [],
      },
      {
        resourceName: "people/2",
        name: "Cliente Novo 1",
        phoneNumbers: ["11933334444"],
        primaryPhone: "11933334444",
        emails: [],
        address: "Av. Paulista, 1000",
      },
      {
        resourceName: "people/3",
        name: "Cliente Novo 2",
        phoneNumbers: ["11955556666"],
        primaryPhone: "11955556666",
        emails: [],
      },
    ];

    const result = await importGoogleContactsBatch(contatosGoogle);

    expect(result.totalFound).toBe(3);
    expect(result.imported).toBe(2);
    expect(result.alreadyRegistered).toBe(1);
    expect(result.errors.length).toBe(0);

    const todos = await getClientes();
    expect(todos.length).toBe(3);
  });
});

