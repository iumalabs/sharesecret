export interface Params {
  pinSize: number;
  minExpireSeconds: number;
  maxExpireSeconds: number;
  defaultExpireSeconds: number;
}

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: string; attemptsRemaining?: number };

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  if (res.ok) return { ok: true, data: body as T };

  const b = (body ?? {}) as { error?: string; attemptsRemaining?: number };
  return {
    ok: false,
    status: res.status,
    error: b.error ?? `Request failed (${res.status})`,
    attemptsRemaining: b.attemptsRemaining,
  };
}

export async function getParams(): Promise<Params> {
  const res = await fetch("/api/v1/params");
  if (!res.ok) throw new Error(`Failed to load config (${res.status})`);
  return res.json();
}

export function createMessage(
  data: string,
  pin: string,
  expireSeconds: number,
): Promise<ApiResult<{ id: string; expiresAt: number }>> {
  return fetch("/api/v1/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, pin, expireSeconds }),
  }).then((res) => parse<{ id: string; expiresAt: number }>(res));
}

export function checkMessage(id: string): Promise<ApiResult<{ expiresAt: number }>> {
  return fetch(`/api/v1/message/${encodeURIComponent(id)}`).then((res) => parse<{ expiresAt: number }>(res));
}

export function revealMessage(id: string, pin: string): Promise<ApiResult<{ data: string }>> {
  return fetch(`/api/v1/message/${encodeURIComponent(id)}/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  }).then((res) => parse<{ data: string }>(res));
}

export function revokeMessage(id: string): Promise<ApiResult<null>> {
  return fetch(`/api/v1/message/${encodeURIComponent(id)}`, { method: "DELETE" }).then((res) => parse<null>(res));
}
