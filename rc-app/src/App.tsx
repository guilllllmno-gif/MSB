import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { HeroUIProvider, Spinner } from "@heroui/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

// route-level code splitting — each page is its own chunk
const AlertList = lazy(() => import("@/pages/AlertList"));
const AlertDetail = lazy(() => import("@/pages/AlertDetail"));
const RingList = lazy(() => import("@/pages/RingList"));
const RingDetail = lazy(() => import("@/pages/RingDetail"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Monitoring = lazy(() => import("@/pages/Monitoring"));
const PostMonitoring = lazy(() => import("@/pages/PostMonitoring"));
const PostDetail = lazy(() => import("@/pages/PostDetail"));
const Dispositions = lazy(() => import("@/pages/Dispositions"));
const ReportFiling = lazy(() => import("@/pages/ReportFiling"));
const RulesPage = lazy(() => import("@/pages/RulesPage"));
const RuleDetail = lazy(() => import("@/pages/RuleDetail"));
const CaseList = lazy(() => import("@/pages/CaseList"));
const CaseDetail = lazy(() => import("@/pages/CaseDetail"));
const Placeholder = lazy(() => import("@/pages/Placeholder"));

const STUBS = ["/strategy", "/lists", "/audit"];

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <HeroUIProvider>
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[var(--page)]"><Spinner color="primary" /></div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/post-monitoring" element={<PostMonitoring />} />
            <Route path="/finding" element={<PostDetail />} />
            <Route path="/dispositions" element={<Dispositions />} />
            <Route path="/reports" element={<ReportFiling />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/rule" element={<RuleDetail />} />
            <Route path="/cases" element={<CaseList />} />
            <Route path="/case" element={<CaseDetail />} />
            <Route path="/alerts" element={<AlertList />} />
            <Route path="/alert" element={<AlertDetail />} />
            <Route path="/rings" element={<RingList />} />
            <Route path="/ring" element={<RingDetail />} />
            {STUBS.map((p) => <Route key={p} path={p} element={<Placeholder />} />)}
            <Route path="*" element={<Navigate to="/alerts" replace />} />
          </Routes>
        </Suspense>
        <Toaster position="bottom-center" richColors />
      </HeroUIProvider>
      </ThemeProvider>
    </HashRouter>
  );
}