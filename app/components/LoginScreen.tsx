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
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-7xl mb-4">🧋</div>
          <h1 className="text-4xl font-bold text-amber-900">Panda Tea</h1>
          <p className="text-amber-700 mt-2 text-lg">How would you like to proceed?</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => signIn("google")}
            className="w-full bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white font-bold py-5 px-6 rounded-2xl text-xl transition-colors shadow-lg"
          >
            Order as Customer
          </button>

          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-5 px-6 rounded-2xl text-xl transition-colors shadow-lg"
            >
              Employee Login
            </button>
          ) : (
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100">
              <h2 className="text-xl font-bold text-gray-800 mb-5">Employee Login</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Bethany"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    PIN
                  </label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter your PIN"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800"
                    inputMode="numeric"
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-sm font-medium">{error}</p>
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
                    className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
                  >
                    {loading ? "Logging in…" : "Login"}
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
