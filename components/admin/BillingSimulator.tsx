"use client";

// Simulador de facturación mensual hipotética (solo admin — vive en /admin/parts).
// 4 cuadrantes (acrílico/acero × tarjeta/efectivo): de una facturación estimada
// deriva materiales, impuestos, fees y fijos con los valores actuales de Settings.

import { useState } from "react";
import type { Settings } from "@/lib/pricing";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

// Fracción del costo de materiales que viene CON factura (crédito de IVA),
// promedio ponderado del catálogo real (calculado sobre los BOM, ago-2026).
const CRED_SHARE: Record<"steel" | "acrylic", number> = { steel: 0.174, acrylic: 0.523 };
const IVA = 0.21, IIBB = 0.035, CASH_FEE = 0.03, CASH_FACTOR = 0.8;

interface SimQuadrant { material: "steel" | "acrylic"; channel: "lista" | "efectivo"; rev: number }

function simulateQuadrant(q: SimQuadrant, s: Settings, avgTicket: number) {
    const margin = (q.material === "acrylic"
        ? s.margin_acrylic_percent
        : s.margin_steel_percent) ?? s.target_margin_percent ?? 70;
    const feeNetPct = ((s.transaction_fee_percent ?? 2.5) + (s.installments_6_percent ?? 11)) / 100;
    const feeTotPct = feeNetPct * (1 + IVA);
    const ship = s.shipping_cost ?? 20000;

    const n = avgTicket > 0 ? q.rev / avgTicket : 0; // ventas estimadas
    const envio = n * ship;
    // Precio de lista equivalente (el efectivo ya tiene el 20% off aplicado).
    const P = q.channel === "lista" ? q.rev : q.rev / CASH_FACTOR;
    // Inversa de la fórmula de precios: C = (P·(1−fees) − n·envío)·(1−margen)
    const materials = Math.max(0, (P * (1 - feeTotPct) - envio) * (1 - margin / 100));

    let feesCard = 0, ivaPay = 0, iibb = 0, cashFee = 0;
    if (q.channel === "lista") {
        const feesNet = q.rev * feeNetPct;
        const feesIva = feesNet * IVA;
        feesCard = feesNet + feesIva;
        const ivaDebit = q.rev * IVA / (1 + IVA);
        const ivaCred = (materials * CRED_SHARE[q.material]) * IVA / (1 + IVA);
        ivaPay = Math.max(0, ivaDebit - ivaCred - feesIva);
        iibb = (q.rev / (1 + IVA)) * IIBB;
    } else {
        cashFee = q.rev * CASH_FEE;
    }
    const variable = materials + envio + feesCard + ivaPay + iibb + cashFee;
    return { materials, envio, feesCard, ivaPay, iibb, cashFee, variable, contribution: q.rev - variable, n };
}

