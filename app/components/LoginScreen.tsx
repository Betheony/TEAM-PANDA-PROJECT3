"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

interface Employee {
  employee_id: number;
  name: string;
  role: "cashier" | "manager";
}

interface Props {
  onEmployeeLogin: (employee: Employee) => void;
}

export default function LoginScreen({ onEmployeeLogin }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
      } else {
        onEmployeeLogin(data);
      }
    } catch {
      setError("Connection error. Check your database connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-boba-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-5xl tracking-tight text-boba-primary mb-2">panda tea</h1>
          <p className="text-boba-secondary italic">boba tea shop</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signIn("google")}
            className="w-full bg-boba-accent hover:bg-boba-accent-hover text-white py-4 rounded-2xl text-base transition-colors"
          >
            order as customer
          </button>

          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full border border-boba-border hover:border-boba-accent text-boba-secondary hover:text-boba-primary py-4 rounded-2xl text-base transition-colors"
            >
              employee login
            </button>
          ) : (
            <div className="bg-boba-surface rounded-3xl p-6 border border-boba-border">
              <h2 className="text-xl text-boba-primary mb-5">employee login</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-boba-secondary lowercase mb-1">
                    name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="first name"
                    className="w-full border border-boba-border rounded-2xl px-4 py-3 focus:outline-none focus:border-boba-accent text-boba-primary bg-transparent placeholder:text-boba-muted"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-boba-secondary lowercase mb-1">
                    pin
                  </label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="password"
                    className="w-full border border-boba-border rounded-2xl px-4 py-3 focus:outline-none focus:border-boba-accent text-boba-primary bg-transparent placeholder:text-boba-muted"
                    inputMode="numeric"
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setError("");
                      setName("");
                      setPin("");
                    }}
                    className="flex-1 border border-boba-border hover:border-boba-accent text-boba-muted py-3 rounded-full transition-colors"
                  >
                    cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-boba-accent hover:bg-boba-accent-hover text-white py-3 rounded-full transition-colors disabled:opacity-40"
                  >
                    {loading ? "logging in…" : "login"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
