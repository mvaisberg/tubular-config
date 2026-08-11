/**
 * Estado de la integración de WhatsApp. Lo usa el manager para avisar que
 * todavía falta conectar el número, sin exponer ninguna credencial.
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET() {
    const userClient = await createServerSupabase();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Sólo booleanos: nunca los valores.
    return NextResponse.json({
        configured: isConfigured(),
        hasAppSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
        hasVerifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
        hasWabaId: Boolean(process.env.WHATSAPP_WABA_ID),
        hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    });
}
