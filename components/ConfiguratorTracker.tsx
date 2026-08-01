"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const OPEN_KEY = "tubular_configurador_open_tracked";

// Registra UNA apertura del configurador por sesión de navegador.
// No cuenta cuando un admin lo abre en modo preview (?admin=true|1).
export function ConfiguratorTracker() {
    const searchParams = useSearchParams();

    useEffect(() => {
        if (typeof window === "undefined") return;
        const admin = searchParams.get("admin");
        if (admin === "true" || admin === "1") return;
        if (sessionStorage.getItem(OPEN_KEY)) return;
        sessionStorage.setItem(OPEN_KEY, "1");

        const device = window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop";
        fetch("/configurador/api/track/configurator", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device, referrer: document.referrer || "" }),
            keepalive: true,
        }).catch(() => {});
    }, [searchParams]);

    return null;
}
