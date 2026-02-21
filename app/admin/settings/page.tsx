"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Save, RefreshCw, Calculator, Truck, Percent, DollarSign } from "lucide-react";

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
        const newCost = { name: "Nuevo Costo", amount: 0 };
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

    if (loading) return <div className="p-12 text-[#354763]/50 font-bold animate-pulse uppercase tracking-widest">Cargando configuración...</div>;

    return (
        <div className="max-w-5xl space-y-8 pb-20">
            <header className="flex justify-between items-center bg-[#ebecdf] p-8 rounded-3xl border border-[#354763]/10 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-[#354763] tracking-tighter uppercase italic">Configuración Estratégica</h1>
                    <p className="text-[#354763]/60 text-sm font-bold uppercase tracking-widest mt-1">Variables de Pricing y Estructura de Costos</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-[#354763]/30 uppercase tracking-[0.2em]">Última Actualización</p>
                    <p className="text-xs font-bold text-[#354763]">{lastUpdated || "Nunca"}</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* DIVISAS */}
                <section className="bg-white p-8 rounded-3xl border border-[#354763]/10 shadow-sm space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                                <RefreshCw size={24} />
                            </div>
                            <h2 className="text-xl font-black text-[#354763] uppercase tracking-tight">Divisas</h2>
                        </div>
                        <button
                            onClick={handleSyncUsd}
                            disabled={syncing}
                            className="text-[10px] font-black bg-[#354763] text-white px-4 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all uppercase tracking-widest"
                        >
                            {syncing ? "Sincronizando..." : "Sincronizar Dólar (Oficial + 3%)"}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#354763]/40 uppercase tracking-widest ml-1">Dólar Oficial (Venta)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-[#354763]/30" size={16} />
                                <input
                                    type="number" value={usdOfficial} onChange={e => setUsdOfficial(e.target.value)}
                                    className="w-full pl-10 pr-4 py-4 bg-[#ebecdf]/30 border border-[#354763]/10 rounded-2xl font-bold text-[#354763] focus:outline-none focus:ring-2 focus:ring-[#354763]/20"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#354763]/40 uppercase tracking-widest ml-1">Dólar Aplicado (+Mgn)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-[#354763]/30" size={16} />
                                <input
                                    type="number" value={usdExchangeRate} onChange={e => setUsdExchangeRate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-4 bg-[#354763] border border-[#354763]/10 rounded-2xl font-black text-white focus:outline-none focus:ring-2 focus:ring-[#354763]/40 shadow-lg shadow-[#354763]/20"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* LOGISTICA Y MARGEN */}
                <section className="bg-white p-8 rounded-3xl border border-[#354763]/10 shadow-sm space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-50 rounded-2xl text-[#aab799]">
                            <Truck size={24} />
                        </div>
                        <h2 className="text-xl font-black text-[#354763] uppercase tracking-tight">Logística y Margen</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#354763]/40 uppercase tracking-widest ml-1">Costo de Envío ($)</label>
                            <input
                                type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)}
                                className="w-full px-4 py-4 bg-[#ebecdf]/30 border border-[#354763]/10 rounded-2xl font-bold text-[#354763] focus:outline-none focus:ring-2 focus:ring-[#354763]/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#aab799] uppercase tracking-widest ml-1">Margen Objetivo (%)</label>
                            <input
                                type="number" value={targetMarginPercent} onChange={e => setTargetMarginPercent(e.target.value)}
                                className="w-full px-4 py-4 bg-[#aab799]/10 border border-[#aab799]/30 rounded-2xl font-black text-[#354763] focus:outline-none focus:ring-2 focus:ring-[#aab799]/40"
                            />
                        </div>
                    </div>
                </section>

                {/* IMPUESTOS Y COMISIONES */}
                <section className="bg-white p-8 rounded-3xl border border-[#354763]/10 shadow-sm space-y-6 lg:col-span-2">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-50 rounded-2xl text-orange-600">
                            <Percent size={24} />
                        </div>
                        <h2 className="text-xl font-black text-[#354763] uppercase tracking-tight">Comisiones e Impuestos</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#354763]/40 uppercase tracking-widest ml-1">Comisión Transacción (%)</label>
                            <input
                                type="number" step="0.01" value={transactionFeePercent} onChange={e => setTransactionFeePercent(e.target.value)}
                                className="w-full px-4 py-4 bg-[#ebecdf]/30 border border-[#354763]/10 rounded-2xl font-bold text-[#354763]"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#354763]/40 uppercase tracking-widest ml-1">IVA s/ Comisión (%)</label>
                            <input
                                type="number" value={transactionFeeIvaPercent} onChange={e => setTransactionFeeIvaPercent(e.target.value)}
                                className="w-full px-4 py-4 bg-[#ebecdf]/30 border border-[#354763]/10 rounded-2xl font-bold text-[#354763]"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#354763]/40 uppercase tracking-widest ml-1">Interés 6 Cuotas (%)</label>
                            <input
                                type="number" value={installments6Percent} onChange={e => setInstallments6Percent(e.target.value)}
                                className="w-full px-4 py-4 bg-[#ebecdf]/30 border border-[#354763]/10 rounded-2xl font-bold text-[#354763]"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#354763]/40 uppercase tracking-widest ml-1">IVA General (%)</label>
                            <input
                                type="number" value={ivaPercent} onChange={e => setIvaPercent(e.target.value)}
                                className="w-full px-4 py-4 bg-[#ebecdf]/30 border border-[#354763]/10 rounded-2xl font-bold text-[#354763]"
                            />
                        </div>
                    </div>
                </section>

                {/* COSTOS FIJOS */}
                <section className="bg-white p-8 rounded-3xl border border-[#354763]/10 shadow-sm space-y-6 lg:col-span-2">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-50 rounded-2xl text-purple-600">
                                <Calculator size={24} />
                            </div>
                            <h2 className="text-xl font-black text-[#354763] uppercase tracking-tight">Estructura de Costos Fijos</h2>
                        </div>
                        <button
                            onClick={addFixedCost}
                            className="flex items-center gap-2 text-[10px] font-black bg-[#354763]/5 text-[#354763] px-4 py-2 rounded-xl hover:bg-[#354763] hover:text-white transition-all uppercase tracking-widest"
                        >
                            <Plus size={14} />
                            Agregar Costo
                        </button>
                    </div>

                    <div className="space-y-3">
                        {fixedCosts.length === 0 ? (
                            <p className="text-center py-10 text-xs font-bold text-[#354763]/20 uppercase tracking-widest italic border-2 border-dashed border-[#354763]/5 rounded-3xl">No hay costos fijos registrados</p>
                        ) : (
                            fixedCosts.map(cost => (
                                <div key={cost.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 bg-[#ebecdf]/20 rounded-2xl border border-transparent hover:border-[#354763]/10 transition-all">
                                    <div className="md:col-span-8">
                                        <input
                                            type="text" value={cost.name}
                                            onChange={e => updateFixedCost(cost.id, { name: e.target.value })}
                                            className="w-full bg-transparent font-bold text-[#354763] border-none focus:ring-0 text-sm uppercase"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <div className="relative">
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#354763]/30">$</span>
                                            <input
                                                type="number" value={cost.amount}
                                                onChange={e => updateFixedCost(cost.id, { amount: parseFloat(e.target.value) })}
                                                className="w-full bg-transparent pl-4 py-1 font-black text-[#354763] border-none focus:ring-0 text-right"
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-1 flex justify-end">
                                        <button
                                            onClick={() => deleteFixedCost(cost.id)}
                                            className="p-2 text-red-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {fixedCosts.length > 0 && (
                        <div className="flex justify-between items-center p-6 bg-[#354763] rounded-2xl shadow-xl shadow-[#354763]/10">
                            <span className="text-xs font-black text-white/50 uppercase tracking-widest">Total Gastos Fijos</span>
                            <span className="text-2xl font-black text-white italic">
                                ${fixedCosts.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('es-AR')}
                            </span>
                        </div>
                    )}
                </section>
            </div>

            <div className="fixed bottom-8 right-8 z-50">
                <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="flex items-center gap-3 px-8 py-4 bg-[#aab799] text-white font-black rounded-2xl shadow-2xl hover:bg-[#99a688] transition-all transform active:scale-95 disabled:opacity-50 uppercase tracking-widest text-sm"
                >
                    {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                    {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
            </div>
        </div>
    );
}
