const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailMessageRef {
  id: string;
  threadId: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  raw?: string;
  historyId?: string;
  internalDate?: string;
}

export interface GmailHistoryRecord {
  id: string;
  messages?: GmailMessageRef[];
  messagesAdded?: { message: GmailMessageRef & { labelIds?: string[] } }[];
}

export interface GmailListMessagesResponse {
  messages?: GmailMessageRef[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailListHistoryResponse {
  history?: GmailHistoryRecord[];
  historyId?: string;
  nextPageToken?: string;
}

export interface GmailProfile {
  emailAddress: string;
  historyId: string;
  messagesTotal: number;
  threadsTotal: number;
}

export interface GmailSendResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type?: "system" | "user";
  messageListVisibility?: "show" | "hide";
  labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
  color?: { textColor: string; backgroundColor: string };
}

export interface GmailListLabelsResponse {
  labels?: GmailLabel[];
}

export interface GmailModifyLabelsArgs {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export class GmailHistoryExpiredError extends Error {
  constructor() {
    super("Gmail history expired (404 from /history endpoint)");
    this.name = "GmailHistoryExpiredError";
  }
}

export class GmailClient {
  constructor(private readonly accessToken: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${GMAIL_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gmail API ${res.status} on ${path}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  async getProfile(): Promise<GmailProfile> {
    return this.request<GmailProfile>("/profile");
  }

  async listMessages(
    query: string,
    maxResults = 100,
    pageToken?: string
  ): Promise<GmailListMessagesResponse> {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(maxResults),
    });
    if (pageToken) params.set("pageToken", pageToken);
    return this.request<GmailListMessagesResponse>(`/messages?${params}`);
  }

  async getMessage(
    id: string,
    format: "raw" | "minimal" | "metadata" | "full" = "raw"
  ): Promise<GmailMessage> {
    const params = new URLSearchParams({ format });
    return this.request<GmailMessage>(`/messages/${id}?${params}`);
  }

  async listHistory(
    startHistoryId: string,
    historyTypes: string[] = ["messageAdded"],
    pageToken?: string
  ): Promise<GmailListHistoryResponse> {
    const params = new URLSearchParams({ startHistoryId });
    for (const t of historyTypes) params.append("historyTypes", t);
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${GMAIL_API_BASE}/history?${params}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (res.status === 404) throw new GmailHistoryExpiredError();
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gmail API ${res.status} on /history: ${body}`);
    }
    return res.json() as Promise<GmailListHistoryResponse>;
  }

  async sendMessage(
    rawBase64Url: string,
    threadId?: string
  ): Promise<GmailSendResponse> {
    return this.request<GmailSendResponse>("/messages/send", {
      method: "POST",
      body: JSON.stringify({
        raw: rawBase64Url,
        ...(threadId ? { threadId } : {}),
      }),
    });
  }

  /**
   * Add and/or remove labels on a thread. Operates on every message in the
   * thread. Idempotent — adding a label already present is a no-op.
   */
  async modifyThread(
    threadId: string,
    args: GmailModifyLabelsArgs
  ): Promise<{ id: string }> {
    return this.request<{ id: string }>(`/threads/${threadId}/modify`, {
      method: "POST",
      body: JSON.stringify({
        addLabelIds: args.addLabelIds ?? [],
        removeLabelIds: args.removeLabelIds ?? [],
      }),
    });
  }

  async listLabels(): Promise<GmailListLabelsResponse> {
    return this.request<GmailListLabelsResponse>("/labels");
  }

  async createLabel(name: string): Promise<GmailLabel> {
    return this.request<GmailLabel>("/labels", {
      method: "POST",
      body: JSON.stringify({
        name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      }),
    });
  }
}
