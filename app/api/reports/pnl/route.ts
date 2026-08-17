/**
 * Cuadro de resultados (P&L) por período — sólo admin.
 *
 * Toma las ventas cobradas del período (admin_orders paid/completed), resuelve
 * el BOM de cada ítem para calcular el costo de materiales real, y aplica la
 * carga variable según el canal de cobro:
 *   - transfer/cash → canal efectivo: comisión de cobro 3%
 *   - other (tarjeta/MP) → canal lista facturada: fees + IVA (neto de créditos) + IIBB
 * Devuelve además la estructura de costos fijos para restar debajo.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/auth";
import { calculatePricing } from "@/lib/pricing";
import { buildConfigIndex, resolveModules } from "@/lib/order-bom";
import { creditableFraction, IVA, IIBB_RATE, CASH_FEE_RATE } from "@/lib/channel-profit";

export const dynamic = "force-dynamic";

const ivaIncl = (x: number) => x * IVA / (1 + IVA);
// Cuando no se puede resolver el BOM de un ítem, se estima el material como
// fracción del precio (relación típica costo/lista del catálogo actual).
const MATERIALS_ESTIMATE_RATIO = 0.25;

export async function GET(req: NextRequest) {
    const auth = await createServerSupabase();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((await getUserRole()) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    if (!from || !to) return NextResponse.json({ error: "Faltan from/to" }, { status: 400 });

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const [{ data: orders }, { data: parts }, { data: settings }, { data: preconfigs }, { data: fixedCosts }] = await Promise.all([
        // Ventas reales del período: todos los pedidos del manager (también los
        // pendientes de pago/entrega). Sólo se excluyen cancelados.
        db.from("admin_orders")
            .select("id, order_number, final_amount, payment_method, status, created_at, items")
            .neq("status", "cancelled")
            .gte("created_at", from)
            .lte("created_at", to + "T23:59:59.999Z")
            .order("created_at"),
        db.from("parts").select("*"),
        db.from("settings").select("*").eq("id", 1).single(),
        db.from("preconfigured_products").select("sku, woo_product_id, configuration"),
        db.from("fixed_costs").select("id, name, amount").order("amount", { ascending: false }),
    ]);

    const index = buildConfigIndex(preconfigs || []);
    const feePctNet = (((settings?.transaction_fee_percent ?? 2.5) + (settings?.installments_6_percent ?? 11)) / 100);

    const agg = {
        revenue: 0, revenueLista: 0, revenueEfectivo: 0,
        ordersLista: 0, ordersEfectivo: 0,
        materials: 0, feesCard: 0, cashFee: 0, ivaToPay: 0, iibb: 0,
        estimatedItems: 0, resolvedItems: 0,
    };

    for (const order of orders || []) {
        const rev = Number(order.final_amount) || 0;
        if (rev <= 0) continue;
        const channel = order.payment_method === "cash" || order.payment_method === "transfer" ? "efectivo" : "lista";

        // Materiales + base con factura desde el BOM de cada ítem.
        let materials = 0;
        let creditable = 0;
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
            const qty = Number(item.quantity) || 1;
            const modules = await resolveModules(item, db, index);
            if (modules?.length) {
                try {
                    const pricing = calculatePricing(modules, parts || [], settings, false);
                    materials += pricing.totalCost * qty;
                    for (const [sku, it] of Object.entries(pricing.bomSummary)) {
                        creditable += it.totalCostARS * creditableFraction(sku) * qty;
                    }
                    agg.resolvedItems++;
                    continue;
                } catch { /* cae al estimado */ }
            }
            const itemTotal = (Number(item.unit_price) || 0) * qty;
            materials += itemTotal * MATERIALS_ESTIMATE_RATIO;
            agg.estimatedItems++;
        }

        agg.revenue += rev;
        agg.materials += materials;

        if (channel === "lista") {
            agg.revenueLista += rev;
            agg.ordersLista++;
            const feesNet = rev * feePctNet;
            const feesIva = feesNet * IVA;
            agg.feesCard += feesNet + feesIva;
            const ivaDebit = ivaIncl(rev);
            agg.ivaToPay += Math.max(0, ivaDebit - ivaIncl(creditable) - feesIva);
            agg.iibb += (rev / (1 + IVA)) * IIBB_RATE;
        } else {
            agg.revenueEfectivo += rev;
            agg.ordersEfectivo++;
            agg.cashFee += rev * CASH_FEE_RATE;
        }
    }

    const variableTotal = agg.materials + agg.feesCard + agg.cashFee + agg.ivaToPay + agg.iibb;

    return NextResponse.json({
        from, to,
        orders: (agg.ordersLista + agg.ordersEfectivo),
        ...agg,
        variableTotal,
        contribution: agg.revenue - variableTotal,
        fixedCosts: fixedCosts || [],
    });
}
