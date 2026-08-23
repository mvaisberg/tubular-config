"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useConfigStore } from "@/lib/store";
import { trackStandard } from "@/lib/meta-tracking";
import { trackConfiguratorOpen, trackStartConfigurator, trackConfigMutation } from "@/lib/analytics";
import { resolveInternalTraffic } from "@/lib/internal-traffic";

const INICIO_KEY = "meta_inicio_configuracion_fired";
const PAGEVIEW_KEY = "meta_pageview_fired";

export function MetaTracker() {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    const [allow, setAllow] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void resolveInternalTraffic().then((internal) => {
            if (!cancelled) setAllow(!internal);
        });
        return () => { cancelled = true; };
    }, []);

    // PageView: once per session, after Pixel base loaded.
    useEffect(() => {
        if (!allow || typeof window === "undefined") return;
        if (sessionStorage.getItem(PAGEVIEW_KEY)) return;
        const t = setTimeout(() => {
            sessionStorage.setItem(PAGEVIEW_KEY, "1");
            trackStandard("PageView");
            const params = new URLSearchParams(window.location.search);
            trackConfiguratorOpen({
                from_quote: params.has("quote") || params.has("config") ? 1 : 0,
            });
        }, 400);
        return () => clearTimeout(t);
    }, [allow]);

    // inicioDeConfiguracion: fire once per session on first store mutation.
    useEffect(() => {
        if (!allow || typeof window === "undefined") return;
        if (sessionStorage.getItem(INICIO_KEY)) return;
        const unsub = useConfigStore.subscribe((state) => {
            if (state.history.length > 0 && !sessionStorage.getItem(INICIO_KEY)) {
                sessionStorage.setItem(INICIO_KEY, "1");
                trackStartConfigurator();
            }
        });
        return () => unsub();
    }, [allow]);

    // Interacciones: cada mutación de la config cuenta (con debounce en analytics).
    useEffect(() => {
        if (!allow || typeof window === "undefined") return;
        let lastLen = -1;
        const unsub = useConfigStore.subscribe((state) => {
            const len = state.history.length;
            if (lastLen >= 0 && len > lastLen) {
                trackConfigMutation(state.totalPrice || undefined);
            }
            lastLen = len;
        });
        return () => unsub();
    }, [allow]);

    if (!pixelId || !allow) return null;

    return (
        <Script
            id="fb-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
                __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
`,
            }}
        />
    );
}
