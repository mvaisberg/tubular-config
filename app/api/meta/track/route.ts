import { NextResponse } from "next/server";
import { createHash } from "crypto";

interface TrackBody {
    event_name: string;
    event_id: string;
    is_custom?: boolean;
    params?: Record<string, unknown>;
    fbp?: string | null;
    fbc?: string | null;
    event_source_url?: string;
}

function sha256(s: string): string {
    return createHash("sha256").update(s.trim().toLowerCase()).digest("hex");
}

function getClientIp(req: Request): string | undefined {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = req.headers.get("x-real-ip");
    if (real) return real;
    return undefined;
}

export async function POST(req: Request) {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
        return NextResponse.json({ error: "Meta not configured" }, { status: 500 });
    }

    let body: TrackBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.event_name || !body.event_id) {
        return NextResponse.json({ error: "event_name and event_id required" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const ip = getClientIp(req);

    // Optional: hash email/phone if the caller provided them in params.email / params.phone.
    const params = { ...(body.params || {}) };
    const userData: Record<string, unknown> = {};
    if (typeof params.email === "string") {
        userData.em = [sha256(params.email)];
        delete params.email;
    }
    if (typeof params.phone === "string") {
        userData.ph = [sha256(params.phone.replace(/\D/g, ""))];
        delete params.phone;
    }
    if (body.fbp) userData.fbp = body.fbp;
    if (body.fbc) userData.fbc = body.fbc;
    if (ip) userData.client_ip_address = ip;
    if (userAgent) userData.client_user_agent = userAgent;

    const event = {
        event_name: body.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.event_id,
        event_source_url: body.event_source_url,
        action_source: "website",
        user_data: userData,
        custom_data: params,
    };

    const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: [event] }),
        });
        const data = await res.json();
        if (!res.ok) {
            return NextResponse.json({ error: data?.error?.message || "Meta API error", details: data }, { status: 502 });
        }
        return NextResponse.json({ ok: true, events_received: data?.events_received });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
}
