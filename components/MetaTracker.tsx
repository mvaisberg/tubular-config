"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useConfigStore } from "@/lib/store";
import { trackStandard, trackCustom } from "@/lib/meta-tracking";

const INICIO_KEY = "meta_inicio_configuracion_fired";
const PAGEVIEW_KEY = "meta_pageview_fired";

export function MetaTracker() {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

    // PageView: once per session, after Pixel base loaded.
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (sessionStorage.getItem(PAGEVIEW_KEY)) return;
        // Defer slightly so fbq base script has time to register.
        const t = setTimeout(() => {
            sessionStorage.setItem(PAGEVIEW_KEY, "1");
            trackStandard("PageView");
        }, 400);
        return () => clearTimeout(t);
    }, []);

    // inicioDeConfiguracion: fire once per session on first store mutation.
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (sessionStorage.getItem(INICIO_KEY)) return;
        const unsub = useConfigStore.subscribe((state) => {
            if (state.history.length > 0 && !sessionStorage.getItem(INICIO_KEY)) {
                sessionStorage.setItem(INICIO_KEY, "1");
                trackCustom("inicioDeConfiguracion");
            }
        });
        return () => unsub();
    }, []);

    if (!pixelId) return null;

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
