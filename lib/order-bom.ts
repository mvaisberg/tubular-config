// Resolución de módulos (config) a partir de una línea de pedido, para calcular piezas.
//
// - Items del configurador: traen quote_url (?config=base64 o ?quote=id) o quote_id.
// - Items de catálogo (cargados directo en Woo): NO traen config, pero se vinculan a
//   un preconfigured_product por woo_product_id (si el sync guardó product_id) o, en su
//   defecto, por el código de producto que abre la descripción (ej. "ST-203 Biblioteca · …").

import { ModuleConfig } from "@/lib/types";

export interface OrderItemLike {
    description?: string;
    quantity?: number;
    quote_id?: string | null;
    quote_url?: string | null;
    product_id?: number | string | null;
}

interface PreconfigRow {
    sku?: string | null;
    woo_product_id?: number | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configuration?: any;
}

export interface ConfigIndex {
    byWoo: Map<string, ModuleConfig[]>;
    byCode: Map<string, ModuleConfig[]>;
}

function modulesFromConfiguration(cfg: unknown): ModuleConfig[] | null {
    if (!cfg) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = cfg as any;
    const modules = Array.isArray(c) ? c : (c.modules || c.configuration);
    return Array.isArray(modules) && modules.length ? modules : null;
}

/** Código de producto que abre un texto: "ST-203 Biblioteca" → "ST-203", "TUB-A105 · …" → "TUB-A105". */
export function codeFromText(s?: string | null): string | null {
    if (!s) return null;
    const m = s.match(/^([A-Za-z]{2,}-[A-Za-z0-9]+)/);
    return m ? m[1].toUpperCase() : null;
}

/** Color/variante que trae la descripción después de " · ". Ej "…· Negro Grafito" → "Negro Grafito". */
export function colorFromDescription(desc?: string | null): string {
    if (!desc || !desc.includes("·")) return "Sin especificar";
    const tail = desc.split("·").slice(1).join("·").trim();
    if (!tail) return "Sin especificar";
    const parts = tail.split("/").map(p => p.trim()).filter(Boolean);
    const uniq = [...new Set(parts)];
    return uniq.length ? uniq.join(" + ") : "Sin especificar";
}

export function buildConfigIndex(rows: PreconfigRow[]): ConfigIndex {
    const byWoo = new Map<string, ModuleConfig[]>();
    const byCode = new Map<string, ModuleConfig[]>();
    for (const r of rows) {
        const mods = modulesFromConfiguration(r.configuration);
        if (!mods) continue;
        if (r.woo_product_id != null) byWoo.set(String(r.woo_product_id), mods);
        const code = codeFromText(r.sku);
        if (code) byCode.set(code, mods);
    }
    return { byWoo, byCode };
}

/**
 * Devuelve los módulos de una línea de pedido, o null si no se puede resolver.
 * Orden: config inline/quote → vínculo por woo product_id → vínculo por código de la descripción.
 */
export async function resolveModules(
    item: OrderItemLike,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any,
    index: ConfigIndex,
): Promise<ModuleConfig[] | null> {
    // 1) config inline en quote_url (?config=base64)
    if (item.quote_url && item.quote_url.includes("config=")) {
        try {
            const b64 = decodeURIComponent(item.quote_url.split("config=")[1].split("&")[0]);
            const json = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
            const modules = modulesFromConfiguration(json);
            if (modules) return modules;
        } catch { /* sigue */ }
    }
    // 2) quote por id (quote_id o ?quote= en la url)
    let quoteId = item.quote_id || null;
    if (!quoteId && item.quote_url && item.quote_url.includes("quote=")) {
        quoteId = item.quote_url.split("quote=")[1].split("&")[0];
    }
    if (quoteId) {
        const { data } = await db.from("quotes").select("configuration").eq("id", quoteId).maybeSingle();
        const modules = modulesFromConfiguration(data?.configuration);
        if (modules) return modules;
    }
    // 3) catálogo: por woo product_id (si el sync lo guardó)
    if (item.product_id != null) {
        const m = index.byWoo.get(String(item.product_id));
        if (m) return m;
    }
    // 4) catálogo: por código de la descripción ("ST-203 …")
    const code = codeFromText(item.description);
    if (code) {
        const m = index.byCode.get(code);
        if (m) return m;
    }
    return null;
}
