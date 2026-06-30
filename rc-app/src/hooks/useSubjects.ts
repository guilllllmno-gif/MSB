// 主体 / 归并候选数据 hooks(TanStack Query)。响应经 Zod 校验。
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, qs } from "@/lib/api";
import { Subject, SubjectDetail, MergeCandidate } from "@/schemas/subject";

const SubjectListResp = z.object({ items: z.array(Subject), total: z.number().int() });
const OkResp = z.object({ ok: z.boolean(), auditId: z.string().optional(), recalcTriggered: z.boolean().optional(), error: z.string().optional() });

export type SubjectListParams = { risk?: string; status?: string; q?: string; page?: number };

export const useSubjects = (p: SubjectListParams = {}) =>
  useQuery({ queryKey: ["subjects", p], queryFn: () => apiGet(`/subjects${qs(p)}`, SubjectListResp) });

export const useSubject = (id: string | undefined) =>
  useQuery({ queryKey: ["subject", id], enabled: !!id, queryFn: () => apiGet(`/subjects/${id}`, SubjectDetail) });

export const useMergeCandidates = () =>
  useQuery({ queryKey: ["merge-candidates"], queryFn: () => apiGet(`/merge-candidates`, z.array(MergeCandidate)) });

export function useMergeAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; accountId: string; reason: string }) => apiPost(`/subjects/${v.id}/merge`, { accountId: v.accountId, reason: v.reason }, OkResp),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["subject", v.id] }); qc.invalidateQueries({ queryKey: ["subjects"] }); qc.invalidateQueries({ queryKey: ["merge-candidates"] }); },
  });
}

export function useSplitAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; accountId: string; reason: string }) => apiPost(`/subjects/${v.id}/split`, { accountId: v.accountId, reason: v.reason }, OkResp),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["subject", v.id] }); qc.invalidateQueries({ queryKey: ["subjects"] }); },
  });
}

export function useRejectCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { candidateId: string; reason: string }) => apiPost(`/merge-candidates/${v.candidateId}/reject`, { reason: v.reason }, OkResp),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["merge-candidates"] }); qc.invalidateQueries({ queryKey: ["subjects"] }); },
  });
}
