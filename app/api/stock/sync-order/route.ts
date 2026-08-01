// Sincroniza el stock con el estado de un pedido.
//
// Lógica idempotente:
//   - Si el pedido está pago y aún no consumió stock → genera movements negativos
//     por cada SKU del BOM de los items con quote_id.
//   - Si el pedido NO está pago y tenía movements → los borra (el trigger recalcula).
//
// Llamado desde:
//   - OrderForm (después de crear/editar un pedido)
//   - /api/woocommerce/sync por cada orden importada

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { calculatePricing } from "@/lib/pricing";

interface OrderItem {
    quote_id?: string | null;
    quantity?: number;
}

export async function POST(req: Request) {
    const auth = await createServerSupabase();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { order_id?: string };
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
    if (!body.order_id) return NextResponse.json({ error: "order_id required" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: "Supabase service role missing" }, { status: 500 });
    }
    const db = createServiceSupabase(supabaseUrl, serviceKey);

    const { data: order, error: orderErr } = await db
        .from("admin_orders")
        .select("id, status, items")
        .eq("id", body.order_id)
        .maybeSingle();

    if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Movements existentes asociados a este pedido.
    const { data: existing } = await db
        .from("stock_movements")
        .select("id")
        .eq("order_id", order.id);
    const hasExisting = (existing?.length || 0) > 0;

    // Caso 1: pedido NO pago + ya teníamos consumos → revertir borrando movements.
    if (order.status !== "paid" && hasExisting) {
        const { error } = await db
            .from("stock_movements")
            .delete()
            .eq("order_id", order.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ action: "reverted", movements_deleted: existing?.length || 0 });
    }

    // Caso 2: pedido pago + ya consumió → no-op (idempotente).
    if (order.status === "paid" && hasExisting) {
        return NextResponse.json({ action: "noop", message: "Already consumed" });
    }

    // Caso 3: pedido no pago + sin movements → nada que hacer.
    if (order.status !== "paid") {
        return NextResponse.json({ action: "noop", message: "Order not paid" });
    }

    // Caso 4: pedido pago + sin movements → calcular BOM y consumir.
    const itemsWithQuotes: { quote_id: string; quantity: number }[] = ((order.items as OrderItem[]) || [])
        .filter(it => it.quote_id)
        .map(it => ({ quote_id: it.quote_id as string, quantity: it.quantity || 1 }));

    if (itemsWithQuotes.length === 0) {
        return NextResponse.json({ action: "noop", message: "No items with quote_id (manual order)" });
    }

    // Cargar parts catalog + settings para poder generar el BOM con precios.
    const [partsRes, settingsRes] = await Promise.all([
        db.from("parts").select("*"),
        db.from("settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    const partsData = partsRes.data || [];
    const settings = settingsRes.data || { usd_exchange_rate: 1000 };

    // Mapa SKU → stock_item_id para lookup rápido.
    const { data: stockItems } = await db
        .from("stock_items")
        .select("id, sku")
        .not("sku", "is", null);
    const skuToStockId = new Map<string, string>();
    (stockItems || []).forEach(s => {
        if (s.sku) skuToStockId.set(String(s.sku), s.id);
    });

    // Agregar el BOM de todos los items.
    const aggregatedBom = new Map<string, { name: string; quantity: number }>();
    for (const it of itemsWithQuotes) {
        const { data: quote } = await db
            .from("quotes")
            .select("configuration")
            .eq("id", it.quote_id)
            .maybeSingle();
        const modules = quote?.configuration?.modules;
        if (!Array.isArray(modules)) continue;

        try {
            const { bomSummary } = calculatePricing(modules, partsData, settings, false);
            Object.entries(bomSummary).forEach(([sku, line]) => {
                const prev = aggregatedBom.get(sku);
                const qty = line.quantity * it.quantity;
                if (prev) prev.quantity += qty;
                else aggregatedBom.set(sku, { name: line.name, quantity: qty });
            });
        } catch (e) {
            console.error(`BOM calc failed for quote ${it.quote_id}:`, e);
        }
    }

    // Generar movements (uno por SKU que matchee con un stock_item).
    const movementsToInsert: Array<{
        stock_item_id: string;
        quantity: number;
        reason: string;
        order_id: string;
        user_id: string;
        author_email: string | null;
        note: string;
    }> = [];
    const notFoundSkus: string[] = [];

    for (const [sku, line] of aggregatedBom) {
        const stockId = skuToStockId.get(sku);
        if (!stockId) {
            notFoundSkus.push(sku);
            continue;
        }
        movementsToInsert.push({
            stock_item_id: stockId,
            quantity: -line.quantity,
            reason: "consumo_pedido",
            order_id: order.id,
            user_id: user.id,
            author_email: user.email || null,
            note: line.name,
        });
    }

    if (movementsToInsert.length === 0) {
        return NextResponse.json({
            action: "noop",
            message: "Ningún SKU del BOM matchea con stock_items",
            unmatched_skus: notFoundSkus,
        });
    }

    const { error: insErr } = await db.from("stock_movements").insert(movementsToInsert);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({
        action: "consumed",
        movements_created: movementsToInsert.length,
        skus_consumed: movementsToInsert.length,
        skus_unmatched: notFoundSkus,
    });
}
