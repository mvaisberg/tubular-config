import { generateParts } from './calculator';
import { ModuleConfig } from './types';

export interface BOMItem {
    name: string;
    quantity: number;
    unitCostARS: number;
    totalCostARS: number;
}

export interface Settings {
    usd_exchange_rate: number;
    profit_margin: number; // For backward compatibility? No, let's use the new ones
    shipping_cost?: number;
    transaction_fee_percent?: number;
    transaction_fee_iva_percent?: number;
    installments_6_percent?: number;
    iva_percent?: number;
    target_margin_percent?: number;
    // Márgenes objetivo por material — si existen, pisan a target_margin_percent.
    margin_steel_percent?: number;
    margin_acrylic_percent?: number;
}

export interface PricingResult {
    totalCost: number; // product_cost in formula
    totalPrice: number; // final_price in formula
    bomSummary: Record<string, BOMItem>;
    metrics: {
        basePrice: number;
        grossProfit: number;
        realRevenue: number;
        roasBreakEven: number;
        roasTarget: number;
    };
    // Desglose paso a paso de cómo el costo se convierte en el precio final.
    breakdown: {
        productCost: number;      // costo de materiales (suma del BOM)
        marginPercent: number;    // margen objetivo aplicado
        basePrice: number;        // costo / (1 - margen)
        shippingCost: number;     // envío sumado
        pricePlusShipping: number;
        feePercent: number;       // fees totales (transacción + cuotas, con IVA)
        transactionFeePercent: number; // fee de transacción real (con IVA)
        installmentFeePercent: number; // fee de cuotas real (con IVA)
        finalPrice: number;       // precio final de lista
    };
}

// Construye un modelo de costo lineal para los caños a partir del catálogo:
//   costo(largo) = a + b * largo
// Ajusta una recta por mínimos cuadrados sobre los caños de acero con largo
// numérico (350/500/750…). Sirve para interpolar/extrapolar cualquier largo
// (p.ej. 400mm) que NO tenga un SKU exacto, en vez de cobrarlo $0.
//   - 1 solo punto  → proporcional ($/mm)
//   - 0 puntos      → 0
function buildTubeCostModel(partsData: any[], usdRate: number): (length: number) => number {
    const pts: { len: number; cost: number }[] = [];
    for (const p of partsData) {
        if (p.type !== 'tube') continue;
        if (p.dimensions?.material) continue; // ignorar el caño acrílico especial
        const len = p.dimensions?.length;
        if (typeof len !== 'number' || len <= 0) continue;
        const cost = p.price_ars ? p.price_ars : (p.price_usd ? p.price_usd * usdRate : 0);
        if (cost > 0) pts.push({ len, cost });
    }
    if (pts.length === 0) return () => 0;
    if (pts.length === 1) {
        const rate = pts[0].cost / pts[0].len;
        return (l: number) => Math.max(0, Math.round(rate * l));
    }
    const n = pts.length;
    const sx = pts.reduce((s, p) => s + p.len, 0);
    const sy = pts.reduce((s, p) => s + p.cost, 0);
    const sxx = pts.reduce((s, p) => s + p.len * p.len, 0);
    const sxy = pts.reduce((s, p) => s + p.len * p.cost, 0);
    const denom = n * sxx - sx * sx;
    if (denom === 0) {
        const rate = sy / sx;
        return (l: number) => Math.max(0, Math.round(rate * l));
    }
    const b = (n * sxy - sx * sy) / denom;
    const a = (sy - b * sx) / n;
    return (l: number) => Math.max(0, Math.round(a + b * l));
}

