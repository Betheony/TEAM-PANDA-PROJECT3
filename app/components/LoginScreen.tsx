"use client";
import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import DarkModeToggle from "./DarkModeToggle";
import { translate_text, loadTranslation } from "./GoogleTranslateTool";

const CASHIER_PIN = "123456";
const MAX_PIN_LENGTH = 6;

interface Props {

  onCustomerEntry: () => void;
  onCashierLogin: () => void;
}

// This decides if the page will be translated or not.
// Global variable, and can be updated as needed.
let doTranslation = false;


// This will contain the English translations for all the website text.
// Fill it with any text that needs to be displayed.
const loginScreenText_English = {

  login_text: "Cashier Login",
  title: "Panda Tea",
  subtitle: "Boba Tea Shop",
  customer_ordering: "Customer Ordering",
  manager_login: "Manager Login"
}

// This will contain the Spanish translations for all the website text.
// Populated through a loop (see below)
const loginScreenText_Spanish = {

}
// Iterate through the various website texts and then use them to populate the Spanish struct.
loadTranslation(loginScreenText_English, loginScreenText_Spanish);

export default function LoginScreen({ onCustomerEntry, onCashierLogin }: Props) {


  const [showCashierForm, setShowCashierForm] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  // Variables that contain the text to be displayed on the screen.
  // This is implemented this way to support the Google Translate API.
  const [loginScreenText, setloginScreenText] = useState(loginScreenText_English);

  // Translation function that maps the website
  async function loadTranslation() {

    // Negate the variable that decides what language to translate to.
    // This is done to allow for easy language switching.
    doTranslation = ! doTranslation

    // Iterate through the various website texts and then translate them with the API call function.
    for (const key in loginScreenText_English) {

      // Depending if the translation is to be done, set the website text to be English or Spanish.
      if (doTranslation) {

        setloginScreenText((prev) => ({
          ...prev,
          [key]: loginScreenText_Spanish[key],
        }));
      }
      else {

        setloginScreenText((prev) => ({
          ...prev,
          [key]: loginScreenText_English[key],
        }));
      }

    }
  }




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

  const padKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen bg-boba-bg flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <DarkModeToggle />

          {/* Button to do a translation. */}
          <button
          type="button"
          onClick={loadTranslation}
          className="inline-flex items-center gap-2 
              rounded-full border border-boba-border bg-boba-surface 
              px-3 py-2 text-sm text-boba-primary transition-colors 
              hover:border-boba-accent hover:bg-boba-subtle"
          >
              {/* Use the value from the React State. */}
          {doTranslation ? "Translate to English" : "Translate to Spanish"}
      </button>
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-5xl tracking-tight text-boba-primary mb-2">{loginScreenText["title"]}</h1>
          <p className="text-boba-secondary italic">{loginScreenText["subtitle"]}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onCustomerEntry}
            className="w-full bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] py-4 rounded-2xl text-base transition-colors"
          >
            {loginScreenText["customer_ordering"]}
          </button>

          {!showCashierForm ? (
            <button
              onClick={() => setShowCashierForm(true)}
              className="w-full border border-boba-border hover:border-boba-accent text-boba-secondary hover:text-boba-primary py-4 rounded-2xl text-base transition-colors"
            >
              {loginScreenText["login_text"]}
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

          <button
            onClick={() => signIn("google")}
            className="w-full border border-boba-border hover:border-boba-accent text-boba-secondary hover:text-boba-primary py-4 rounded-2xl text-base transition-colors"
          >
            {loginScreenText["manager_login"]}
          </button>
        </div>
      </div>
    </div>
  );
}