import { getValidAccessToken } from "./google-auth-service";
import { getOrCreateMobilionCalendar } from "./google-calendar-service";

export interface CreateMeetOptions {
  title: string;
  startDateIso: string;
  endDateIso: string;
  description?: string;
}

export interface GoogleMeetResult {
  meetUrl: string;
  eventId: string;
}

/**
 * Cria uma reunião no Google Meet associada ao atendimento Mobilion via Google Calendar API.
 */
export async function createGoogleMeetMeeting(options: CreateMeetOptions): Promise<GoogleMeetResult> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("Conta Google não conectada.");
  }

  const calendarId = await getOrCreateMobilionCalendar();
  const requestId = "meet_" + Math.random().toString(36).substring(2) + "_" + Date.now();

  const eventPayload = {
    summary: `Reunião / Alinhamento: ${options.title}`,
    description: options.description || "Alinhamento técnico Mobilion Móveis",
    start: {
      dateTime: options.startDateIso,
      timeZone: "America/Sao_Paulo",
    },
    end: {
      dateTime: options.endDateIso,
      timeZone: "America/Sao_Paulo",
    },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    },
  };

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[GoogleMeet] Erro ao criar reunião:", response.status, errorText);
    throw new Error(`Falha ao criar reunião Google Meet: ${response.status}`);
  }

  const data = await response.json();
  const entryPoints = data.conferenceData?.entryPoints || [];
  const videoEntry = entryPoints.find((ep: any) => ep.entryPointType === "video");
  const meetUrl = videoEntry?.uri || data.hangoutLink || `https://meet.google.com/new`;

  return {
    meetUrl,
    eventId: data.id,
  };
}

