"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Plus, X } from "lucide-react";

interface PriceAlert {
  id: string;
  symbol: string;
  direction: "above" | "below";
  target: number;
  createdAt: string;
  triggeredAt?: string;
}

const STORAGE_KEY = "babata.alerts.v1";

function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PriceAlert[]) : [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts.slice(-40)));
  } catch {
    // Storage full/blocked: alerts just live for this session.
  }
}

/**
 * PriceAlerts — client-side threshold alerts for the selected coin.
 * Alerts are stored in this browser only, evaluated on each live price
 * refresh while the tab is open. No server, no keys, no notifications after
 * the tab closes — that limit is stated in the UI on purpose.
 */
export const PriceAlerts: React.FC<{ symbol: string; price?: number }> = ({ symbol, price }) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [target, setTarget] = useState("");
  const [lastTriggered, setLastTriggered] = useState<PriceAlert | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const notified = useRef(false);

  useEffect(() => {
    setAlerts(loadAlerts());
  }, []);

  // Evaluate armed alerts whenever a fresh price arrives.
  useEffect(() => {
    if (price === undefined || !Number.isFinite(price)) return;
    const current = loadAlerts();
    let changed = false;
    const fired: PriceAlert[] = [];
    const next = current.map((a) => {
      if (a.triggeredAt || a.symbol !== symbol) return a;
      const hit = a.direction === "above" ? price >= a.target : price <= a.target;
      if (!hit) return a;
      changed = true;
      const triggered = { ...a, triggeredAt: new Date().toISOString() };
      fired.push(triggered);
      return triggered;
    });
    if (changed) {
      saveAlerts(next);
      setAlerts(next);
      setLastTriggered(fired[0] ?? null);
      if (!notified.current && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("Babata Lens — price alert", {
            body: `${symbol} is ${fired[0]?.direction} $${fired[0]?.target} — now $${price.toLocaleString()}`,
          });
        } catch {
          // Notification API can throw in embedded contexts; in-app banner covers it.
        }
      }
      notified.current = true;
      window.setTimeout(() => {
        notified.current = false;
      }, 5000);
    }
  }, [price, symbol]);

  const current = alerts.filter((a) => a.symbol === symbol);
  const armed = current.filter((a) => !a.triggeredAt).length;

  const add = () => {
    const t = Number(target);
    if (!Number.isFinite(t) || t <= 0) {
      setFormError("Enter a valid target price.");
      return;
    }
    if (price !== undefined && direction === "above" && t <= price) {
      setFormError(`Target must be above the current price ($${price.toLocaleString()}).`);
      return;
    }
    if (price !== undefined && direction === "below" && t >= price) {
      setFormError(`Target must be below the current price ($${price.toLocaleString()}).`);
      return;
    }
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
    const next: PriceAlert[] = [
      ...loadAlerts(),
      {
        id: `al_${Date.now()}`,
        symbol,
        direction,
        target: t,
        createdAt: new Date().toISOString(),
      },
    ];
    saveAlerts(next);
    setAlerts(next);
    setTarget("");
    setFormError(null);
  };

  const remove = (id: string) => {
    const next = loadAlerts().filter((a) => a.id !== id);
    saveAlerts(next);
    setAlerts(next);
  };

  return (
    <div className="mt-3 pt-3 border-t border-surface-border/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400 hover:text-cyan-neon transition-colors"
      >
        {armed > 0 ? (
          <BellRing className="w-3.5 h-3.5 text-amber-glow" />
        ) : (
          <Bell className="w-3.5 h-3.5" />
        )}
        PRICE ALERTS
        {armed > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-amber-glow/15 border border-amber-glow/40 text-amber-glow">
            {armed} armed
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {lastTriggered && (
            <div className="p-2 rounded-lg bg-emerald-cyber/10 border border-emerald-cyber/40 text-[11px] font-mono text-emerald-cyber flex items-center justify-between gap-2">
              <span>
                TRIGGERED: {lastTriggered.symbol} {lastTriggered.direction} ${lastTriggered.target}
                {price !== undefined ? ` — now $${price.toLocaleString()}` : ""}
              </span>
              <button type="button" onClick={() => setLastTriggered(null)} aria-label="Dismiss alert trigger">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {current.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {current.map((a) => (
                <span
                  key={a.id}
                  className={`flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg border text-[11px] font-mono ${
                    a.triggeredAt
                      ? "bg-surface-1 border-surface-border text-gray-500 line-through"
                      : "bg-amber-glow/10 border-amber-glow/40 text-amber-glow"
                  }`}
                >
                  {a.direction === "above" ? "≥" : "≤"} ${a.target.toLocaleString()}
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    aria-label={`Remove alert at ${a.target}`}
                    className="p-0.5 rounded text-gray-500 hover:text-rose-flare"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "above" | "below")}
              className="px-2 py-1.5 rounded-lg bg-surface-1 border border-surface-border text-[11px] font-mono text-gray-200 outline-none focus:border-cyan-neon"
            >
              <option value="above">crosses above</option>
              <option value="below">drops below</option>
            </select>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="target price ($)"
              inputMode="decimal"
              className="w-36 px-2 py-1.5 rounded-lg bg-surface-1 border border-surface-border text-[11px] font-mono text-gray-200 outline-none focus:border-cyan-neon"
            />
            <button
              type="button"
              onClick={add}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-neon/15 border border-cyan-neon/40 text-cyan-neon text-[11px] font-mono font-bold hover:bg-cyan-neon/25 transition-all flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> ARM
            </button>
          </div>

          {formError && <p className="text-[11px] font-mono text-rose-flare">{formError}</p>}

          <p className="text-[10px] font-mono text-gray-500 leading-relaxed">
            Alerts live in this browser and fire only while this tab is open (browser
            notifications where permitted, in-app banner otherwise).
          </p>
        </div>
      )}
    </div>
  );
};
