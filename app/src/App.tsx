import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import MerchantList from "@/pages/MerchantList";
import Merchant360 from "@/pages/Merchant360";
import OrderList from "@/pages/OrderList";
import OrderReview from "@/pages/OrderReview";
import CaseEvidence from "@/pages/CaseEvidence";
import Unfreeze from "@/pages/Unfreeze";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/merchants" replace />} />
        <Route path="/merchants" element={<MerchantList />} />
        <Route path="/merchant" element={<Merchant360 />} />
        <Route path="/orders" element={<OrderList />} />
        <Route path="/order" element={<OrderReview />} />
        <Route path="/evidence" element={<CaseEvidence />} />
        <Route path="/unfreeze" element={<Unfreeze />} />
        <Route path="*" element={<Navigate to="/merchants" replace />} />
      </Routes>
      <Toaster position="bottom-center" richColors />
    </HashRouter>
  );
}
