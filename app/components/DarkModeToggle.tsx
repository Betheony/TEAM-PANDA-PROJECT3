
"use client";
import React, { useEffect, useState } from "react";
import { RiMoonLine, RiSunLine } from "react-icons/ri";

const DarkModeToggle = () => {
  const [theme, setTheme] = useState<"light" | "contrast">("light");
  const [mounted, setMounted] = useState(false);

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

  if (!mounted) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={theme === "contrast"}
      aria-label={`Switch to ${theme === "contrast" ? "standard" : "high contrast"} mode`}
      className="inline-flex items-center gap-2 rounded-full border border-boba-border bg-boba-surface px-3 py-2 text-sm text-boba-primary transition-colors hover:border-boba-accent hover:bg-boba-subtle"
    >
      {theme === "light" ? (
        <>
          <RiMoonLine />
          <span>high contrast</span>
        </>
      ) : (
        <>
          <RiSunLine />
          <span>standard</span>
        </>
      )}
    </button>
  );
};

export default DarkModeToggle;
