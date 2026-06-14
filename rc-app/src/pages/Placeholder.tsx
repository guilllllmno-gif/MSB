import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { Hammer } from "lucide-react";
import { Shell } from "@/components/Shell";

const LABELS: Record<string, string> = {
  "/dashboard": "风控仪表盘", "/monitoring": "事中监控", "/rules": "监控规则",
  "/strategy": "全局策略", "/lists": "名单管理", "/cases": "案件管理", "/reports": "报告报送", "/audit": "审计日志",
};

export default function Placeholder() {
  const loc = useLocation();
  const nav = useNavigate();
  const label = LABELS[loc.pathname] || "该模块";
  return (
    <Shell crumb={["风控", label]}>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Hammer className="h-6 w-6" /></span>
        <div><h2 className="text-[18px] font-bold">{label} · 建设中</h2><p className="mt-1.5 max-w-md text-[13px] text-default-500">本期先交付「交易警报」模块。该模块为占位,后续按设计图依次补齐。</p></div>
        <Button color="primary" onPress={() => nav("/alerts")}>前往交易警报</Button>
      </div>
    </Shell>
  );
}
