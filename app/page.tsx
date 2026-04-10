"use client";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import LoginScreen from "./components/LoginScreen";
import CustomerView from "./components/CustomerView";
import CashierView from "./components/CashierView";
import ManagerView from "./components/ManagerView";

type View = "login" | "customer" | "cashier";

export default function Home() {
  const { data: session } = useSession();
  const [view, setView] = useState<View>("login");

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

  if (view === "customer") return <CustomerView onLogout={handleLogout} />;
  if (view === "cashier") return (
    <CashierView
      employee={{ employee_id: 0, name: "Cashier", role: "cashier" }}
      onLogout={handleLogout}
    />
  );

  return (
    <LoginScreen
      onCustomerEntry={() => setView("customer")}
      onCashierLogin={() => setView("cashier")}
    />
  );
}
