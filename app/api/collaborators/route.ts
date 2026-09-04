// Alta pública en la base de colaboradores (formulario /sumate).
// Dos caminos: "trabajo" (CV opcional en PDF) y "contenido" (creadores).

import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

const s = (v: FormDataEntryValue | null, max: number) =>
    (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: Request) {
    try {
        const db = createServiceSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const form = await req.formData();

        const type = form.get("type") === "contenido" ? "contenido" : "trabajo";
        const fullName = s(form.get("full_name"), 120);
        const whatsapp = s(form.get("whatsapp"), 40);
        if (!fullName || !whatsapp) return NextResponse.json({ error: "Faltan nombre o WhatsApp" }, { status: 400 });

        // Honeypot anti-bots.
        if (s(form.get("website"), 10)) return NextResponse.json({ ok: true });

        let cvPath: string | null = null;
        const cv = form.get("cv");
        if (cv instanceof File && cv.size > 0) {
            if (cv.size > 10 * 1024 * 1024) return NextResponse.json({ error: "El CV supera los 10 MB" }, { status: 400 });
            if (cv.type !== "application/pdf") return NextResponse.json({ error: "El CV debe ser un PDF" }, { status: 400 });
            cvPath = `colab-${crypto.randomUUID()}.pdf`;
            const { error } = await db.storage.from("cvs").upload(cvPath, cv, { contentType: "application/pdf" });
            if (error) cvPath = null; // igual se guarda el registro
        }

        const areas = form.getAll("areas").map(a => String(a).slice(0, 40)).filter(Boolean);

        const { error } = await db.from("collaborators").insert({
            type,
            full_name: fullName,
            whatsapp,
            email: s(form.get("email"), 160),
            location: s(form.get("location"), 200),
            areas: type === "trabajo" && areas.length ? areas : null,
            experience: s(form.get("experience"), 2000),
            cv_path: cvPath,
            instagram: s(form.get("instagram"), 80),
            tiktok: s(form.get("tiktok"), 80),
            followers: s(form.get("followers"), 40),
            content_type: s(form.get("content_type"), 80),
            portfolio_url: s(form.get("portfolio_url"), 300),
            proposal: s(form.get("proposal"), 2000),
            utm_source: s(form.get("utm_source"), 80),
            utm_medium: s(form.get("utm_medium"), 80),
            utm_campaign: s(form.get("utm_campaign"), 120),
        });
        if (error) return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo." }, { status: 500 });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Error inesperado. Probá de nuevo." }, { status: 500 });
    }
}
