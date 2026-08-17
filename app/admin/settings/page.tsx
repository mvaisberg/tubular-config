"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Save, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

interface FixedCost {
    id: string;
    name: string;
    amount: number;
}

export default function SettingsPage() {
    const supabase = createClient();

    const [usdExchangeRate, setUsdExchangeRate] = useState<string>("0");
    const [shippingCost, setShippingCost] = useState<string>("20000");
    const [marginSteelPercent, setMarginSteelPercent] = useState<string>("70");
    const [marginAcrylicPercent, setMarginAcrylicPercent] = useState<string>("70");
    const [transactionFeePercent, setTransactionFeePercent] = useState<string>("2.5");
    const [transactionFeeIvaPercent, setTransactionFeeIvaPercent] = useState<string>("21");
    const [installments6Percent, setInstallments6Percent] = useState<string>("13");
    const [ivaPercent, setIvaPercent] = useState<string>("21");
    const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>("");

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data: settings } = await supabase
                .from("settings").select("*").eq("id", 1).single();

            if (settings) {
                setUsdExchangeRate(settings.usd_exchange_rate?.toString() || "0");
                setShippingCost(settings.shipping_cost?.toString() || "20000");
                setMarginSteelPercent((settings.margin_steel_percent ?? settings.target_margin_percent)?.toString() || "70");
                setMarginAcrylicPercent((settings.margin_acrylic_percent ?? settings.target_margin_percent)?.toString() || "70");
                setTransactionFeePercent(settings.transaction_fee_percent?.toString() || "2.5");
                setTransactionFeeIvaPercent(settings.transaction_fee_iva_percent?.toString() || "21");
                setInstallments6Percent(settings.installments_6_percent?.toString() || "13");
                setIvaPercent(settings.iva_percent?.toString() || "21");
                if (settings.last_updated) {
                    setLastUpdated(new Date(settings.last_updated).toLocaleString("es-AR"));
                }
            }

            const { data: costs } = await supabase.from("fixed_costs").select("*").order("created_at", { ascending: true });
            if (costs) setFixedCosts(costs);
        } catch (err) {
            console.error("Error fetching settings:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSaveSettings = async () => {
        setSaving(true);
        const updates = {
            usd_exchange_rate: parseFloat(usdExchangeRate),
            shipping_cost: parseFloat(shippingCost),
            margin_steel_percent: parseFloat(marginSteelPercent),
            margin_acrylic_percent: parseFloat(marginAcrylicPercent),
            transaction_fee_percent: parseFloat(transactionFeePercent),
            transaction_fee_iva_percent: parseFloat(transactionFeeIvaPercent),
            installments_6_percent: parseFloat(installments6Percent),
            iva_percent: parseFloat(ivaPercent),
            last_updated: new Date().toISOString(),
        };

        const { error } = await supabase.from("settings").update(updates).eq("id", 1);

        if (error) alert("Error al guardar");
        else fetchSettings();

        setSaving(false);
    };

    const addFixedCost = async () => {
        const { data } = await supabase.from("fixed_costs").insert({ name: "Nuevo costo", amount: 0 }).select().single();
        if (data) setFixedCosts([...fixedCosts, data]);
    };

    // Ref siempre con el estado más reciente, para guardar el valor final en onBlur.
    const fixedCostsRef = useRef<FixedCost[]>(fixedCosts);
    fixedCostsRef.current = fixedCosts;

    // Actualiza SOLO el estado local (inmediato, sin lag). Forma funcional para no
    // pisar tipeos rápidos. La persistencia va aparte, en saveFixedCost (onBlur).
    const updateFixedCost = (id: string, updates: Partial<FixedCost>) => {
        setFixedCosts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const saveFixedCost = async (id: string) => {
        const c = fixedCostsRef.current.find(x => x.id === id);
        if (!c) return;
        // IMPORTANTE: hay que await, si no la query de Supabase (lazy) nunca se ejecuta.
        const { error } = await supabase
            .from("fixed_costs")
            .update({ name: c.name, amount: c.amount })
            .eq("id", id);
        if (error) alert("No se pudo guardar el costo: " + error.message);
    };

    const deleteFixedCost = async (id: string) => {
        await supabase.from("fixed_costs").delete().eq("id", id);
        setFixedCosts(fixedCosts.filter(c => c.id !== id));
    };

    const inputCls = "w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors tabular-nums";
    const labelCls = "text-xs font-medium text-gray-700 mb-1.5 block";

    if (loading) {
        return <div className="text-sm text-gray-500 animate-pulse">Cargando…</div>;
    }

    return (
        <div className="space-y-6 pb-32">
            <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Configuración</h1>
                    <p className="text-sm text-gray-500 mt-1">Variables y costos estratégicos</p>
                </div>
                {lastUpdated && (
                    <div className="text-xs text-gray-500">
                        Última actualización: <span className="font-medium text-gray-700">{lastUpdated}</span>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Divisas */}
                <section className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-sm font-semibold text-gray-900 mb-4">Divisas</h2>
                    <div>
                        <label className={labelCls}>Tipo de cambio fijo (USD → ARS)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                                type="number"
                                value={usdExchangeRate}
                                onChange={e => setUsdExchangeRate(e.target.value)}
                                className={inputCls + " pl-7"}
                            />
                        </div>
                    </div>
                </section>

                {/* Logística y margen */}
                <section className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-sm font-semibold text-gray-900 mb-4">Logística y margen</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls}>Envío ($)</label>
                            <input type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Margen acero (%)</label>
                            <input type="number" value={marginSteelPercent} onChange={e => setMarginSteelPercent(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Margen acrílico (%)</label>
                            <input type="number" value={marginAcrylicPercent} onChange={e => setMarginAcrylicPercent(e.target.value)} className={inputCls} />
                        </div>
                    </div>
                </section>

                {/* Comisiones e impuestos */}
                <section className="bg-white border border-gray-200 rounded-lg p-6 lg:col-span-2">
                    <h2 className="text-sm font-semibold text-gray-900 mb-4">Comisiones e impuestos</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className={labelCls}>Com. transac. (%)</label>
                            <input type="number" step="0.01" value={transactionFeePercent} onChange={e => setTransactionFeePercent(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>IVA s/ comis. (%)</label>
                            <input type="number" value={transactionFeeIvaPercent} onChange={e => setTransactionFeeIvaPercent(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Interés 6 cuotas (%)</label>
                            <input type="number" value={installments6Percent} onChange={e => setInstallments6Percent(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>IVA gral. (%)</label>
                            <input type="number" value={ivaPercent} onChange={e => setIvaPercent(e.target.value)} className={inputCls} />
                        </div>
                    </div>
                </section>

                {/* Costos fijos */}
                <section className="bg-white border border-gray-200 rounded-lg p-6 lg:col-span-2">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-sm font-semibold text-gray-900">Estructura de costos fijos</h2>
                        <button
                            onClick={addFixedCost}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        >
                            <Plus size={13} /> Añadir
                        </button>
                    </div>

                    {fixedCosts.length === 0 ? (
                        <p className="text-sm text-gray-400 italic py-6 text-center">Sin costos cargados.</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {fixedCosts.map(cost => (
                                <div key={cost.id} className="flex items-center gap-2 py-2">
                                    <input
                                        type="text" value={cost.name}
                                        onChange={e => updateFixedCost(cost.id, { name: e.target.value })}
                                        onBlur={() => saveFixedCost(cost.id)}
                                        className="flex-1 bg-transparent px-2 py-1.5 text-sm font-medium text-gray-900 border-b border-transparent focus:border-indigo-500 focus:outline-none"
                                        placeholder="Concepto"
                                    />
                                    <div className="relative w-40">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                        <input
                                            type="number" value={cost.amount}
                                            onChange={e => updateFixedCost(cost.id, { amount: parseFloat(e.target.value) || 0 })}
                                            onBlur={() => saveFixedCost(cost.id)}
                                            className="w-full pl-7 pr-2 py-1.5 text-sm text-right tabular-nums border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                    </div>
                                    <button
                                        onClick={() => deleteFixedCost(cost.id)}
                                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-2">
                                <span className="text-xs font-medium text-gray-500">Total gastos</span>
                                <span className="text-lg font-semibold text-gray-900 tabular-nums">
                                    ${fixedCosts.reduce((acc, c) => acc + c.amount, 0).toLocaleString("es-AR")}
                                </span>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white text-sm font-medium rounded-md shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                    {saving ? <RefreshCw className="animate-spin" size={15} /> : <Save size={15} />}
                    {saving ? "Guardando…" : "Guardar cambios"}
                </button>
            </div>
        </div>
    );
}
