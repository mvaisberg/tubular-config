// Recibe una postulación laboral del formulario público /trabaja.
// Público, sin auth. CV opcional (PDF ≤ 10MB) al bucket privado "cvs".

import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

const s = (v: FormDataEntryValue | null, max: number) =>
    (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: Request) {
    try {
        const db = createServiceSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const form = await req.formData();

        const fullName = s(form.get("full_name"), 120);
        const whatsapp = s(form.get("whatsapp"), 40);
        if (!fullName || !whatsapp) {
            return NextResponse.json({ error: "Faltan nombre o WhatsApp" }, { status: 400 });
        }

        // Anti-spam mínimo: honeypot (campo oculto que los bots completan).
        if (s(form.get("website"), 10)) return NextResponse.json({ ok: true });

        let cvPath: string | null = null;
        const cv = form.get("cv");
        if (cv instanceof File && cv.size > 0) {
            if (cv.size > 10 * 1024 * 1024) return NextResponse.json({ error: "El CV supera los 10 MB" }, { status: 400 });
            if (cv.type !== "application/pdf") return NextResponse.json({ error: "El CV debe ser un PDF" }, { status: 400 });
            cvPath = `${crypto.randomUUID()}.pdf`;
            const { error: upErr } = await db.storage.from("cvs").upload(cvPath, cv, { contentType: "application/pdf" });
            if (upErr) cvPath = null; // la postulación entra igual, sin CV
        }

        const birthYearRaw = parseInt(String(form.get("birth_year") || ""), 10);
        const { error } = await db.from("job_applications").insert({
            full_name: fullName,
            whatsapp,
            birth_year: birthYearRaw >= 1940 && birthYearRaw <= 2015 ? birthYearRaw : null,
            location: s(form.get("location"), 200),
            available_schedule: form.get("available_schedule") === "si",
            physical_ok: form.get("physical_ok") === "si",
            drivers_license: s(form.get("drivers_license"), 20),
            experience: s(form.get("experience"), 2000),
            strengths: s(form.get("strengths"), 1000),
            salary_expectation: s(form.get("salary_expectation"), 100),
            start_date: s(form.get("start_date"), 100),
            cv_path: cvPath,
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
