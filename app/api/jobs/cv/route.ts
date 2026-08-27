// Devuelve una URL firmada (1 h) para ver el CV de una postulación. Solo admin.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
    const auth = await createServerSupabase();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((await getUserRole()) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const path = req.nextUrl.searchParams.get("path");
    if (!path || path.includes("..")) return NextResponse.json({ error: "Falta path" }, { status: 400 });

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await db.storage.from("cvs").createSignedUrl(path, 3600);
    if (error || !data) return NextResponse.json({ error: "No se pudo generar el link" }, { status: 500 });
    return NextResponse.json({ url: data.signedUrl });
}
