"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoginScreen from "./components/LoginScreen";
import ManagerView from "./components/ManagerView";

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleManagerLogout = async () => {
    const result = await signOut({ redirect: false, callbackUrl: "/" });
    router.replace(result.url || "/");
    router.refresh();
  };

  // Google-authenticated users go to ManagerView
  if (session) {
    return (
      <ManagerView
        employee={{ employee_id: 0, name: session.user?.name ?? "Manager", role: "manager" }}
        onLogout={handleManagerLogout}
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
