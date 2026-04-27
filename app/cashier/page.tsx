"use client";

import { useRouter } from "next/navigation";
import CashierView from "../components/CashierView";

export default function CashierPage() {
  const router = useRouter();

  return (
    <CashierView
      employee={{ employee_id: 0, name: "Cashier", role: "cashier" }}
      onLogout={() => router.push("/")}
    />
  );
}
