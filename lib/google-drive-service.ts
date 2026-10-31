import { getValidAccessToken } from "./google-auth-service";
import { prepareBackupData, type BackupData } from "./backup-service";

const DRIVE_FOLDER_NAME = "Mobilion Backup";

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  size?: string;
  webViewLink?: string;
}

/**
 * Localiza ou cria a pasta "Mobilion Backup" no Google Drive da conta autenticada.
 */
export async function getOrCreateDriveFolder(folderName = DRIVE_FOLDER_NAME): Promise<string> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Conta Google não conectada.");
  }

  // 1. Pesquisar se a pasta já existe
  const q = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    throw new Error(`Falha ao buscar pasta no Google Drive: ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Criar a pasta se não existir
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      description: "Pasta de backups e relatórios do Mobilion Assistente",
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Falha ao criar pasta no Google Drive: ${createRes.status}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Faz upload do backup completo do app para a pasta do Google Drive.
 */
export async function uploadBackupToGoogleDrive(): Promise<{ fileId: string; fileName: string }> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Conta Google não conectada.");
  }

  const folderId = await getOrCreateDriveFolder();
  const backupData = await prepareBackupData();

  const date = new Date(backupData.timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}h${pad(date.getMinutes())}`;
  const fileName = `backup_mobilion_${dateStr}.json`;

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: "application/json",
    description: `Backup do Mobilion Assistente - ${new Date().toLocaleString("pt-BR")}`,
  };

  const fileContent = JSON.stringify(backupData, null, 2);

  // Upload multipart no Google Drive
  const boundary = "-------mobilion_boundary_" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    fileContent +
    closeDelimiter;

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error("[GoogleDrive] Erro no upload de backup:", uploadRes.status, errorText);
    throw new Error(`Falha no upload para o Google Drive: ${uploadRes.status}`);
  }

  const resData = await uploadRes.json();
  return { fileId: resData.id, fileName };
}

/**
 * Faz upload de um documento PDF (Orçamento, OS ou Relatório) para o Google Drive.
 */
export async function uploadPdfToGoogleDrive(
  fileName: string,
  pdfBase64: string,
  folderName = DRIVE_FOLDER_NAME
): Promise<{ fileId: string; webViewLink?: string }> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Conta Google não conectada.");
  }

  const folderId = await getOrCreateDriveFolder(folderName);

  const metadata = {
    name: fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
    parents: [folderId],
    mimeType: "application/pdf",
  };

  const boundary = "-------mobilion_pdf_" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/pdf\r\n" +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    pdfBase64 +
    closeDelimiter;

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!uploadRes.ok) {
    throw new Error(`Falha ao enviar PDF para o Google Drive: ${uploadRes.status}`);
  }

  const resData = await uploadRes.json();
  return { fileId: resData.id, webViewLink: resData.webViewLink };
}

/**
 * Lista todos os arquivos de backup salvos no Google Drive.
 */
export async function listDriveBackups(): Promise<DriveFileItem[]> {
  const token = await getValidAccessToken();
  if (!token) return [];

  try {
    const folderId = await getOrCreateDriveFolder();
    const q = `'${folderId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&fields=files(id,name,mimeType,createdTime,size,webViewLink)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error("[GoogleDrive] Erro ao listar backups:", err);
    return [];
  }
}

