// Lista de piezas (BOM) de un pedido, para que el armador sepa qué va en la caja.
//
// - Items del configurador (con quote_id o quote_url): se calcula el BOM real
//   con calculatePricing y se agrega por SKU.
// - Items de catálogo web (sin configuración): se listan aparte como
//   "sin receta" — todavía no se les puede calcular las piezas.
//
// Disponible para cualquier usuario logueado (viewer y admin).

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { calculatePricing } from "@/lib/pricing";
import { buildConfigIndex, resolveModules, OrderItemLike } from "@/lib/order-bom";

type OrderItem = OrderItemLike;

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const id = (await params).id;

    const auth = await createServerSupabase();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: "Supabase service role missing" }, { status: 500 });
    }
    const db = createServiceSupabase(supabaseUrl, serviceKey);

    const { data: order, error } = await db
        .from("admin_orders")
        .select("id, items")
        .eq("id", id)
        .maybeSingle();
    if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const [partsRes, settingsRes, preRes] = await Promise.all([
        db.from("parts").select("*"),
        db.from("settings").select("*").eq("id", 1).maybeSingle(),
        db.from("preconfigured_products").select("sku, woo_product_id, configuration"),
    ]);
    const partsData = partsRes.data || [];
    const settings = settingsRes.data || { usd_exchange_rate: 1000 };
    const index = buildConfigIndex(preRes.data || []);

    const pieces: Record<string, { name: string; sku: string; quantity: number }> = {};
    const unsupported: { description: string; quantity: number }[] = [];

    for (const item of (order.items as OrderItem[]) || []) {
        const qty = item.quantity || 1;
        const modules = await resolveModules(item, db, index);
        if (!modules) {
            // Item de catálogo sin configuración → no se puede desglosar todavía.
            unsupported.push({ description: item.description || "Producto", quantity: qty });
            continue;
        }
        try {
            const { bomSummary } = calculatePricing(modules, partsData, settings, false);
            for (const [sku, line] of Object.entries(bomSummary)) {
                if (!pieces[sku]) pieces[sku] = { name: line.name, sku, quantity: 0 };
                pieces[sku].quantity += line.quantity * qty;
            }
        } catch {
            unsupported.push({ description: item.description || "Producto", quantity: qty });
        }
    }

    const list = Object.values(pieces).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({
        pieces: list,
        unsupported,
        hasConfig: list.length > 0,
    });
}
