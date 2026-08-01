// Lista simplificada de productos de WooCommerce, para el selector que vincula
// una configuración guardada con su producto de catálogo. Solo admin.

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

interface WooAttribute {
    name: string;
    variation: boolean;
    options?: string[];
}

interface WooProduct {
    id: number;
    name: string;
    sku: string;
    type: string;
    status: string;
    price: string;
    categories?: { name: string }[];
    attributes?: WooAttribute[];
    images?: { src: string }[];
}

export async function GET() {
    const auth = await createServerSupabase();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiUrl = process.env.WOO_API_URL;
    const consumerKey = process.env.WOO_CONSUMER_KEY;
    const consumerSecret = process.env.WOO_CONSUMER_SECRET;
    if (!apiUrl || !consumerKey || !consumerSecret) {
        return NextResponse.json({ error: "WooCommerce no configurado" }, { status: 500 });
    }

    const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const baseUrl = apiUrl.replace(/\/$/, "");

    // Nombre lindo para un atributo: "pa_acrilico-superior" → "Acrilico superior".
    const cleanAttrName = (raw: string) => {
        const s = raw.replace(/^pa_/i, "").replace(/[-_]+/g, " ").trim();
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    interface VariationAttr { name: string; options: string[] }
    const products: { id: number; name: string; sku: string; type: string; category: string; price: number; image: string; variationAttributes: VariationAttr[] }[] = [];
    let page = 1;
    try {
        while (true) {
            const url = `${baseUrl}/products?per_page=100&page=${page}&status=publish&orderby=title&order=asc`;
            const res = await fetch(url, { headers: { Authorization: `Basic ${basic}` }, cache: "no-store" });
            if (!res.ok) {
                const text = await res.text();
                return NextResponse.json({ error: `Woo API ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
            }
            const batch: WooProduct[] = await res.json();
            if (!Array.isArray(batch) || batch.length === 0) break;
            for (const p of batch) {
                // Atributos de variación reales (ej. acero: pa_color; acrílico: superior/medio/inferior).
                const variationAttributes: VariationAttr[] = (p.attributes || [])
                    .filter(a => a.variation && (a.options || []).length > 0)
                    .map(a => ({
                        name: cleanAttrName(a.name),
                        options: [...new Set((a.options || []).map(o => String(o).trim()).filter(Boolean))],
                    }));
                products.push({
                    id: p.id,
                    name: p.name,
                    sku: p.sku || "",
                    type: p.type,
                    category: p.categories?.[0]?.name || "",
                    price: parseFloat(p.price) || 0,
                    image: p.images?.[0]?.src || "",
                    variationAttributes,
                });
            }
            if (batch.length < 100) break;
            page++;
            if (page > 20) break;
        }
    } catch (e) {
        return NextResponse.json({ error: "No se pudo conectar a WooCommerce: " + (e as Error).message }, { status: 502 });
    }

    return NextResponse.json({ products });
}
