"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { signIn } from "next-auth/react";
import AccessibilityMenu from "./AccessibilityMenu";
import { translate_struct_text } from "./GoogleTranslateTool";

const CASHIER_PIN = "123456";
const MAX_PIN_LENGTH = 6;

interface Props {
  onCustomerEntry: () => void;
  onCashierLogin: () => void;
}

/*
  English source of truth for all static login screen text.

  This includes every hardcoded label that appears on the login screen.
  Since this screen does not load drink names or toppings from the database,
  it only needs static translation support.
*/
const loginScreenText_English = {
  login_text: "Cashier Login",
  title: "Panda Tea",
  subtitle: "Boba Tea Shop",
  customer_ordering: "Customer Ordering",
  manager_login: "Manager Login",
  cashier_login: "cashier login",
  cancel: "cancel",
  incorrect_pin: "incorrect pin",
};

export default function LoginScreen({ onCustomerEntry, onCashierLogin }: Props) {
  const [showCashierForm, setShowCashierForm] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [authError] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return new URLSearchParams(window.location.search).get("error");
  });
  const managerError =
    authError === "AccessDenied"
      ? "This Google account is not approved for manager access."
      : "";

  /*
    Tracks the currently displayed language.

    false = English
    true = Spanish

    This replaces the old global doTranslation variable.
    React state is better because updating it causes the component to re-render.
  */
  const [isSpanish, setIsSpanish] = useState(false);

  /*
    The actual text currently shown on the page.

    Starts in English.
    When the translation button is clicked, this state switches to the Spanish
    object. When clicked again, it switches back to English.
  */
  const [loginScreenText, setLoginScreenText] = useState(loginScreenText_English);

  /*
    Cache for the translated Spanish text.

    Why:
    We only want to call the Google Translate API the first time the user
    switches to Spanish. After that, we reuse the already translated object.
  */
  const [loginScreenText_Spanish, setLoginScreenText_Spanish] =
    useState<typeof loginScreenText_English | null>(null);

  /*
    Toggles the login screen between English and Spanish.

    English:
    - Already available from loginScreenText_English.

    Spanish:
    - Translated on first use.
    - Cached in loginScreenText_Spanish.
  */
  async function loadTranslation() {
    const shouldSwitchToSpanish = !isSpanish;

    if (shouldSwitchToSpanish) {
      let spanishText = loginScreenText_Spanish;

      if (!spanishText) {
        spanishText = await translate_struct_text(loginScreenText_English);
        setLoginScreenText_Spanish(spanishText);
      }

      setLoginScreenText(spanishText);
      setIsSpanish(true);
    } else {
      setLoginScreenText(loginScreenText_English);
      setIsSpanish(false);
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

  const submitPin = useCallback((value: string) => {
    if (value === CASHIER_PIN) {
      onCashierLogin();
    } else {
      setShake(true);

      /*
        Use translated error text.

        This keeps the PIN error in the same language as the rest of the UI.
      */
      setError(loginScreenText.incorrect_pin);

      setPin("");
      setTimeout(() => setShake(false), 500);
    }
  }, [onCashierLogin]);

  const handleCancel = () => {
    setShowCashierForm(false);
    setPin("");
    setError("");
  };

  /*
    pinRef keeps the latest PIN available inside the keyboard event listener.

    Why:
    The keydown listener is registered inside useEffect, and event listeners can
    otherwise accidentally capture old state values.
  */
  const pinRef = useRef(pin);

  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

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
  }, [showCashierForm, submitPin]);

  const padKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen bg-boba-bg flex items-center justify-center p-4 relative">
      <AccessibilityMenu
        isTranslationActive={isSpanish}
        onToggleTranslation={loadTranslation}
      />

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-5xl tracking-tight text-boba-primary mb-2">
            {loginScreenText.title}
          </h1>

          <p className="text-boba-secondary italic">
            {loginScreenText.subtitle}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onCustomerEntry}
            className="w-full bg-boba-accent hover:bg-boba-accent-hover text-[var(--boba-accent-foreground)] py-4 rounded-2xl text-base transition-colors"
          >
            {loginScreenText.customer_ordering}
          </button>

          {!showCashierForm ? (
            <button
              onClick={() => setShowCashierForm(true)}
              className="w-full border border-boba-border hover:border-boba-accent text-boba-secondary hover:text-boba-primary py-4 rounded-2xl text-base transition-colors"
            >
              {loginScreenText.login_text}
            </button>
          ) : (
            <div className="bg-boba-surface rounded-3xl p-6 border border-boba-border">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl text-boba-primary">
                  {loginScreenText.cashier_login}
                </h2>

                <button
                  onClick={handleCancel}
                  className="text-boba-muted hover:text-boba-primary text-sm transition-colors"
                >
                  {loginScreenText.cancel}
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
                <p className="text-red-400 text-sm text-center mb-4">
                  {error}
                </p>
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
            onClick={() => signIn("google", undefined, { prompt: "select_account" })}
            className="w-full border border-boba-border hover:border-boba-accent text-boba-secondary hover:text-boba-primary py-4 rounded-2xl text-base transition-colors"
          >
            {loginScreenText.manager_login}
          </button>
          {managerError ? (
            <p className="text-red-400 text-sm text-center">{managerError}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
