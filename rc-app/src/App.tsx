import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { HeroUIProvider } from "@heroui/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import AlertList from "@/pages/AlertList";
import AlertDetail from "@/pages/AlertDetail";
import Placeholder from "@/pages/Placeholder";

const STUBS = ["/dashboard", "/monitoring", "/rules", "/strategy", "/lists", "/cases", "/reports", "/audit"];

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <HeroUIProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/alerts" replace />} />
          <Route path="/alerts" element={<AlertList />} />
          <Route path="/alert" element={<AlertDetail />} />
          {STUBS.map((p) => <Route key={p} path={p} element={<Placeholder />} />)}
          <Route path="*" element={<Navigate to="/alerts" replace />} />
        </Routes>
        <Toaster position="bottom-center" richColors />
      </HeroUIProvider>
      </ThemeProvider>
    </HashRouter>
  );
}