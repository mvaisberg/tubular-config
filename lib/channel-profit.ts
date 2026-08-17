/**
 * Análisis de rentabilidad por canal de venta (lista facturada vs efectivo).
 *
 * Modela la carga impositiva real de una venta facturada para un RI:
 *   - IVA débito 21/121 del precio final
 *   - Crédito fiscal según qué compras tienen factura (fracción por pieza)
 *   - Crédito por el IVA de los fees de tarjeta/cuotas
 *   - IIBB sobre el neto sin IVA (criterio asumido — confirmar con contador)
 * La venta en efectivo/transferencia no lleva fees ni impuestos.
 */
import type { PricingResult } from "@/lib/pricing";

export const IVA = 0.21;
export const IIBB_RATE = 0.035;
export const CASH_FACTOR = 0.8;
/** Comisión de cobro del canal efectivo/transferencia (costo de cobrar). */
export const CASH_FEE_RATE = 0.03;

/** Fracción del costo de cada pieza que viene CON factura (genera crédito fiscal). */
export function creditableFraction(sku: string): number {
    const s = (sku || "").toLowerCase();
    if (s.startsWith("panel-acrilico")) return 1;      // acrílicos: factura completa
    if (s === "bola") return 0.5;                       // bolas cromadas: medio IVA
    if (s === "soporte") return 0.5;                    // soportes: medio IVA
    if (s === "conn-int") return 0.5;                   // conectores (tornillo expansor): medio IVA
    if (s.startsWith("tube")) return 0.25;              // caños: factura por 1/4
    return 0;                                           // chapas acero, patas, ruedas, embalaje, mano de obra: sin factura
}

const ivaIncl = (finalPrice: number) => finalPrice * IVA / (1 + IVA);

export interface ChannelAnalysis {
    price: number;
    fees: number;
    feesNet: number;
    feesIva: number;
    ivaDebit: number;
    ivaCreditPurchases: number;
    ivaCreditFees: number;
    ivaToPay: number;
    iibb: number;
    materials: number;
    shipping: number;
    profit: number;
    profitPct: number; // sobre la venta
}

export interface ProfitComparison {
    lista: ChannelAnalysis;
    efectivo: ChannelAnalysis;
    creditableBase: number; // compras con factura (IVA incluido)
}

export function analyzeChannels(pricing: PricingResult, settings: {
    transaction_fee_percent?: number;
    installments_6_percent?: number;
    shipping_cost?: number;
}, priceOverride?: number): ProfitComparison {
    // priceOverride: precio real de venta (ej. el publicado en Woo para un SKU
    // de catálogo) cuando difiere del que calcularía el configurador.
    const P = priceOverride ?? pricing.totalPrice;
    const C = pricing.totalCost;
    const S = settings.shipping_cost ?? 0;

    // Compras con factura según el BOM (los costos de parts ya incluyen IVA).
    let creditableBase = 0;
    for (const [sku, item] of Object.entries(pricing.bomSummary)) {
        creditableBase += item.totalCostARS * creditableFraction(sku);
    }

    const feePctNet = ((settings.transaction_fee_percent ?? 2.5) + (settings.installments_6_percent ?? 11)) / 100;
    const feesNet = P * feePctNet;
    const feesIva = feesNet * IVA;

    const ivaDebit = ivaIncl(P);
    const ivaCreditPurchases = ivaIncl(creditableBase);
    const ivaCreditFees = feesIva; // RI: el IVA de los fees es crédito
    const ivaToPay = Math.max(0, ivaDebit - ivaCreditPurchases - ivaCreditFees);
    const iibb = (P / (1 + IVA)) * IIBB_RATE;

    const listaProfit = P - (feesNet + feesIva) - ivaToPay - iibb - C - S;
    const lista: ChannelAnalysis = {
        price: P, fees: feesNet + feesIva, feesNet, feesIva,
        ivaDebit, ivaCreditPurchases, ivaCreditFees, ivaToPay, iibb,
        materials: C, shipping: S,
        profit: listaProfit, profitPct: P ? listaProfit / P : 0,
    };

    const E = P * CASH_FACTOR;
    const cashFees = E * CASH_FEE_RATE;
    const cashProfit = E - cashFees - C - S;
    const efectivo: ChannelAnalysis = {
        price: E, fees: cashFees, feesNet: cashFees, feesIva: 0,
        ivaDebit: 0, ivaCreditPurchases: 0, ivaCreditFees: 0, ivaToPay: 0, iibb: 0,
        materials: C, shipping: S,
        profit: cashProfit, profitPct: E ? cashProfit / E : 0,
    };

    return { lista, efectivo, creditableBase };
}
