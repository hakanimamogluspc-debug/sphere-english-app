/**
 * Zoom Server-to-Server OAuth service
 * Requires env vars: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error("ZOOM_CREDENTIALS_MISSING");
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom token error: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export interface ZoomMeeting {
  id: string;
  joinUrl: string;
  startUrl: string;
  password: string;
}

export async function createZoomMeeting(
  title: string,
  startTime: Date,
  durationMinutes: number
): Promise<ZoomMeeting> {
  const token = await getAccessToken();

  const body = {
    topic: title,
    type: 2,
    start_time: startTime.toISOString(),
    duration: durationMinutes,
    timezone: "Europe/Istanbul",
    settings: {
      auto_recording: "none",
      local_recording_disabled: true,
      cloud_recording_disabled: true,
      participant_video: true,
      host_video: true,
      join_before_host: false,
      mute_upon_entry: false,
      waiting_room: false,
      meeting_authentication: false,
    },
  };

  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Zoom meeting creation failed: ${err}`);
  }

  const data = await res.json() as {
    id: number;
    join_url: string;
    start_url: string;
    password: string;
  };

  return {
    id: String(data.id),
    joinUrl: data.join_url,
    startUrl: data.start_url,
    password: data.password,
  };
}

export async function deleteZoomMeeting(meetingId: string): Promise<void> {
  const token = await getAccessToken();
  await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function zoomConfigured(): boolean {
  return !!(
    process.env.ZOOM_ACCOUNT_ID &&
    process.env.ZOOM_CLIENT_ID &&
    process.env.ZOOM_CLIENT_SECRET
  );
}
