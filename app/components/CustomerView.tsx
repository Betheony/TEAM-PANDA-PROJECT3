"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import OrderingPanel from "./OrderingPanel";

interface WeatherSummary {
  location: string;
  temp: number;
  high: number;
  low: number;
  label: string;
}

interface BrowserPosition {
  latitude: number;
  longitude: number;
  timezone: string;
  location: string;
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
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fallbackLocation = {
      latitude: 30.2672,
      longitude: -97.7431,
      timezone: "America/Chicago",
      name: "Austin",
    };

    const loadWeather = async (
      latitude: number,
      longitude: number,
      timezone: string,
      location: string
    ) => {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: "temperature_2m,weather_code",
        daily: "temperature_2m_max,temperature_2m_min",
        temperature_unit: "fahrenheit",
        timezone,
        forecast_days: "1",
      }).toString();

      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error("Weather unavailable");
      const data = await res.json();
      const code = Number(data.current?.weather_code);

      if (!controller.signal.aborted) {
        setWeather({
          location,
          temp: Math.round(Number(data.current?.temperature_2m)),
          high: Math.round(Number(data.daily?.temperature_2m_max?.[0])),
          low: Math.round(Number(data.daily?.temperature_2m_min?.[0])),
          label: weatherLabels[code] ?? "Forecast",
        });
      }
    };

    const getBrowserPosition = () =>
      new Promise<BrowserPosition>((resolve, reject) => {
        if (!navigator.geolocation || !window.isSecureContext) {
          reject(new Error("Browser location unavailable"));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "auto",
              location: "Local",
            });
          },
          reject,
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000,
          }
        );
      });

    const getIpPosition = async (): Promise<BrowserPosition> => {
      const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
      if (!res.ok) throw new Error("IP location unavailable");
      const data = await res.json();
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("IP location missing coordinates");
      }

      return {
        latitude,
        longitude,
        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "auto",
        location: data.city || "Local",
      };
    };

    const loadCustomerWeather = async () => {
      try {
        const position = await getBrowserPosition().catch(getIpPosition);
        await loadWeather(
          position.latitude,
          position.longitude,
          position.timezone,
          position.location
        );
      } catch {
        try {
          await loadWeather(
            fallbackLocation.latitude,
            fallbackLocation.longitude,
            fallbackLocation.timezone,
            fallbackLocation.name
          );
        } catch {
          if (!controller.signal.aborted) setWeather(null);
        }
      } finally {
        if (!controller.signal.aborted) setWeatherLoading(false);
      }
    };

    loadCustomerWeather();

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
          {weatherLoading && (
            <div className="hidden sm:flex items-center justify-center rounded-lg border border-boba-border bg-boba-subtle px-3 py-2">
              <div className="h-4 w-4 rounded-full border-2 border-boba-border border-t-boba-accent animate-spin" />
            </div>
          )}
          {weather && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-boba-border bg-boba-subtle px-3 py-2 text-sm text-boba-primary">
              <span className="font-medium">{weather.location}</span>
              <span>{weather.temp}°F</span>
              <span className="text-boba-secondary">{weather.label}</span>
              <span className="text-boba-muted">
                H {weather.high}° / L {weather.low}°
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 p-6 min-h-0 overflow-hidden" style={{ height: "calc(100vh - 73px)" }}>
        <div className="flex h-full min-h-0 flex-col gap-4">
          <iframe
            data-testid="embed-iframe"
            title="Spotify player"
            className="w-full shrink-0 rounded-lg"
            src="https://open.spotify.com/embed/playlist/3c4K2LUr8Yi1ATUZXb6xzR?utm_source=generator"
            height="152"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
          <div className="min-h-0 flex-1">
            <OrderingPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
