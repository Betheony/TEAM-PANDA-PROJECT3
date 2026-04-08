"use client";
import { useSession, signOut } from "next-auth/react";
import OrderingPanel from "./OrderingPanel";

interface Props {
  onLogout: () => void;
}

export default function CustomerView({ onLogout }: Props) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-orange-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧋</span>
          <div>
            <h1 className="text-xl font-bold text-amber-900">Panda Tea</h1>
            <p className="text-xs text-gray-500">Welcome, {session?.user?.name?.split(" ")[0] ?? "Guest"}</p>
          </div>
        </div>
        <button
          onClick={() => { signOut({ callbackUrl: "/" }); onLogout(); }}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 p-6 min-h-0 overflow-hidden" style={{ height: "calc(100vh - 73px)" }}>
        <OrderingPanel />
      </main>
    </div>
  );
}
