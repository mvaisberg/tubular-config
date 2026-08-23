"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { resolveInternalTraffic } from "@/lib/internal-traffic";

const OPEN_KEY = "tubular_configurador_open_tracked";
export const SESSION_KEY = "tubular_session_key";

// Registra UNA apertura del configurador por sesión de navegador, con UTMs y
// tipo de landing, y mantiene actualizada la duración de la visita.
// No cuenta equipo: cookie tubular_no_stats, sesión admin, o ?admin=1 / ?interno=1.
export function ConfiguratorTracker() {
    const searchParams = useSearchParams();

    useEffect(() => {
        if (typeof window === "undefined") return;
        const admin = searchParams.get("admin");
        if (admin === "true" || admin === "1") return;

        // Session key estable por sesión de navegador (la usan también los eventos).
        let key = sessionStorage.getItem(SESSION_KEY);
        if (!key) {
            key = crypto.randomUUID();
            sessionStorage.setItem(SESSION_KEY, key);
        }

        let cancelled = false;
        void resolveInternalTraffic().then((internal) => {
            if (cancelled || internal) return;

            if (!sessionStorage.getItem(OPEN_KEY)) {
                sessionStorage.setItem(OPEN_KEY, "1");

                const device = window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop";
                // Con qué llegó: link compartido, cotización, preset o entrada limpia.
                const landing = searchParams.get("quote") ? "quote"
                    : searchParams.get("config") ? "config"
                    : searchParams.get("preset") ? "preset"
                    : "directo";
                fetch("/configurador/api/track/configurator", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        kind: "open",
                        session_key: key,
                        device,
                        referrer: document.referrer || "",
                        utm_source: searchParams.get("utm_source") || "",
                        utm_medium: searchParams.get("utm_medium") || "",
                        utm_campaign: searchParams.get("utm_campaign") || "",
                        utm_content: searchParams.get("utm_content") || "",
                        landing,
                    }),
                    keepalive: true,
                }).catch(() => {});
            }
        });

        // Duración: ping al ocultar la pestaña (y cada 60s como respaldo).
        const started = Date.now();
        const ping = () => {
            const k = sessionStorage.getItem(SESSION_KEY);
            if (!k) return;
            const seconds = (Date.now() - started) / 1000;
            try {
                navigator.sendBeacon(
                    "/configurador/api/track/configurator",
                    new Blob([JSON.stringify({ kind: "ping", session_key: k, seconds })], { type: "application/json" })
                );
            } catch { /* nunca romper */ }
        };
        const onHide = () => { if (document.visibilityState === "hidden") ping(); };
        document.addEventListener("visibilitychange", onHide);
        const interval = setInterval(ping, 60_000);

        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", onHide);
            clearInterval(interval);
        };
    }, [searchParams]);

    return null;
}
