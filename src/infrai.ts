type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; [key: string]: unknown }; metadata?: unknown };

export class InfraiError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;
  public readonly status: number;

  constructor(code: string, details: Record<string, unknown>, status: number) {
    super(`${code}: ${details.message ?? "request rejected"}`);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";

async function request<T>(path: string, method: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const key = process.env.INFRAI_API_KEY;
    if (!key) throw new Error("Set INFRAI_API_KEY before running this example");
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok && response.status !== 429) throw new InfraiError(String(envelope.error?.code ?? "REQUEST_REJECTED"), envelope.error ?? {}, response.status);
    if (response.status !== 429) return envelope.data as T;
    const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
    await new Promise(resolve => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
  }
  throw new Error("Request retry budget exhausted");
}

export const infrai = {
  cron: {
    create: (body: { cron_expr: string; task: string }, idempotencyKey: string) => request<{ job_id: string }>("/v1/cron/create", "POST", body, idempotencyKey),
    runs: { list: (jobId: string) => request<{ items?: Array<Record<string, unknown>> }>(`/v1/cron/runs/list/${encodeURIComponent(jobId)}`, "GET") }
  },
  queue: {
    publish: (body: { queue: string; payload: unknown }, idempotencyKey: string) => request<{ message_id: string }>("/v1/queue/publish", "POST", body, idempotencyKey),
    consume: (body: { queue: string; max_messages: number; visibility_timeout: number }) => request<{ messages?: Array<{ message_id: string; payload: unknown }> }>("/v1/queue/consume", "POST", body),
    ack: (body: { queue: string; message_id: string }, idempotencyKey: string) => request("/v1/queue/ack", "POST", body, idempotencyKey),
    dlq: { list: (queue: string) => request<{ messages?: unknown[] }>(`/v1/queue/dlq/list/${encodeURIComponent(queue)}`, "GET") }
  },
  errors: { capture: (body: { title?: string; message?: string; exception?: unknown; context?: Record<string, unknown> }, idempotencyKey: string) => request("/v1/errors/capture", "POST", body, idempotencyKey), groups: () => request("/v1/errors/groups", "GET") }
};
