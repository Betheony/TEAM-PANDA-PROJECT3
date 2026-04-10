"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

const CASHIER_PIN = "123456";

interface Props {
  onCustomerEntry: () => void;
  onCashierLogin: () => void;
}

export default function LoginScreen({ onCustomerEntry, onCashierLogin }: Props) {
  const [showCashierForm, setShowCashierForm] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleCashierLogin = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pin === CASHIER_PIN) {
      onCashierLogin();
    } else {
      setError("incorrect pin");
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
          {/* Customer */}
          <button
            onClick={onCustomerEntry}
            className="w-full bg-boba-accent hover:bg-boba-accent-hover text-white py-4 rounded-2xl text-base transition-colors"
          >
            customer ordering
          </button>

          {/* Cashier */}
          {!showCashierForm ? (
            <button
              onClick={() => setShowCashierForm(true)}
              className="w-full border border-boba-border hover:border-boba-accent text-boba-secondary hover:text-boba-primary py-4 rounded-2xl text-base transition-colors"
            >
              cashier login
            </button>
          ) : (
            <div className="bg-boba-surface rounded-3xl p-6 border border-boba-border">
              <h2 className="text-xl text-boba-primary mb-5">cashier login</h2>
              <form onSubmit={handleCashierLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-boba-secondary lowercase mb-1">
                    pin
                  </label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => { setPin(e.target.value); setError(""); }}
                    placeholder="enter pin"
                    className="w-full border border-boba-border rounded-2xl px-4 py-3 focus:outline-none focus:border-boba-accent text-boba-primary bg-transparent placeholder:text-boba-muted"
                    inputMode="numeric"
                    autoFocus
                    required
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowCashierForm(false); setPin(""); setError(""); }}
                    className="flex-1 border border-boba-border hover:border-boba-accent text-boba-muted py-3 rounded-full transition-colors"
                  >
                    cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-boba-accent hover:bg-boba-accent-hover text-white py-3 rounded-full transition-colors"
                  >
                    login
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Manager */}
          <button
            onClick={() => signIn("google")}
            className="w-full border border-boba-border hover:border-boba-accent text-boba-secondary hover:text-boba-primary py-4 rounded-2xl text-base transition-colors"
          >
            manager login
          </button>
        </div>
      </div>
    </div>
  );
}
