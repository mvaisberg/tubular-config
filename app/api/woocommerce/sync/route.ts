import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

interface WooMetaData {
    key: string;
    value: unknown;
    display_key?: string;
    display_value?: string;
}

// Colores/atributos de la variación (ej. acrílico Sup/Medio/Inf, o Color).
// Los atributos de variación traen display_key/display_value; los meta internos
// empiezan con "_" y se ignoran.
function variationLabel(li: WooLineItem): string {
    const attrs = (li.meta_data || [])
        .filter(m => m.display_value && !String(m.key).startsWith("_"))
        .map(m => String(m.display_value));
    return attrs.length ? `${li.name} · ${attrs.join(" / ")}` : li.name;
}

interface WooLineItem {
    id: number;
    name: string;
    product_id?: number;
    variation_id?: number;
    quantity: number;
    price: string | number;
    total: string;
    subtotal: string;
    meta_data?: WooMetaData[];
    // Imagen destacada del producto. Woo la devuelve vacía ({id:"",src:""})
    // para los muebles del configurador, que no son productos reales.
    image?: { id: number | string; src: string };
}

type WooConfig = Record<string, unknown>;

/**
 * Config del configurador que el theme guarda en el line item
 * (meta `_tubular_config_full`). Null si el ítem es de catálogo.
 */
function parseConfigMeta(li: WooLineItem): WooConfig | null {
    const meta = (li.meta_data || []).find(m => m.key === "_tubular_config_full");
    if (!meta) return null;
    try {
        const raw = typeof meta.value === "string" ? JSON.parse(meta.value) : meta.value;
        return raw && typeof raw === "object" ? raw as WooConfig : null;
    } catch {
        return null;
    }
}

/**
 * Si el line item es un mueble del configurador, reconstruye el link al
 * configurador (?config=<base64>).
 * Mismo formato base64({ modules, hasWheels }) que usa el admin de WordPress
 * y que DataLoader sabe parsear. Devuelve null si no es una config.
 */
function buildQuoteUrl(config: WooConfig | null): string | null {
    if (!config) return null;
    const modules = config.configuration ?? config.modules;
    if (!Array.isArray(modules) || modules.length === 0) return null;
    const payload = { modules, hasWheels: !!(config.has_wheels ?? config.hasWheels) };
    const b64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
    return `/configurador?config=${b64}`;
}

/**
 * Miniatura del ítem: para un mueble del configurador es el screenshot 3D que
 * capturó el propio cliente (subido a /uploads/tubular-configs/); para un
 * producto de catálogo, la imagen destacada que ya viene en la respuesta de Woo.
 */
function itemImage(li: WooLineItem, config: WooConfig | null): string | null {
    const configImg = config?.image_url;
    if (typeof configImg === "string" && configImg) return configImg;
    return li.image?.src || null;
}

interface WooBilling {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
}

interface WooShipping {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
}

interface WooOrder {
    id: number;
    number: string;
    status: string;
    date_created: string;
    customer_note?: string;
    payment_method?: string;
    payment_method_title?: string;
    total: string;
    line_items: WooLineItem[];
    billing: WooBilling;
    shipping: WooShipping;
    shipping_lines?: Array<{ method_id: string; method_title: string }>;
}

function mapPaymentMethod(wooMethod?: string): "transfer" | "cash" | "other" {
    if (!wooMethod) return "other";
    const m = wooMethod.toLowerCase();
    if (m.includes("bacs") || m.includes("transfer") || m.includes("transferencia")) return "transfer";
    if (m === "cod" || m.includes("cash") || m.includes("efectivo")) return "cash";
    return "other";
}

function mapStatus(wooStatus: string): "pending" | "paid" {
    // Woo statuses: pending, processing, on-hold, completed, cancelled, refunded, failed
    return ["processing", "completed"].includes(wooStatus) ? "paid" : "pending";
}

