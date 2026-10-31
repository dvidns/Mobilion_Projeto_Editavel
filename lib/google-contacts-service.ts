import { getValidAccessToken } from "./google-auth-service";
import {
  getClientes,
  addCliente,
  atualizarEnderecoCliente,
  type Cliente,
} from "./store";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface GoogleContactPerson {
  resourceName: string;
  etag?: string;
  name: string;
  phoneNumbers: string[];
  primaryPhone: string;
  emails: string[];
  address?: string;
  organization?: string;
  photoUrl?: string;
}

export interface GoogleContactsImportResult {
  totalFound: number;
  imported: number;
  alreadyRegistered: number;
  updated: number;
  clients: Cliente[];
  errors: string[];
}

export interface GoogleContactPreviewItem extends GoogleContactPerson {
  isRegistered: boolean;
  existingClientId?: string;
  existingClientName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normalizePhoneNumber(rawPhone: string): string {
  const digits = (rawPhone || "").replace(/\D/g, "");
  // Se começar com DDI 55 e tiver 12 ou 13 dígitos, extrai o número com DDD
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

function parsePerson(person: any): GoogleContactPerson | null {
  const names = person.names || [];
  const primaryName = names.find((n: any) => n.metadata?.primary) || names[0];
  const displayName = primaryName?.displayName || primaryName?.givenName || "Sem Nome";

  const phones = (person.phoneNumbers || []).map((p: any) => (p.value || "").trim()).filter(Boolean);
  if (phones.length === 0) {
    // Contato sem telefone não é cliente válido para montagens
    return null;
  }

  const primaryPhone = phones[0];
  const emails = (person.emailAddresses || []).map((e: any) => (e.value || "").trim()).filter(Boolean);

  const addresses = person.addresses || [];
  const primaryAddress = addresses.find((a: any) => a.metadata?.primary) || addresses[0];
  const formattedAddress = primaryAddress?.formattedValue ||
    [primaryAddress?.streetAddress, primaryAddress?.sublocality, primaryAddress?.city]
      .filter(Boolean)
      .join(", ");

  const orgs = person.organizations || [];
  const organization = orgs[0]?.name;

  const photos = person.photos || [];
  const photoUrl = photos.find((p: any) => !p.default)?.url || photos[0]?.url;

  return {
    resourceName: person.resourceName,
    etag: person.etag,
    name: displayName,
    phoneNumbers: phones,
    primaryPhone,
    emails,
    address: formattedAddress || undefined,
    organization,
    photoUrl,
  };
}

// ─── Funções Principais da People API ─────────────────────────────────────────

/**
 * Busca a lista de contatos do Google da conta conectada (ex: atendimento.mobilio@gmail.com).
 */
export async function fetchGoogleContacts(pageSize = 100, pageToken?: string): Promise<{
  contacts: GoogleContactPerson[];
  nextPageToken?: string;
  totalPeople?: number;
}> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Conta Google não conectada. Faça login com a conta da Mobilion para continuar.");
  }

  const url = new URL("https://people.googleapis.com/v1/people/me/connections");
  url.searchParams.set("personFields", "names,phoneNumbers,addresses,emailAddresses,photos,organizations");
  url.searchParams.set("pageSize", String(Math.min(pageSize, 300)));
  url.searchParams.set("sortOrder", "FIRST_NAME_ASCENDING");
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[GoogleContacts] Erro na requisição People API:", response.status, errorText);
    if (response.status === 401) {
      throw new Error("Sessão Google expirada. Por favor, reconecte a conta.");
    }
    if (response.status === 403) {
      throw new Error("Acesso aos contatos não autorizado. Verifique as permissões da conta.");
    }
    throw new Error(`Falha ao obter contatos do Google: ${response.status}`);
  }

  const data = await response.json();
  const rawConnections = data.connections || [];
  const contacts: GoogleContactPerson[] = [];

  for (const person of rawConnections) {
    const parsed = parsePerson(person);
    if (parsed) {
      contacts.push(parsed);
    }
  }

  return {
    contacts,
    nextPageToken: data.nextPageToken,
    totalPeople: data.totalPeople,
  };
}

/**
 * Pesquisa contatos na People API por termo de busca.
 */
