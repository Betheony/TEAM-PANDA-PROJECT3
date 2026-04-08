"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import LoginScreen from "./components/LoginScreen";
import CustomerView from "./components/CustomerView";
import CashierView from "./components/CashierView";
import ManagerView from "./components/ManagerView";

type View = "login" | "customer" | "cashier" | "manager";

interface Employee {
  employee_id: number;
  name: string;
  role: "cashier" | "manager";
}

export default function Home() {
  const { data: session } = useSession();
  const [view, setView] = useState<View>("login");
  const [employee, setEmployee] = useState<Employee | null>(null);

  const handleLogout = () => {
    setEmployee(null);
    setView("login");
  };

  // Google-authenticated customers go straight to CustomerView
  if (session) return <CustomerView onLogout={handleLogout} />;

  if (view === "login") {
    return (
      <LoginScreen
        onEmployeeLogin={(emp) => {
          setEmployee(emp);
          setView(emp.role as View);
        }}
      />
    );
  }

  if (view === "cashier") return <CashierView employee={employee!} onLogout={handleLogout} />;
  if (view === "manager") return <ManagerView employee={employee!} onLogout={handleLogout} />;

  return null;
}
