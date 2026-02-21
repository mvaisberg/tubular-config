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
}

export function calculatePricing(
    modules: ModuleConfig[],
    partsData: any[],
    settings: Settings
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

    derivedParts.forEach(part => {
        let match: any | undefined;

        if (part.type === 'ball') {
            match = partsData.find(p => p.sku === 'bola' || p.type === 'ball' || p.type === 'node');
        } else if (part.type === 'tube') {
            tubesCount++;
            match = partsData.find(p => p.type === 'tube' && p.dimensions?.length === part.length);
        } else if (part.type === 'panel') {
            if (part.material === 'acrylic') acrylicPanelsCount++;
            if (part.dimensions) {
                const { width, height } = part.dimensions;
                match = partsData.find(p =>
                    p.type === 'panel' &&
                    ((p.dimensions?.width === width && p.dimensions?.height === height) ||
                        (p.dimensions?.width === height && p.dimensions?.height === width))
                );
            }
        }

        if (match) {
            const cost = getCostARS(match);
            addObjToBom(match.sku || match.id, match.name || match.type, cost, 1);
        }
    });

    // ADD IMPLICIT/FIXED PARTS
    if (tubesCount > 0) {
        const connMatch = partsData.find(p => p.type?.toLowerCase().includes('conect') || p.sku === 'CONN-INT');
        if (connMatch) addObjToBom(connMatch.sku || connMatch.id, connMatch.name || 'Conector Interno', getCostARS(connMatch), tubesCount * 2);
    }

    if (acrylicPanelsCount > 0) {
        const suppMatch = partsData.find(p => p.type?.toLowerCase().includes('soport'));
        if (suppMatch) addObjToBom(suppMatch.sku || suppMatch.id, suppMatch.name || 'Soporte Acrílico', getCostARS(suppMatch), acrylicPanelsCount * 4);
    }

    const packingPart = partsData.find(p => p.sku === 'embalaje');
    if (packingPart) addObjToBom(packingPart.sku, packingPart.name, getCostARS(packingPart), 1);

    // NEW FORMULA CONSTANTS
    const shipping_cost = settings.shipping_cost || 0;
    const target_margin_percent = settings.target_margin_percent || settings.profit_margin || 65;
    const transaction_fee_percent = settings.transaction_fee_percent || 2.5;
    const transaction_fee_iva_percent = settings.transaction_fee_iva_percent || 21;
    const installments_6_percent = settings.installments_6_percent || 13;
    const iva_percent = settings.iva_percent || 21;

    // Calculations
    const transaction_fee_real = transaction_fee_percent * (1 + transaction_fee_iva_percent / 100);
    const installment_fee = installments_6_percent * (1 + iva_percent / 100);
    const total_fee_percent = transaction_fee_real + installment_fee;

    const base_price = productCost / (1 - target_margin_percent / 100);
    const price_plus_shipping = base_price + shipping_cost;
    const final_price = price_plus_shipping / (1 - total_fee_percent / 100);

    const real_revenue = final_price * (1 - total_fee_percent / 100);
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
        }
    };
}
