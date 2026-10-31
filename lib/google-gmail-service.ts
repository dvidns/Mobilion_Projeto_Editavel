import { getValidAccessToken, getStoredUserProfile } from "./google-auth-service";

export interface SendEmailOptions {
  to: string;
  subject: string;
  bodyText: string;
  attachment?: {
    filename: string;
    contentType: string; // ex: 'application/pdf'
    base64Content: string;
  };
}

function base64UrlEncode(str: string): string {
  const base64 = typeof btoa === "function" ? btoa(str) : Buffer.from(str, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Envia e-mail autorizado através da Gmail API pela conta Google conectada (atendimento.mobilio@gmail.com).
 */
export async function sendEmailViaGmail(options: SendEmailOptions): Promise<{ messageId: string }> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Conta Google não conectada. Faça login com a conta da Mobilion para enviar e-mails.");
  }

  const user = await getStoredUserProfile();
  const fromEmail = user?.email || "atendimento.mobilio@gmail.com";

  let rawEmail = "";

  if (options.attachment) {
    const boundary = "==_mime_part_" + Date.now();
    rawEmail = [
      `From: Mobilion Assistente <${fromEmail}>`,
      `To: ${options.to}`,
      `Subject: =?utf-8?B?${typeof btoa === "function" ? btoa(unescape(encodeURIComponent(options.subject))) : Buffer.from(options.subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      options.bodyText,
      "",
      `--${boundary}`,
      `Content-Type: ${options.attachment.contentType}; name="${options.attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${options.attachment.filename}"`,
      "",
      options.attachment.base64Content,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    rawEmail = [
      `From: Mobilion Assistente <${fromEmail}>`,
      `To: ${options.to}`,
      `Subject: =?utf-8?B?${typeof btoa === "function" ? btoa(unescape(encodeURIComponent(options.subject))) : Buffer.from(options.subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      options.bodyText,
    ].join("\r\n");
  }

  const encodedMessage = base64UrlEncode(rawEmail);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[GmailService] Erro ao enviar mensagem:", response.status, errorText);
    throw new Error(`Falha ao enviar e-mail via Gmail: ${response.status}`);
  }

  const data = await response.json();
  return { messageId: data.id };
}