export default function BillingSimulator({ settings, fixedCosts }: {
    settings: Settings;
    fixedCosts: { id: string; name: string; amount: number }[];
}) {
    const [simAcrLista, setSimAcrLista] = useState("");
    const [simAcrEfectivo, setSimAcrEfectivo] = useState("");
    const [simSteelLista, setSimSteelLista] = useState("");
    const [simSteelEfectivo, setSimSteelEfectivo] = useState("");
    const [simTicket, setSimTicket] = useState("1500000");

    const num = (s: string) => parseFloat(s) || 0;
    // Formato es-AR con separador de miles mientras se tipea; el estado guarda solo dígitos.
    const fmtIn = (s: string) => (s ? Number(s).toLocaleString("es-AR") : "");
    const parseIn = (v: string) => v.replace(/\D/g, "");
    const ticket = num(simTicket) || 1500000;

    const quadrants: { key: string; label: string; sub: string; value: string; set: (v: string) => void; q: SimQuadrant }[] = [
        { key: "al", label: "Acrílico · Tarjeta", sub: "facturado a lista", value: simAcrLista, set: setSimAcrLista, q: { material: "acrylic", channel: "lista", rev: num(simAcrLista) } },
        { key: "ae", label: "Acrílico · Efectivo/Transf.", sub: "con 20% off aplicado", value: simAcrEfectivo, set: setSimAcrEfectivo, q: { material: "acrylic", channel: "efectivo", rev: num(simAcrEfectivo) } },
        { key: "sl", label: "Acero · Tarjeta", sub: "facturado a lista", value: simSteelLista, set: setSimSteelLista, q: { material: "steel", channel: "lista", rev: num(simSteelLista) } },
        { key: "se", label: "Acero · Efectivo/Transf.", sub: "con 20% off aplicado", value: simSteelEfectivo, set: setSimSteelEfectivo, q: { material: "steel", channel: "efectivo", rev: num(simSteelEfectivo) } },
    ];
    const results = quadrants.map(c => ({ ...c, r: simulateQuadrant(c.q, settings, ticket) }));
    const totRev = results.reduce((a, c) => a + c.q.rev, 0);
    const sum = (f: (r: ReturnType<typeof simulateQuadrant>) => number) => results.reduce((a, c) => a + f(c.r), 0);
    const materials = sum(r => r.materials), envio = sum(r => r.envio), feesCard = sum(r => r.feesCard),
        ivaPay = sum(r => r.ivaPay), iibb = sum(r => r.iibb), cashFee = sum(r => r.cashFee);
    const variable = sum(r => r.variable);
    const contribution = totRev - variable;
    const fixedMonthly = fixedCosts.reduce((a, c) => a + (Number(c.amount) || 0), 0);
    const simResult = contribution - fixedMonthly;

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map(c => (
                    <div key={c.key} className="border border-gray-200 rounded-lg p-3">
                        <div className="text-xs font-semibold text-gray-800">{c.label}</div>
                        <div className="text-[10px] text-gray-400 mb-1.5">{c.sub}</div>
                        <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={fmtIn(c.value)}
                                onChange={e => c.set(parseIn(e.target.value))}
                                placeholder="0"
                                className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                        </div>
                        {c.q.rev > 0 && (
                            <div className="mt-1.5 flex justify-between text-[11px]">
                                <span className="text-gray-400">te queda (antes de fijos)</span>
                                <span className="font-semibold tabular-nums text-gray-700">
                                    {fmt(c.r.contribution)} ({c.q.rev ? Math.round(c.r.contribution / c.q.rev * 100) : 0}%)
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                Ticket promedio para estimar envíos:
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={fmtIn(simTicket)}
                        onChange={e => setSimTicket(parseIn(e.target.value))}
                        className="w-28 pl-5 pr-1 py-0.5 border border-gray-200 rounded-md tabular-nums"
                    />
                </div>
                {totRev > 0 && <span>≈ {Math.round(totRev / ticket)} ventas</span>}
            </div>

            {totRev > 0 && (
                <div className="mt-3">
                    <Row label="FACTURACIÓN SIMULADA" value={fmt(totRev)} bold big />
                    <div className="pl-3 border-l-2 border-gray-100 my-1">
                        <Row label="Materiales (según margen por material)" value={"−" + fmt(materials)} />
                        <Row label="Envíos" value={"−" + fmt(envio)} />
                        {feesCard > 0 && <Row label="Fees tarjeta + cuotas" value={"−" + fmt(feesCard)} />}
                        {ivaPay > 0 && <Row label="IVA a pagar (débito − créditos)" value={"−" + fmt(ivaPay)} />}
                        {iibb > 0 && <Row label="IIBB 3,5%" value={"−" + fmt(iibb)} />}
                        {cashFee > 0 && <Row label="Comisión de cobro 3% (efectivo)" value={"−" + fmt(cashFee)} />}
                        <Row label="Total costos variables" value={"−" + fmt(variable)} bold />
                    </div>
                    <Row
                        label={`MARGEN DE CONTRIBUCIÓN  (${totRev ? Math.round(contribution / totRev * 100) : 0}%)`}
                        value={fmt(contribution)} bold accent="text-indigo-700"
                    />
                    <Row label="Costos fijos (1 mes, estructura del manager)" value={"−" + fmt(fixedMonthly)} />
                    <Row
                        label={`RESULTADO SIMULADO  (${totRev ? Math.round(simResult / totRev * 100) : 0}%)`}
                        value={fmt(simResult)} bold big
                        accent={simResult >= 0 ? "text-emerald-700" : "text-red-600"}
                    />
                    <p className="mt-1.5 text-[10px] text-gray-400">
                        Materiales estimados invirtiendo la fórmula de precios (margen acero {settings.margin_steel_percent ?? settings.target_margin_percent}% ·
                        acrílico {settings.margin_acrylic_percent ?? settings.target_margin_percent}%). Crédito de IVA: {Math.round(CRED_SHARE.steel * 100)}% del
                        material de acero y {Math.round(CRED_SHARE.acrylic * 100)}% del acrílico tienen factura (promedio del catálogo).
                    </p>
                </div>
            )}
        </div>
    );
}

function Row({ label, value, bold, big, accent }: { label: string; value: string; bold?: boolean; big?: boolean; accent?: string }) {
    return (
        <div className="flex justify-between items-baseline gap-3 py-1">
            <span className={`${big ? "text-sm" : "text-xs"} ${bold ? "font-semibold text-gray-800" : "text-gray-500"}`}>{label}</span>
            <span className={`${big ? "text-base" : "text-xs"} tabular-nums whitespace-nowrap ${bold ? "font-bold" : "text-gray-700"} ${accent ?? ""}`}>{value}</span>
        </div>
    );
}
