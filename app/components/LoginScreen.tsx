"use client";
import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import DarkModeToggle from "./DarkModeToggle";

// Import the translator 
import {

  translate_text
}
from "./GoogleTranslateTool";
import { truncate } from "fs";

translate_text("Hello, this is a test!");

const CASHIER_PIN = "123456";
const MAX_PIN_LENGTH = 6;

interface Props {
  onCustomerEntry: () => void;
  onCashierLogin: () => void;
}

let do_translation = true;

// This function will be used for every single text.
// If "do_translate" is true, the text will be set to the translated text (Spanish)
// Otherwise, return the original text.
function translation_wrapper(text, do_translate) {

  if(do_translate == true) {

    return translate_text(text);
  }

  else return text;
}

export default function LoginScreen({ onCustomerEntry, onCashierLogin }: Props) {

  const [showCashierForm, setShowCashierForm] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length >= MAX_PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    setError("");
    if (next.length === MAX_PIN_LENGTH) {
      setTimeout(() => submitPin(next), 80);
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError("");
  };

  const submitPin = (value: string) => {
    if (value === CASHIER_PIN) {
      onCashierLogin();
    } else {
      setShake(true);
      setError("incorrect pin");
      setPin("");
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleCancel = () => {
    setShowCashierForm(false);
    setPin("");
    setError("");
  };

  const pinRef = useRef(pin);
  pinRef.current = pin;

  useEffect(() => {

    if (!showCashierForm) return;

    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        const current = pinRef.current;
        if (current.length >= MAX_PIN_LENGTH) return;
        const next = current + e.key;
        setPin(next);
        setError("");
        if (next.length === MAX_PIN_LENGTH) {
          setTimeout(() => submitPin(next), 80);
        }
      } else if (e.key === "Backspace") {
        setPin((p) => p.slice(0, -1));
        setError("");
      } else if (e.key === "Enter") {
        submitPin(pinRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCashierForm]);

  const padKeys = ["1","2","3","4","5","6","7","8","9"];

  return (

    <div className="min-h-screen bg-boba-bg flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <DarkModeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-5xl tracking-tight text-boba-primary mb-2">panda tea</h1>
          <p className="text-boba-secondary italic">boba tea shop</p>
        </div>

        <div className="space-y-3">
          {/* Customer */}
          <button
            onClick={onCustomerEntry}
            className="w-full bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] py-4 rounded-2xl text-base transition-colors"
          >
            customer ordering
          </button>

          {/* Cashier */}
          {!showCashierForm ? (
            <button
              onClick={() => setShowCashierForm(true)}
              className="w-full border border-boba-border hover:border-boba-accent text-boba-secondary hover:text-boba-primary py-4 rounded-2xl text-base transition-colors"
            >
              Cashier Login
            </button>
          ) : (
            <div className="bg-boba-surface rounded-3xl p-6 border border-boba-border">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl text-boba-primary">cashier login</h2>
                <button
                  onClick={handleCancel}
                  className="text-boba-muted hover:text-boba-primary text-sm transition-colors"
                >
                  cancel
                </button>
              </div>

              {/* PIN dots display */}
              <div
                className="flex justify-center gap-3 mb-2"
                style={shake ? { animation: "wiggle 0.4s ease-in-out" } : {}}
              >
                {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-100 ${
                      i < pin.length
                        ? "bg-boba-accent border-boba-accent scale-110"
                        : "bg-transparent border-boba-border"
                    }`}
                  />
                ))}
              </div>
              {error ? (
                <p className="text-red-400 text-sm text-center mb-4">{error}</p>
              ) : (
                <div className="mb-4 h-5" />
              )}

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-2">
                {padKeys.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleDigit(key)}
                    className="bg-boba-bg hover:bg-boba-accent hover:text-[var(--boba-accent-foreground)] text-boba-primary text-xl font-medium py-4 rounded-2xl border border-boba-border transition-colors active:scale-95"
                  >
                    {key}
                  </button>
                ))}
                {/* Bottom row: backspace, 0, enter */}
                <button
                  onClick={handleBackspace}
                  className="bg-boba-bg hover:bg-boba-border text-boba-secondary text-xl py-4 rounded-2xl border border-boba-border transition-colors active:scale-95"
                >
                  &#9003;
                </button>
                <button
                  onClick={() => handleDigit("0")}
                  className="bg-boba-bg hover:bg-boba-accent hover:text-[var(--boba-accent-foreground)] text-boba-primary text-xl font-medium py-4 rounded-2xl border border-boba-border transition-colors active:scale-95"
                >
                  0
                </button>
                <button
                  onClick={() => submitPin(pin)}
                  disabled={pin.length === 0}
                  className="bg-boba-accent hover:bg-boba-accent-hover disabled:opacity-30 text-[var(--boba-accent-foreground)] text-xl py-4 rounded-2xl transition-colors active:scale-95"
                >
                  &#10003;
                </button>
              </div>
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
