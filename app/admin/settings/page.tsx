"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Save, RefreshCw, Calculator, Truck, Percent, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

interface FixedCost {
    id: string;
    name: string;
    amount: number;
}

export default function SettingsPage() {
    const supabase = createClient();

    // Currency Settings
    const [usdOfficial, setUsdOfficial] = useState<string>("0");
    const [usdExchangeRate, setUsdExchangeRate] = useState<string>("0");

    // Pricing Variables
    const [shippingCost, setShippingCost] = useState<string>("20000");
    const [targetMarginPercent, setTargetMarginPercent] = useState<string>("65");
    const [transactionFeePercent, setTransactionFeePercent] = useState<string>("2.5");
    const [transactionFeeIvaPercent, setTransactionFeeIvaPercent] = useState<string>("21");
    const [installments6Percent, setInstallments6Percent] = useState<string>("13");
    const [ivaPercent, setIvaPercent] = useState<string>("21");

    // Fixed Costs
    const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>("");

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data: settings, error: settingsError } = await supabase
                .from("settings")
                .select("*")
                .eq("id", 1)
                .single();

            if (settings) {
                setUsdOfficial(settings.usd_official?.toString() || "0");
                setUsdExchangeRate(settings.usd_exchange_rate?.toString() || "0");
                setShippingCost(settings.shipping_cost?.toString() || "20000");
                setTargetMarginPercent(settings.target_margin_percent?.toString() || "65");
                setTransactionFeePercent(settings.transaction_fee_percent?.toString() || "2.5");
                setTransactionFeeIvaPercent(settings.transaction_fee_iva_percent?.toString() || "21");
                setInstallments6Percent(settings.installments_6_percent?.toString() || "13");
                setIvaPercent(settings.iva_percent?.toString() || "21");

                if (settings.last_updated) {
                    setLastUpdated(new Date(settings.last_updated).toLocaleString("es-AR"));
                }
            }

            const { data: costs, error: costsError } = await supabase
                .from("fixed_costs")
                .select("*")
                .order('created_at', { ascending: true });

            if (costs) {
                setFixedCosts(costs);
            }
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
            usd_official: parseFloat(usdOfficial),
            usd_exchange_rate: parseFloat(usdExchangeRate),
            shipping_cost: parseFloat(shippingCost),
            target_margin_percent: parseFloat(targetMarginPercent),
            transaction_fee_percent: parseFloat(transactionFeePercent),
            transaction_fee_iva_percent: parseFloat(transactionFeeIvaPercent),
            installments_6_percent: parseFloat(installments6Percent),
            iva_percent: parseFloat(ivaPercent),
            last_updated: new Date().toISOString()
        };

        const { error } = await supabase
            .from("settings")
            .update(updates)
            .eq("id", 1);

        if (error) {
            alert("Error al guardar la configuración");
        } else {
            alert("Configuración guardada");
            fetchSettings();
        }
        setSaving(false);
    };

    const handleSyncUsd = async () => {
        setSyncing(true);
        try {
            const response = await fetch("https://dolarapi.com/v1/dolares/oficial");
            const result = await response.json();
            const official = result.venta;
            if (official) {
                const applied = official * 1.03;
                setUsdOfficial(official.toFixed(2));
                setUsdExchangeRate(applied.toFixed(2));

                await supabase.from("settings").update({
                    usd_official: official,
                    usd_exchange_rate: applied,
                    last_updated: new Date().toISOString()
                }).eq("id", 1);

                fetchSettings();
            }
        } catch (error) {
            alert("Error sincronizando dólar");
        }
        setSyncing(false);
    };

    const addFixedCost = async () => {
        const newCost = { name: "NUEVO COSTO", amount: 0 };
        const { data, error } = await supabase.from("fixed_costs").insert(newCost).select().single();
        if (data) setFixedCosts([...fixedCosts, data]);
    };

    const updateFixedCost = async (id: string, updates: Partial<FixedCost>) => {
        await supabase.from("fixed_costs").update(updates).eq("id", id);
        setFixedCosts(fixedCosts.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const deleteFixedCost = async (id: string) => {
        await supabase.from("fixed_costs").delete().eq("id", id);
        setFixedCosts(fixedCosts.filter(c => c.id !== id));
    };

    if (loading) return <div className="p-12 text-black font-black uppercase tracking-[0.2em] animate-pulse">Cargando...</div>;

    return (
        <div className="max-w-6xl space-y-8 pb-32">
            <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-black pb-4 gap-4">
                <div>
                    <h1 className="text-4xl font-black text-black tracking-tight uppercase">Configuración</h1>
                    <p className="text-black/60 text-xs font-bold uppercase tracking-widest mt-1">Variables y Costos Estratégicos</p>
                </div>
                <div className="text-left md:text-right border-l-2 border-black pl-4">
                    <p className="text-[10px] font-black text-black/50 uppercase tracking-[0.2em]">Última Actualización</p>
                    <p className="text-sm font-black text-black uppercase">{lastUpdated || "NUNCA"}</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* DIVISAS */}
                <section className="bg-white border border-black p-6 md:p-8 relative group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-black scale-y-0 group-hover:scale-y-100 transition-transform origin-top z-10"></div>
                    <div className="flex justify-between items-center mb-6 border-b border-black pb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black text-black uppercase tracking-tight">Divisas</h2>
                        </div>
                        <button
                            onClick={handleSyncUsd}
                            disabled={syncing}
                            className="bg-black text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                            {syncing ? "SYNC..." : "SYNC DÓLAR"}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2 group/input">
                            <label className="text-[10px] font-black text-black uppercase tracking-widest transition-colors group-focus-within/input:text-blue-600">Dólar Oficial (Venta)</label>
                            <div className="relative border border-black group-focus-within/input:border-blue-600 transition-colors bg-white">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={14} strokeWidth={2.5} />
                                <input
                                    type="number" value={usdOfficial} onChange={e => setUsdOfficial(e.target.value)}
                                    className="w-full pl-8 pr-4 py-3 bg-transparent font-black text-black focus:outline-none rounded-none text-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-2 group/input">
                            <label className="text-[10px] font-black text-black uppercase tracking-widest transition-colors group-focus-within/input:text-blue-600">Dólar Aplicado (+Mgn)</label>
                            <div className="relative border border-black group-focus-within/input:border-blue-600 transition-colors bg-white">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={14} strokeWidth={2.5} />
                                <input
                                    type="number" value={usdExchangeRate} onChange={e => setUsdExchangeRate(e.target.value)}
                                    className="w-full pl-8 pr-4 py-3 bg-transparent font-black text-black focus:outline-none rounded-none text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* LOGISTICA Y MARGEN */}
                <section className="bg-white border border-black p-6 md:p-8 relative group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-black scale-y-0 group-hover:scale-y-100 transition-transform origin-top z-10"></div>
                    <div className="flex items-center gap-3 mb-6 border-b border-black pb-4">
                        <h2 className="text-xl font-black text-black uppercase tracking-tight">Logística y Margen</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2 group/input">
                            <label className="text-[10px] font-black text-black uppercase tracking-widest transition-colors group-focus-within/input:text-blue-600">Envío ($)</label>
                            <input
                                type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)}
                                className="w-full px-4 py-3 border border-black focus:border-blue-600 font-black text-black focus:outline-none rounded-none bg-white text-sm"
                            />
                        </div>
                        <div className="space-y-2 group/input">
                            <label className="text-[10px] font-black text-black uppercase tracking-widest transition-colors group-focus-within/input:text-blue-600">Margen (%)</label>
                            <input
                                type="number" value={targetMarginPercent} onChange={e => setTargetMarginPercent(e.target.value)}
                                className="w-full px-4 py-3 border border-black focus:border-blue-600 font-black text-black focus:outline-none rounded-none bg-white text-sm"
                            />
                        </div>
                    </div>
                </section>

                {/* IMPUESTOS Y COMISIONES */}
                <section className="bg-white border border-black p-6 md:p-8 lg:col-span-2 relative group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-black scale-y-0 group-hover:scale-y-100 transition-transform origin-top z-10"></div>
                    <div className="flex items-center gap-3 mb-6 border-b border-black pb-4">
                        <h2 className="text-xl font-black text-black uppercase tracking-tight">Comisiones e Impuestos</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2 group/input">
                            <label className="text-[10px] font-black text-black uppercase tracking-widest transition-colors group-focus-within/input:text-blue-600">Com. Transac. (%)</label>
                            <input
                                type="number" step="0.01" value={transactionFeePercent} onChange={e => setTransactionFeePercent(e.target.value)}
                                className="w-full px-4 py-3 border border-black focus:border-blue-600 font-black text-black focus:outline-none rounded-none bg-white text-sm"
                            />
                        </div>
                        <div className="space-y-2 group/input">
                            <label className="text-[10px] font-black text-black uppercase tracking-widest transition-colors group-focus-within/input:text-blue-600">IVA s/ Comis. (%)</label>
                            <input
                                type="number" value={transactionFeeIvaPercent} onChange={e => setTransactionFeeIvaPercent(e.target.value)}
                                className="w-full px-4 py-3 border border-black focus:border-blue-600 font-black text-black focus:outline-none rounded-none bg-white text-sm"
                            />
                        </div>
                        <div className="space-y-2 group/input">
                            <label className="text-[10px] font-black text-black uppercase tracking-widest transition-colors group-focus-within/input:text-blue-600">Interés 6C (%)</label>
                            <input
                                type="number" value={installments6Percent} onChange={e => setInstallments6Percent(e.target.value)}
                                className="w-full px-4 py-3 border border-black focus:border-blue-600 font-black text-black focus:outline-none rounded-none bg-white text-sm"
                            />
                        </div>
                        <div className="space-y-2 group/input">
                            <label className="text-[10px] font-black text-black uppercase tracking-widest transition-colors group-focus-within/input:text-blue-600">IVA Gral. (%)</label>
                            <input
                                type="number" value={ivaPercent} onChange={e => setIvaPercent(e.target.value)}
                                className="w-full px-4 py-3 border border-black focus:border-blue-600 font-black text-black focus:outline-none rounded-none bg-white text-sm"
                            />
                        </div>
                    </div>
                </section>

                {/* COSTOS FIJOS */}
                <section className="bg-white border border-black p-6 md:p-8 lg:col-span-2 relative group flex flex-col">
                    <div className="absolute top-0 left-0 w-2 h-full bg-black scale-y-0 group-hover:scale-y-100 transition-transform origin-top z-10"></div>
                    <div className="flex justify-between items-center mb-6 border-b border-black pb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black text-black uppercase tracking-tight">Estructura de Costos Fijos</h2>
                        </div>
                        <button
                            onClick={addFixedCost}
                            className="bg-black text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 hover:bg-blue-600 transition-colors flex items-center gap-2"
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            AÑADIR
                        </button>
                    </div>

                    <div className="space-y-2 mb-6 flex-1">
                        {fixedCosts.length === 0 ? (
                            <p className="text-center py-10 text-xs font-black text-black/20 uppercase tracking-widest border border-dashed border-black/20">VACÍO</p>
                        ) : (
                            fixedCosts.map(cost => (
                                <div key={cost.id} className="flex relative border-b border-black/10 focus-within:border-blue-600 transition-colors group/row">
                                    <input
                                        type="text" value={cost.name}
                                        onChange={e => updateFixedCost(cost.id, { name: e.target.value })}
                                        className="flex-1 bg-transparent py-3 font-bold text-black border-none focus:outline-none text-sm uppercase placeholder:text-black/30"
                                        placeholder="CONCEPTO"
                                    />
                                    <div className="relative w-32 md:w-48 border-l border-black/10 group-focus-within/row:border-blue-600 flex items-center px-3">
                                        <span className="text-[10px] font-black text-black/40 mr-2">$</span>
                                        <input
                                            type="number" value={cost.amount}
                                            onChange={e => updateFixedCost(cost.id, { amount: parseFloat(e.target.value) })}
                                            className="w-full bg-transparent py-3 font-black text-black border-none focus:outline-none text-right"
                                        />
                                    </div>
                                    <button
                                        onClick={() => deleteFixedCost(cost.id)}
                                        className="w-12 flex items-center justify-center text-black/20 hover:text-red-600 hover:bg-black/5 transition-colors border-l border-black/10 group-focus-within/row:border-blue-600"
                                    >
                                        <Trash2 size={16} strokeWidth={2} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                    {fixedCosts.length > 0 && (
                        <div className="flex justify-between items-center p-6 bg-black mt-auto">
                            <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Total Gastos</span>
                            <span className="text-2xl font-black text-white">
                                ${fixedCosts.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('es-AR')}
                            </span>
                        </div>
                    )}
                </section>
            </div>

            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-6 pointer-events-none flex justify-end z-50">
                <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="pointer-events-auto flex items-center gap-3 px-8 py-4 bg-blue-600 text-white font-black hover:bg-black transition-colors disabled:opacity-50 uppercase tracking-widest text-xs shadow-[8px_8px_0px_#000]"
                >
                    {saving ? <RefreshCw className="animate-spin" size={16} strokeWidth={2.5} /> : <Save size={16} strokeWidth={2.5} />}
                    {saving ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
                </button>
            </div>
        </div>
    );
}
