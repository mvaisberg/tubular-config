// Meta Pixel + Conversions API client-side helper.
// Fires fbq browser event AND sends the same event to /api/meta/track for CAPI,
// using a shared event_id so Meta deduplicates them.

declare global {
    interface Window {
        fbq?: (...args: unknown[]) => void;
    }
}

type StandardEvent =
    | "PageView"
    | "AddToCart"
    | "InitiateCheckout"
    | "ViewContent"
    | "Purchase"
    | "Lead";

interface EventParams {
    value?: number;
    currency?: string;
    content_ids?: (string | number)[];
    content_type?: string;
    content_name?: string;
    content_category?: string;
    num_items?: number;
    [key: string]: unknown;
}

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[2]) : null;
}

function newEventId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function sendCapi(name: string, eventId: string, params: EventParams, isCustom: boolean) {
    try {
        await fetch("/configurador/api/meta/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                event_name: name,
                event_id: eventId,
                is_custom: isCustom,
                params,
                fbp: getCookie("_fbp"),
                fbc: getCookie("_fbc"),
                event_source_url: typeof window !== "undefined" ? window.location.href : undefined,
            }),
            keepalive: true,
        });
    } catch {
        // best-effort, don't block UX
    }
}

export function trackStandard(name: StandardEvent, params: EventParams = {}) {
    const eventId = newEventId();
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
        window.fbq("track", name, params, { eventID: eventId });
    }
    void sendCapi(name, eventId, params, false);
}

export function trackCustom(name: string, params: EventParams = {}) {
    const eventId = newEventId();
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
        window.fbq("trackCustom", name, params, { eventID: eventId });
    }
    void sendCapi(name, eventId, params, true);
}
