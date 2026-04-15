"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import OrderingPanel from "./OrderingPanel";
import DarkModeToggle from "./DarkModeToggle";

interface WeatherSummary {
  temp: number;
  high: number;
  low: number;
  label: string;
}

const weatherLabels: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Fog",
  51: "Drizzle",
  53: "Drizzle",
  55: "Drizzle",
  61: "Rain",
  63: "Rain",
  65: "Rain",
  71: "Snow",
  73: "Snow",
  75: "Snow",
  80: "Showers",
  81: "Showers",
  82: "Showers",
  95: "Storms",
  96: "Storms",
  99: "Storms",
};

export default function CustomerView() {
  const { data: session } = useSession();
  const [weather, setWeather] = useState<WeatherSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: "30.2672",
      longitude: "-97.7431",
      current: "temperature_2m,weather_code",
      daily: "temperature_2m_max,temperature_2m_min",
      temperature_unit: "fahrenheit",
      timezone: "America/Chicago",
      forecast_days: "1",
    }).toString();

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Weather unavailable");
        return res.json();
      })
      .then((data) => {
        const code = Number(data.current?.weather_code);
        setWeather({
          temp: Math.round(Number(data.current?.temperature_2m)),
          high: Math.round(Number(data.daily?.temperature_2m_max?.[0])),
          low: Math.round(Number(data.daily?.temperature_2m_min?.[0])),
          label: weatherLabels[code] ?? "Forecast",
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setWeather(null);
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen bg-boba-bg flex flex-col">
      {/* Header */}
      <header className="bg-boba-surface border-b border-boba-border px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl tracking-tight text-boba-primary">panda tea</h1>
          <p className="text-sm text-boba-secondary italic">welcome back, {session?.user?.name?.split(" ")[0] ?? "guest"}</p>
        </div>
        <div className="flex items-center gap-3">
          {weather && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-boba-border bg-boba-subtle px-3 py-2 text-sm text-boba-primary">
              <span className="font-medium">Austin</span>
              <span>{weather.temp}°F</span>
              <span className="text-boba-secondary">{weather.label}</span>
              <span className="text-boba-muted">
                H {weather.high}° / L {weather.low}°
              </span>
            </div>
          )}
          <DarkModeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 p-6 min-h-0 overflow-hidden" style={{ height: "calc(100vh - 73px)" }}>
        <OrderingPanel />
      </main>
    </div>
  );
}
