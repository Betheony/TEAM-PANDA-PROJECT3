"use client";
import { useSession, signOut } from "next-auth/react";
import OrderingPanel from "./OrderingPanel";

interface Props {
  onLogout: () => void;
}

export default function CustomerView({ onLogout }: Props) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-[#faf7f5] flex flex-col">
      {/* Header */}
      <header className="bg-[#fffdfb] border-b border-[#e8e0db] px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl tracking-tight text-[#6b5d5a]">panda tea</h1>
          <p className="text-sm text-[#9a8d89] italic">welcome back, {session?.user?.name?.split(" ")[0] ?? "guest"}</p>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 p-6 min-h-0 overflow-hidden" style={{ height: "calc(100vh - 73px)" }}>
        <OrderingPanel />
      </main>
    </div>
  );
}
