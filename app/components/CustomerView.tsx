"use client";
import { useSession, signOut } from "next-auth/react";
import OrderingPanel from "./OrderingPanel";
import DarkModeToggle from "./DarkModeToggle";

interface Props {
  onLogout?: () => void;
}

export default function CustomerView({ onLogout }: Props) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-boba-bg flex flex-col">
      {/* Header */}
      <header className="bg-boba-surface border-b border-boba-border px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl tracking-tight text-boba-primary">panda tea</h1>
          <p className="text-sm text-boba-secondary italic">welcome back, {session?.user?.name?.split(" ")[0] ?? "guest"}</p>
        </div>
        <div className="flex items-center gap-3">
          <DarkModeToggle />
          <button
            onClick={() => { signOut({ callbackUrl: "/" }); onLogout(); }}
            className="text-sm text-boba-muted hover:text-boba-primary border border-boba-border hover:border-boba-accent px-4 py-1.5 rounded-full transition-colors"
          >
            sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 p-6 min-h-0 overflow-hidden" style={{ height: "calc(100vh - 73px)" }}>
        <OrderingPanel />
      </main>
    </div>
  );
}