export function calculatePricing(
    modules: ModuleConfig[],
    partsData: any[],
    settings: Settings,
    hasWheels: boolean = false
): PricingResult {
    const derivedParts = generateParts(modules);
    let productCost = 0; // marginable_cost
    const bom: Record<string, BOMItem> = {};

    const addObjToBom = (sku: string, name: string, costARS: number, qty: number) => {
        if (!bom[sku]) {
            bom[sku] = { name, quantity: 0, unitCostARS: costARS, totalCostARS: 0 };
        }
        bom[sku].quantity += qty;
        bom[sku].totalCostARS = bom[sku].quantity * costARS;
        productCost += costARS * qty;
    };

    const getCostARS = (part: any) => {
        if (part.price_ars) return part.price_ars;
        if (part.price_usd) return part.price_usd * settings.usd_exchange_rate;
        return 0;
    };

    let tubesCount = 0;
    let acrylicPanelsCount = 0;
    let feetCount = 0;

    const moduleMaterial = modules[0]?.material || 'steel';
    const tubeCostFor = buildTubeCostModel(partsData, settings.usd_exchange_rate);

    derivedParts.forEach(part => {
        let match: any | undefined;

        if (part.type === 'ball') {
            if (part.hasFoot) feetCount++;
            match = partsData.find(p => p.sku === 'bola' || p.type === 'ball' || p.type === 'node');
        } else if (part.type === 'tube') {
            tubesCount++;
            const len = part.length ?? 0;
            // Special acrylic 750mm tube only for the X axis (width). Y/Z and other lengths use steel tubes.
            const isAcrylicWidth750 = moduleMaterial === 'acrylic' && part.orientation === 'x' && len === 750;
            if (isAcrylicWidth750) {
                match = partsData.find(p => p.type === 'tube' && p.dimensions?.material === 'acrylic' && p.dimensions?.length === 750);
            } else {
                // Prefer an exact catalog SKU (honours real prices for 350/500/750…).
                const exact = partsData.find(p => p.type === 'tube' && !p.dimensions?.material && p.dimensions?.length === len)
                    || partsData.find(p => p.type === 'tube' && p.sku === `tube-${len}`);
                if (exact) {
                    match = exact;
                } else {
                    // No hay SKU para este largo (p.ej. 400mm): interpolar $/mm
                    // desde el catálogo en vez de cobrar $0 en silencio.
                    addObjToBom(`tube-${len}`, `Caño ${len}mm`, tubeCostFor(len), 1);
                    return;
                }
            }
        } else if (part.type === 'panel') {
            if (part.material === 'acrylic') acrylicPanelsCount++;
            if (part.dimensions) {
                const { width, height } = part.dimensions;
                match = partsData.find(p =>
                    p.type === 'panel' &&
                    (p.dimensions?.material || 'steel') === part.material &&
                    ((p.dimensions?.width === width && p.dimensions?.height === height) ||
                        (p.dimensions?.width === height && p.dimensions?.height === width))
                );
            }
        }

        if (match) {
            const cost = getCostARS(match);
            if (part.type === 'panel' && part.cableHole) {
                // Chapa pasacable: mismo precio que la standard, línea propia en el BOM
                // para que fabricación sepa que lleva el agujero.
                addObjToBom(`${match.sku || match.id}-pasacable`, `${match.name || match.type} c/ pasacable`, cost, 1);
            } else {
                addObjToBom(match.sku || match.id, match.name || match.type, cost, 1);
            }
        }
    });

    // ADD IMPLICIT/FIXED PARTS
    if (tubesCount > 0) {
        const connMatch = partsData.find(p => p.sku === 'CONN-INT' || p.type === 'connector' || p.name?.toLowerCase().includes('conector'));
        if (connMatch) addObjToBom(connMatch.sku || connMatch.id, connMatch.name || 'Conector Interno', getCostARS(connMatch), tubesCount * 2);
    }

    if (acrylicPanelsCount > 0) {
        const suppMatch = partsData.find(p => p.sku === 'soporte' || p.name?.toLowerCase().includes('soport'));
        if (suppMatch) addObjToBom(suppMatch.sku || suppMatch.id, suppMatch.name || 'Soporte Acrílico', getCostARS(suppMatch), acrylicPanelsCount * 4);
    }

    if (feetCount > 0) {
        if (hasWheels) {
            // Preferir el SKU exacto: en el catálogo también existe Rueda-freno y el
            // fallback por nombre podría agarrarla según el orden de la DB.
            const wheelMatch = partsData.find(p => p.sku === 'rueda-normal')
                || partsData.find(p => p.type?.toLowerCase().includes('rueda') || p.name?.toLowerCase().includes('rueda'));
            if (wheelMatch) addObjToBom(wheelMatch.sku || wheelMatch.id, wheelMatch.name || 'Rueda', getCostARS(wheelMatch), feetCount);
        } else {
            const footMatch = partsData.find(p => p.sku === 'pata-plastico' || p.type?.toLowerCase().includes('pata'));
            if (footMatch) addObjToBom(footMatch.sku || footMatch.id, footMatch.name || 'Pata', getCostARS(footMatch), feetCount);
        }
    }

    const packingPart = partsData.find(p => p.sku === 'embalaje');
    if (packingPart) addObjToBom(packingPart.sku, packingPart.name, getCostARS(packingPart), 1);

    // Mano de obra: fija por mueble, igual que el embalaje (lista maestra v5).
    const laborPart = partsData.find(p => p.sku === 'mano-obra');
    if (laborPart) addObjToBom(laborPart.sku, laborPart.name, getCostARS(laborPart), 1);

    // NEW FORMULA CONSTANTS
    const shipping_cost = settings.shipping_cost || 0;
    const materialMargin = moduleMaterial === 'acrylic' ? settings.margin_acrylic_percent : settings.margin_steel_percent;
    const target_margin_percent = materialMargin || settings.target_margin_percent || settings.profit_margin || 65;
    const transaction_fee_percent = settings.transaction_fee_percent || 2.5;
    const transaction_fee_iva_percent = settings.transaction_fee_iva_percent || 21;
    const installments_6_percent = settings.installments_6_percent || 13;
    const iva_percent = settings.iva_percent || 21;

    // Calculations
    const transaction_fee_real = transaction_fee_percent * (1 + transaction_fee_iva_percent / 100);
    const installment_fee = installments_6_percent * (1 + iva_percent / 100);
    const total_fee_percent = transaction_fee_real + installment_fee;

    const base_price = Math.round(productCost / (1 - target_margin_percent / 100));
    const price_plus_shipping = base_price + shipping_cost;
    const final_price = Math.round(price_plus_shipping / (1 - total_fee_percent / 100));

    const real_revenue = Math.round(final_price * (1 - total_fee_percent / 100));
    const gross_profit = real_revenue - productCost - shipping_cost;

    const roas_break_even = gross_profit > 0 ? (final_price / gross_profit) : 0;
    const desired_profit = gross_profit * 0.7;
    const roas_target = desired_profit > 0 ? (final_price / desired_profit) : 0;

    return {
        totalCost: productCost,
        totalPrice: final_price,
        bomSummary: bom,
        metrics: {
            basePrice: base_price,
            grossProfit: gross_profit,
            realRevenue: real_revenue,
            roasBreakEven: roas_break_even,
            roasTarget: roas_target
        },
        breakdown: {
            productCost,
            marginPercent: target_margin_percent,
            basePrice: base_price,
            shippingCost: shipping_cost,
            pricePlusShipping: price_plus_shipping,
            feePercent: total_fee_percent,
            transactionFeePercent: transaction_fee_real,
            installmentFeePercent: installment_fee,
            finalPrice: final_price,
        }
    };
}
