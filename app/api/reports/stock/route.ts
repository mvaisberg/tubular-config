// Informe de stock de piezas necesarias según los pedidos PENDIENTES DE ENTREGAR.
//
// Dinámico: recorre los pedidos con fulfillment_status='pending', resuelve la config de
// cada línea (configurador o catálogo vinculado) y suma todas las piezas. Los paneles se
// desglosan por color (tomado de la variante del pedido) para saber cuánto pintar de cada uno.
// Solo admin (datos de producción/costos).

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/auth";
import { calculatePricing } from "@/lib/pricing";
import { buildConfigIndex, resolveModules, colorFromDescription, OrderItemLike } from "@/lib/order-bom";

interface OrderRow {
    id: string;
    order_number?: string | number | null;
    client_name?: string | null;
    items?: OrderItemLike[] | null;
}

// Nombre legible de cada color interno del configurador (para el desglose de pintura).
const COLOR_NAME: Record<string, string> = {
    black: "Negro Grafito (RAL 9011)", white: "Blanco Puro (RAL 9010)", beige: "Beige (RAL 1019)",
    transparent: "Transparente (acrílico)", orange_translucent: "Naranja", blue_translucent: "Azul",
    green_translucent: "Verde", black_solid: "Negro", white_solid: "Blanco",
};
const PANEL_SIDES = ["top", "bottom", "left", "right", "front", "back"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countPanels(m: any): number {
    const p = m?.hasPanel || {};
    return PANEL_SIDES.reduce((n, k) => n + (p[k] ? 1 : 0), 0);
}

export async function GET() {
    const auth = await createServerSupabase();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((await getUserRole()) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "Supabase service role missing" }, { status: 500 });
    const db = createServiceSupabase(supabaseUrl, serviceKey);

    const [ordersRes, partsRes, settingsRes, preRes] = await Promise.all([
        db.from("admin_orders").select("id, order_number, client_name, items, fulfillment_status").eq("fulfillment_status", "pending"),
        db.from("parts").select("*"),
        db.from("settings").select("*").eq("id", 1).maybeSingle(),
        db.from("preconfigured_products").select("sku, woo_product_id, configuration"),
    ]);

    const orders = (ordersRes.data || []) as OrderRow[];
    const partsData = partsRes.data || [];
    const settings = settingsRes.data || { usd_exchange_rate: 1000 };
    const index = buildConfigIndex(preRes.data || []);

    const pieces: Record<string, { name: string; sku: string; quantity: number }> = {};
    const panelsByColor: Record<string, number> = {};
    const unmatched: { description: string; quantity: number; order: string }[] = [];
    let matchedOrders = 0;
    const contributingOrders = new Set<string>();

    for (const order of orders) {
        const label = String(order.order_number || order.client_name || order.id);
        for (const item of order.items || []) {
            const qty = item.quantity || 1;
            const modules = await resolveModules(item, db, index);
            if (!modules) {
                unmatched.push({ description: item.description || "Producto", quantity: qty, order: label });
                continue;
            }
            try {
                const { bomSummary } = calculatePricing(modules, partsData, settings, false);
                for (const [sku, line] of Object.entries(bomSummary)) {
                    if (!pieces[sku]) pieces[sku] = { name: line.name, sku, quantity: 0 };
                    pieces[sku].quantity += line.quantity * qty;
                }
                // Paneles por color de pintura:
                // - catálogo (sin quote): el color real es la variante del pedido (descripción).
                // - configurador: el color está en cada módulo (los del catálogo tienen color placeholder).
                const isCatalog = !item.quote_url && !item.quote_id;
                if (isCatalog) {
                    const color = colorFromDescription(item.description);
                    const panels = modules.reduce((n, m) => n + countPanels(m), 0);
                    if (panels) panelsByColor[color] = (panelsByColor[color] || 0) + panels * qty;
                } else {
                    for (const m of modules) {
                        const panels = countPanels(m);
                        if (!panels) continue;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const color = COLOR_NAME[(m as any).color] || (m as any).color || "Sin especificar";
                        panelsByColor[color] = (panelsByColor[color] || 0) + panels * qty;
                    }
                }
                contributingOrders.add(order.id);
            } catch {
                unmatched.push({ description: item.description || "Producto", quantity: qty, order: label });
            }
        }
    }
    matchedOrders = contributingOrders.size;

    return NextResponse.json({
        pendingOrders: orders.length,
        matchedOrders,
        pieces: Object.values(pieces).sort((a, b) => b.quantity - a.quantity),
        panelsByColor: Object.entries(panelsByColor).map(([color, quantity]) => ({ color, quantity })).sort((a, b) => b.quantity - a.quantity),
        unmatched,
    });
}
