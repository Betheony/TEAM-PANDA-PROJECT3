"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoginScreen from "./components/LoginScreen";
import ManagerView from "./components/ManagerView";

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();

  // Google-authenticated users go to ManagerView
  if (session) {
    return (
      <ManagerView
        employee={{ employee_id: 0, name: session.user?.name ?? "Manager", role: "manager" }}
        onLogout={() => { signOut({ callbackUrl: "/" }); }}
      />
    );
  }

  return (
    <LoginScreen
      onCustomerEntry={() => router.push("/customer")}
      onCashierLogin={() => router.push("/cashier")}
    />
  );
}
