"use client";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoginScreen from "./components/LoginScreen";
import CashierView from "./components/CashierView";
import ManagerView from "./components/ManagerView";

type View = "login" | "cashier";

export default function Home() {
  const { data: session } = useSession();
  const [view, setView] = useState<View>("login");
  const router = useRouter();

  const handleLogout = () => setView("login");

  // Google-authenticated users go to ManagerView
  if (session) {
    return (
      <ManagerView
        employee={{ employee_id: 0, name: session.user?.name ?? "Manager", role: "manager" }}
        onLogout={() => { signOut({ callbackUrl: "/" }); }}
      />
    );
  }

  if (view === "cashier") return (
    <CashierView
      employee={{ employee_id: 0, name: "Cashier", role: "cashier" }}
      onLogout={handleLogout}
    />
  );

  return (
    <LoginScreen
      onCustomerEntry={() => router.push("/customer")}
      onCashierLogin={() => setView("cashier")}
    />
  );
}