function formatAddress(s: WooShipping): string | null {
    const parts = [
        [s.address_1, s.address_2].filter(Boolean).join(" "),
        s.city,
        s.state,
        s.postcode,
        s.country,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
}

function isPickup(o: WooOrder): boolean {
    return (o.shipping_lines || []).some(s =>
        s.method_id?.includes("local_pickup") || /retiro|pickup/i.test(s.method_title || "")
    );
}

export async function POST() {
    try {
        // Auth: any logged-in admin user.
        const userClient = await createServerSupabase();
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const apiUrl = process.env.WOO_API_URL;
        const consumerKey = process.env.WOO_CONSUMER_KEY;
        const consumerSecret = process.env.WOO_CONSUMER_SECRET;

        if (!apiUrl || !consumerKey || !consumerSecret) {
            return NextResponse.json({
                error: "WooCommerce no está configurado. Definí WOO_API_URL, WOO_CONSUMER_KEY y WOO_CONSUMER_SECRET en .env.local"
            }, { status: 500 });
        }

        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
        const baseUrl = apiUrl.replace(/\/$/, "");

        // Solo importar órdenes a partir de esta fecha (ISO 8601 sin TZ — la API
        // de Woo lo interpreta en la TZ del sitio).
        const SYNC_FROM_DATE = "2026-06-08T00:00:00";
        const afterParam = `&after=${encodeURIComponent(SYNC_FROM_DATE)}`;

        // Paginar para traer todas las órdenes desde la fecha de corte.
        const wooOrders: WooOrder[] = [];
        let page = 1;
        const perPage = 100;
        while (true) {
            const url = `${baseUrl}/orders?per_page=${perPage}&page=${page}&orderby=date&order=desc${afterParam}`;
            let res: Response;
            try {
                res = await fetch(url, {
                    headers: { Authorization: `Basic ${auth}` },
                    cache: "no-store",
                });
            } catch (e) {
                return NextResponse.json({ error: "No se pudo conectar a WooCommerce: " + (e as Error).message }, { status: 502 });
            }
            if (!res.ok) {
                const text = await res.text();
                return NextResponse.json({ error: `Woo API error ${res.status}: ${text.slice(0, 300)}` }, { status: 502 });
            }
            const batch: WooOrder[] = await res.json();
            if (!Array.isArray(batch) || batch.length === 0) break;
            wooOrders.push(...batch);
            if (batch.length < perPage) break;
            page++;
            if (page > 50) break; // safety: max 5000 órdenes por sync
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json({ error: "Supabase service role no configurado" }, { status: 500 });
        }
        const db = createServiceSupabase(supabaseUrl, serviceKey);

        let created = 0;
        let updated = 0;
        let removed = 0;
        const errors: string[] = [];

        // Estados de Woo que NO son ventas reales: no se importan, y si ya estaban
        // en el manager se eliminan (limpieza automática de cancelados/anulados).
        const EXCLUDED_STATUSES = ["cancelled", "refunded", "failed", "trash"];

        // Pre-cargar woo_order_ids existentes para evitar 1 query por orden.
        const wooIds = wooOrders.map(o => String(o.id));
        const { data: existingRows } = await db
            .from("admin_orders")
            .select("id, woo_order_id")
            .in("woo_order_id", wooIds);
        const existingMap = new Map<string, string>(
            (existingRows || []).map(r => [String(r.woo_order_id), r.id])
        );

        for (const o of wooOrders) {
            try {
                // Cancelados/anulados: limpiar del manager si existían y saltar.
                if (EXCLUDED_STATUSES.includes(o.status)) {
                    const existingId = existingMap.get(String(o.id));
                    if (existingId) {
                        await db.from("admin_orders").delete().eq("id", existingId);
                        removed++;
                    }
                    continue;
                }
                const items = (o.line_items || []).map(li => {
                    const config = parseConfigMeta(li);
                    const quoteUrl = buildQuoteUrl(config);
                    const imageUrl = itemImage(li, config);
                    return {
                        id: String(li.id),
                        description: variationLabel(li),
                        quantity: li.quantity,
                        unit_price: parseFloat(String(li.price)) || 0,
                        ...(li.product_id ? { product_id: li.product_id } : {}),
                        ...(quoteUrl ? { quote_url: quoteUrl } : {}),
                        ...(imageUrl ? { image_url: imageUrl } : {}),
                    };
                });

                const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unit_price, 0);
                const finalAmount = parseFloat(o.total) || 0;
                const discountPct = subtotal > 0 ? Math.max(0, ((subtotal - finalAmount) / subtotal) * 100) : 0;

                const clientName = [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(" ").trim()
                    || o.billing?.email
                    || `Cliente Woo #${o.number}`;

                const pickup = isPickup(o);
                const row = {
                    woo_order_id: String(o.id),
                    source: "woocommerce" as const,
                    channel: "woocommerce",
                    client_name: clientName,
                    client_whatsapp: o.billing?.phone || null,
                    observations: o.customer_note || null,
                    shipping_type: pickup ? "pickup" : "delivery",
                    shipping_address: pickup ? null : formatAddress(o.shipping),
                    payment_method: mapPaymentMethod(o.payment_method),
                    payment_method_label: o.payment_method_title || null,
                    items,
                    total_amount: subtotal,
                    discount_percentage: Math.round(discountPct * 100) / 100,
                    final_amount: finalAmount,
                    status: mapStatus(o.status),
                    paid_amount: mapStatus(o.status) === "paid" ? finalAmount : 0,
                    created_at: o.date_created,
                };

                const existingId = existingMap.get(row.woo_order_id);
                if (existingId) {
                    const { error } = await db.from("admin_orders").update(row).eq("id", existingId);
                    if (error) {
                        errors.push(`#${o.id}: ${error.message}`);
                        continue;
                    }
                    updated++;
                } else {
                    const { error } = await db.from("admin_orders").insert(row);
                    if (error) {
                        errors.push(`#${o.id}: ${error.message}`);
                        continue;
                    }
                    created++;
                }
            } catch (e) {
                errors.push(`#${o.id}: ${(e as Error).message}`);
            }
        }

        return NextResponse.json({
            created,
            updated,
            removed,
            total: wooOrders.length,
            errors: errors.length ? errors.slice(0, 10) : undefined,
        });
    } catch (e) {
        console.error("Woo sync fatal error:", e);
        return NextResponse.json({
            error: "Error inesperado: " + (e as Error).message
        }, { status: 500 });
    }
}
