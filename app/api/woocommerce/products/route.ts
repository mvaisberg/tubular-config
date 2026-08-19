// GET  → lista simplificada de productos de WooCommerce, para el selector que
//        vincula una configuración guardada con su producto de catálogo.
// POST → crea el producto en Woo a partir de una configuración guardada del
//        manager: descripción con medidas, precio del configurador, variaciones
//        por color. Queda en borrador para subirle las fotos y publicar.
// Solo admin.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/auth";
import { calculatePricing } from "@/lib/pricing";
import type { ModuleConfig } from "@/lib/types";

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

// ── POST: crear producto en Woo desde una configuración guardada ────────────

const COLORS: Record<"steel" | "acrylic", string[]> = {
    steel: ["Grafito", "Blanco", "Beige"],
    acrylic: ["Naranja Translúcido", "Transparente", "Negro Sólido", "Blanco Sólido"],
};
const CATEGORY_ID: Record<"steel" | "acrylic", number> = { steel: 54, acrylic: 53 };

export async function POST(req: NextRequest) {
    const auth = await createServerSupabase();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((await getUserRole()) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const apiUrl = process.env.WOO_API_URL;
    const consumerKey = process.env.WOO_CONSUMER_KEY;
    const consumerSecret = process.env.WOO_CONSUMER_SECRET;
    if (!apiUrl || !consumerKey || !consumerSecret) {
        return NextResponse.json({ error: "WooCommerce no configurado" }, { status: 500 });
    }
    const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const baseUrl = apiUrl.replace(/\/$/, "");
    const woo = async (path: string, method: string, body?: unknown) => {
        const res = await fetch(`${baseUrl}/${path}`, {
            method,
            headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || `Woo API ${res.status}`);
        return json;
    };

    const { productId } = await req.json() as { productId?: string };
    if (!productId) return NextResponse.json({ error: "Falta productId" }, { status: 400 });

    const db = createServiceSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const [{ data: product }, { data: parts }, { data: settings }] = await Promise.all([
        db.from("preconfigured_products").select("*").eq("id", productId).single(),
        db.from("parts").select("*"),
        db.from("settings").select("*").eq("id", 1).single(),
    ]);
    if (!product) return NextResponse.json({ error: "No existe esa configuración guardada" }, { status: 404 });
    if (product.woo_product_id) return NextResponse.json({ error: "Ya está vinculado a un producto de Woo" }, { status: 400 });

    const cfg = product.configuration;
    const modules = (Array.isArray(cfg) ? cfg : cfg?.modules || []) as ModuleConfig[];
    const hasWheels = !Array.isArray(cfg) && Boolean(cfg?.hasWheels);
    if (!modules.length) return NextResponse.json({ error: "La configuración no tiene módulos" }, { status: 400 });

    const material = (modules[0]?.material || "steel") as "steel" | "acrylic";
    const pricing = calculatePricing(modules, parts || [], settings, hasWheels);
    const price = String(Math.round(pricing.totalPrice));

    // Medidas totales: caja envolvente de los módulos (posiciones y tamaños en mm).
    type M = { size: { w: number; h: number; d: number }; position: { x: number; y: number } };
    const ms = modules as unknown as M[];
    const cm = (mm: number) => Math.round(mm / 10);
    const ancho = cm(Math.max(...ms.map(m => m.position.x + m.size.w)) - Math.min(...ms.map(m => m.position.x)));
    const alto = cm(Math.max(...ms.map(m => m.position.y + m.size.h)) - Math.min(...ms.map(m => m.position.y)));
    const prof = cm(Math.max(...ms.map(m => m.size.d)));

    const matLabel = material === "acrylic" ? "acrílico" : "chapa de acero pintada";
    const description = [
        `<p>Medidas:</p>`,
        `<p>Alto: ${alto}cm<br />Ancho: ${ancho}cm<br />Profundidad: ${prof}cm</p>`,
        `<p>${modules.length} ${modules.length === 1 ? "módulo" : "módulos"} · estructura de caños y esferas cromadas con paneles de ${matLabel}.</p>`,
        `<p>Hecho a pedido. También lo podés personalizar a tu medida en nuestro <a href="https://tubular.com.ar/configurador">configurador 3D</a>.</p>`,
    ].join("\n");

    try {
        const colors = COLORS[material];
        const created = await woo("products", "POST", {
            name: product.name,
            sku: product.sku || undefined,
            type: "variable",
            status: "draft", // queda en borrador: subir fotos y publicar desde wp-admin
            description,
            categories: [{ id: CATEGORY_ID[material] }],
            attributes: [
                { name: "Color", visible: true, variation: true, options: colors },
                { name: "Marca", visible: true, variation: false, options: ["Tubular"] },
            ],
        });

        await woo(`products/${created.id}/variations/batch`, "POST", {
            create: colors.map(c => ({
                regular_price: price,
                attributes: [{ name: "Color", option: c }],
            })),
        });

        await db.from("preconfigured_products").update({ woo_product_id: created.id }).eq("id", productId);

        return NextResponse.json({
            ok: true,
            id: created.id,
            price: Number(price),
            editUrl: `https://tubular.com.ar/wp-admin/post.php?post=${created.id}&action=edit`,
        });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
}
