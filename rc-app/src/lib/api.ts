// fetch 封装:所有请求走 /api,响应一律用 Zod schema 校验(契约即类型,坏数据当场炸)。
import type { z } from "zod";

const BASE = "/api";

async function parse<T>(res: Response, path: string, schema: z.ZodType<T>): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} · ${path}`);
  return schema.parse(await res.json());
}

export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return parse(await fetch(`${BASE}${path}`), path, schema);
}

export async function apiPost<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return parse(res, path, schema);
}

// 列表查询参数 → query string(空值跳过)
export function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