export async function searchGoogleContacts(query: string, pageSize = 30): Promise<GoogleContactPerson[]> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Conta Google não conectada.");
  }

  const trimmed = (query || "").trim();
  if (!trimmed) {
    const result = await fetchGoogleContacts(pageSize);
    return result.contacts;
  }

  const url = new URL("https://people.googleapis.com/v1/people:searchContacts");
  url.searchParams.set("query", trimmed);
  url.searchParams.set("readMask", "names,phoneNumbers,addresses,emailAddresses,photos");
  url.searchParams.set("pageSize", String(pageSize));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    // Fallback: se o endpoint search não estiver liberado ou falhar, busca conexões e filtra localmente
    console.warn("[GoogleContacts] Search endpoint falhou, usando fallback local:", response.status);
    const all = await fetchGoogleContacts(100);
    const q = trimmed.toLowerCase();
    return all.contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phoneNumbers.some((p) => p.includes(q) || normalizePhoneNumber(p).includes(q))
    );
  }

  const data = await response.json();
  const rawResults = data.results || [];
  const contacts: GoogleContactPerson[] = [];

  for (const r of rawResults) {
    const parsed = parsePerson(r.person);
    if (parsed) {
      contacts.push(parsed);
    }
  }

  return contacts;
}

/**
 * Carrega a prévia dos contatos do Google comparando com os clientes já cadastrados no app.
 * Identifica contatos novos e já existentes por telefone.
 */
export async function getGoogleContactsPreview(query?: string): Promise<GoogleContactPreviewItem[]> {
  const [googleContacts, existingClients] = await Promise.all([
    query ? searchGoogleContacts(query) : fetchGoogleContacts(150).then((r) => r.contacts),
    getClientes(),
  ]);

  // Mapa de telefones higienizados existentes -> Cliente
  const phoneMap = new Map<string, Cliente>();
  for (const c of existingClients) {
    const norm = normalizePhoneNumber(c.telefone);
    if (norm) phoneMap.set(norm, c);
  }

  return googleContacts.map((contact) => {
    let matchedClient: Cliente | undefined;

    for (const phone of contact.phoneNumbers) {
      const norm = normalizePhoneNumber(phone);
      if (norm && phoneMap.has(norm)) {
        matchedClient = phoneMap.get(norm);
        break;
      }
    }

    return {
      ...contact,
      isRegistered: Boolean(matchedClient),
      existingClientId: matchedClient?.id,
      existingClientName: matchedClient?.nome,
    };
  });
}

/**
 * Importa um único contato do Google para o cadastro de clientes do app.
 * Evita duplicação e preserva histórico de endereços.
 */
export async function importSingleGoogleContact(
  contact: GoogleContactPerson
): Promise<{ client: Cliente; action: "created" | "updated" | "exists" }> {
  const existingClients = await getClientes();
  const contactNormPhones = contact.phoneNumbers.map(normalizePhoneNumber).filter(Boolean);

  let existing = existingClients.find((c) => {
    const clientNorm = normalizePhoneNumber(c.telefone);
    return contactNormPhones.includes(clientNorm);
  });

  if (!existing) {
    // Se não encontrou por telefone, checa por nome exato
    existing = existingClients.find(
      (c) => c.nome.trim().toLowerCase() === contact.name.trim().toLowerCase()
    );
  }

  if (existing) {
    // Se o contato do Google tiver um endereço e for diferente do atual, preserva histórico
    if (contact.address && contact.address.trim()) {
      await atualizarEnderecoCliente(existing.id, contact.address.trim());
    }
    return { client: existing, action: "exists" };
  }

  // Criar novo cliente
  const primaryPhone = contact.primaryPhone.replace(/\D/g, "");
  const novoCliente = await addCliente({
    nome: contact.name,
    telefone: primaryPhone,
    endereco: contact.address || undefined,
    notas: contact.emails.length > 0 ? `E-mail: ${contact.emails.join(", ")}` : undefined,
  });

  return { client: novoCliente, action: "created" };
}

/**
 * Importa uma lista de contatos do Google selecionados em lote.
 */
export async function importGoogleContactsBatch(
  contacts: GoogleContactPerson[]
): Promise<GoogleContactsImportResult> {
  const result: GoogleContactsImportResult = {
    totalFound: contacts.length,
    imported: 0,
    alreadyRegistered: 0,
    updated: 0,
    clients: [],
    errors: [],
  };

  for (const contact of contacts) {
    try {
      const res = await importSingleGoogleContact(contact);
      result.clients.push(res.client);
      if (res.action === "created") result.imported++;
      else if (res.action === "updated") result.updated++;
      else result.alreadyRegistered++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      result.errors.push(`Erro ao importar ${contact.name}: ${msg}`);
    }
  }

  return result;
}

