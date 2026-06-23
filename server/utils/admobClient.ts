import { google } from "googleapis";
import { getAdmobEnv } from "./admobEnv";

export function getAdmobAccountName(publisherId: string): string {
  const id = publisherId.trim();
  if (id.startsWith("accounts/")) return id;
  if (id.startsWith("pub-")) return `accounts/${id}`;
  return `accounts/pub-${id}`;
}

export async function createAdmobApiClient() {
  const { clientId, clientSecret, refreshToken, publisherId } = getAdmobEnv();

  if (!refreshToken || !clientId || !clientSecret || !publisherId) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const admob = google.admob({ version: "v1", auth: oauth2Client });
  const accountName = getAdmobAccountName(publisherId);

  return { admob, accountName };
}
