export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type Conversation = {
  id: string;
  title: string;
  status: "ACTIVE" | "CANCELLED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
};

export type DashboardMetrics = {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cancelledRequests: number;
  averageLatencyMs: number;
  errorRate: number;
  throughputPerMinute: number;
  totalTokens: number;
  timeline: Array<{
    timestamp: string;
    requests: number;
    errors: number;
    averageLatencyMs: number;
  }>;
  recentLogs: Array<{
    id: string;
    provider: string;
    model: string;
    latencyMs: number;
    status: "SUCCESS" | "ERROR" | "CANCELLED";
    totalTokens?: number;
    createdAt: string;
  }>;
};

export type ProviderInfo = {
  active: boolean;
  configured: boolean;
  description: string;
  id: "mock" | "gemini" | "openai" | "groq";
  model: string;
  name: string;
};

export type ProviderStatus = {
  activeProviderId: ProviderInfo["id"];
  providers: ProviderInfo[];
};

export async function fetchConversations() {
  return request<Conversation[]>("/api/conversations");
}

export async function createConversation() {
  return request<Conversation>("/api/conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
}

export async function fetchMessages(conversationId: string) {
  return request<ChatMessage[]>(`/api/conversations/${conversationId}/messages`);
}

export async function cancelConversation(conversationId: string) {
  return request<Conversation>(`/api/conversations/${conversationId}/cancel`, {
    method: "PATCH"
  });
}

export async function deleteConversation(conversationId: string) {
  await request<void>(`/api/conversations/${conversationId}`, {
    method: "DELETE"
  });
}

export async function fetchMetrics() {
  return request<DashboardMetrics>("/api/dashboard/metrics");
}

export async function fetchProviders() {
  return request<ProviderStatus>("/api/providers");
}

export async function selectProvider(providerId: ProviderInfo["id"]) {
  return request<ProviderStatus>("/api/providers/active", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ providerId })
  });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, init);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
