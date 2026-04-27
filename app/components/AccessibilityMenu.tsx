"use client";

import { useEffect, useState } from "react";
import {
  RiAccessibilityLine,
  RiArrowDownSLine,
  RiContrast2Line,
  RiTranslate2,
} from "react-icons/ri";

interface Props {
  isTranslationActive?: boolean;
  onToggleTranslation?: () => void | Promise<void>;
  translationActiveLabel?: string;
  translationInactiveLabel?: string;
}

export default function AccessibilityMenu({
  isTranslationActive = false,
  onToggleTranslation,
  translationActiveLabel = "Translate to English",
  translationInactiveLabel = "Translate to Spanish",
}: Props) {
  const [theme, setTheme] = useState<"light" | "contrast">("light");
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const initialTheme =
      savedTheme === "contrast" || savedTheme === "light"
        ? savedTheme
        : "light";

    document.documentElement.dataset.theme = initialTheme;
    setTheme(initialTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "contrast" ? "light" : "contrast";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  const handleTranslationToggle = async () => {
    if (!onToggleTranslation) return;
    await onToggleTranslation();
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
      {isOpen && (
        <div className="min-w-56 rounded-2xl border border-boba-border bg-boba-surface p-2 shadow-lg shadow-black/10">
          <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.2em] text-boba-muted">
            Accessibility
          </p>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-boba-primary transition-colors hover:bg-boba-subtle"
          >
            <span className="inline-flex items-center gap-2">
              <RiContrast2Line className="text-base" />
              {theme === "contrast" ? "Standard contrast" : "High contrast"}
            </span>
            <span className="text-xs text-boba-muted">
              {theme === "contrast" ? "On" : "Off"}
            </span>
          </button>

          {onToggleTranslation && (
            <button
              type="button"
              onClick={handleTranslationToggle}
              className="mt-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-boba-primary transition-colors hover:bg-boba-subtle"
            >
              <span className="inline-flex items-center gap-2">
                <RiTranslate2 className="text-base" />
                {isTranslationActive
                  ? translationActiveLabel
                  : translationInactiveLabel}
              </span>
              <span className="text-xs text-boba-muted">
                {isTranslationActive ? "On" : "Off"}
              </span>
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close accessibility menu" : "Open accessibility menu"}
        className="relative inline-flex h-14 w-14 items-center justify-center rounded-full border border-boba-border bg-boba-surface text-boba-primary shadow-lg shadow-black/10 transition-colors hover:border-boba-accent hover:bg-boba-subtle"
      >
        <RiAccessibilityLine className="text-2xl" />
        <RiArrowDownSLine
          className={`absolute -right-1 -top-1 rounded-full border border-boba-border bg-boba-surface text-base transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
