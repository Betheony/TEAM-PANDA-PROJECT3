"use client";
import { useState } from "react";
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
  const [view, setView] = useState<View>("login");
  const [employee, setEmployee] = useState<Employee | null>(null);

  const handleLogout = () => {
    setEmployee(null);
    setView("login");
  };

  if (view === "login") {
    return (
      <LoginScreen
        onCustomerSelect={() => setView("customer")}
        onEmployeeLogin={(emp) => {
          setEmployee(emp);
          setView(emp.role as View);
        }}
      />
    );
  }

  if (view === "customer") return <CustomerView onLogout={handleLogout} />;
  if (view === "cashier") return <CashierView employee={employee!} onLogout={handleLogout} />;
  if (view === "manager") return <ManagerView employee={employee!} onLogout={handleLogout} />;

  return null;
}
