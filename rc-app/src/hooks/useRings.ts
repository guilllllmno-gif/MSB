// 团伙数据 hooks(TanStack Query)。响应经 Zod 校验。
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, qs } from "@/lib/api";
import { Ring, RingDetail } from "@/schemas/ring";

const RingListResp = z.object({ items: z.array(Ring), total: z.number().int() });
const OkResp = z.object({ ok: z.boolean(), error: z.string().optional() });

export type RingListParams = { status?: string; q?: string; page?: number };

export const useRings = (p: RingListParams = {}) =>
  useQuery({ queryKey: ["rings", p], queryFn: () => apiGet(`/rings${qs(p)}`, RingListResp) });

export const useRing = (id: string | undefined) =>
  useQuery({ queryKey: ["ring", id], enabled: !!id, queryFn: () => apiGet(`/rings/${id}`, RingDetail) });

export function useClaimRing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/rings/${id}/claim`, {}, OkResp),
    onSuccess: (_d, id) => { qc.invalidateQueries({ queryKey: ["ring", id] }); qc.invalidateQueries({ queryKey: ["rings"] }); },
  });
}

export function useEscalateRing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) => apiPost(`/rings/${v.id}/escalate`, { reason: v.reason }, OkResp),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["ring", v.id] }); qc.invalidateQueries({ queryKey: ["rings"] }); },
  });
}
