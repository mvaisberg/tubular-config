"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
    const supabase = createClient();
    const [usdOfficial, setUsdOfficial] = useState<string>("0");
    const [usdExchangeRate, setUsdExchangeRate] = useState<string>("0");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>("");

    const fetchSettings = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("settings")
            .select("*")
            .eq("id", 1)
            .single();

        if (data) {
            setUsdOfficial(data.usd_official?.toString() || "0");
            setUsdExchangeRate(data.usd_exchange_rate?.toString() || "0");
            if (data.last_updated) {
                setLastUpdated(new Date(data.last_updated).toLocaleString("es-AR"));
            }
        } else if (error) {
            console.error("Error fetching settings:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const rate = parseFloat(usdExchangeRate);
        const official = parseFloat(usdOfficial);

        if (isNaN(rate) || isNaN(official)) {
            alert("Por favor ingresa números válidos");
            setSaving(false);
            return;
        }

        const { error } = await supabase
            .from("settings")
            .update({
                usd_official: official,
                usd_exchange_rate: rate,
                last_updated: new Date().toISOString()
            })
            .eq("id", 1);

        if (error) {
            console.error("Error saving settings:", error);
            alert("Error al guardar la configuración");
        } else {
            alert("Configuración guardada correctamente");
            fetchSettings();
        }
        setSaving(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const response = await fetch("https://dolarapi.com/v1/dolares/oficial");
            if (!response.ok) {
                throw new Error("Failed to fetch from DolarAPI");
            }
            const result = await response.json();
            const sellPrice = result.venta;

            if (sellPrice) {
                const official = parseFloat(sellPrice);
                const rateWithMargin = official * 1.03;

                setUsdOfficial(official.toFixed(2));
                setUsdExchangeRate(rateWithMargin.toFixed(2));

                // Immediately save the synced values
                const { error } = await supabase
                    .from("settings")
                    .update({
                        usd_official: official,
                        usd_exchange_rate: rateWithMargin,
                        last_updated: new Date().toISOString()
                    })
                    .eq("id", 1);

                if (error) {
                    console.error("Error saving synced settings:", error);
                    alert("Error al guardar la sincronización");
                } else {
                    alert(`Sincronizado exitosamente. USD Oficial: $${official} -> USD Aplicado (+3%): $${rateWithMargin.toFixed(2)}`);
                    fetchSettings();
                }
            } else {
                throw new Error("Invalid response from DolarAPI");
            }
        } catch (error) {
            console.error(error);
            alert("Error al sincronizar con DolarAPI");
        }
        setSyncing(false);
    };

    if (loading) {
        return <div className="p-8">Cargando configuración...</div>;
    }

    return (
        <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Configuración</h1>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 mb-1">Cotización del Dólar</h2>
                        <p className="text-sm text-gray-500">
                            El valor de intercambio utilizado para cálculos en toda la plataforma.
                        </p>
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="px-4 py-2 bg-blue-50 text-blue-600 font-medium rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                        {syncing ? "Sincronizando..." : "Sincronizar Oficial + 3%"}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dólar Oficial (Venta)
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                value={usdOfficial}
                                onChange={(e) => setUsdOfficial(e.target.value)}
                                className="pl-7 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dólar Aplicado (Margen incl.)
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                value={usdExchangeRate}
                                onChange={(e) => setUsdExchangeRate(e.target.value)}
                                className="pl-7 w-full p-2 border border-blue-300 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold text-blue-900"
                            />
                        </div>
                    </div>
                </div>

                {lastUpdated && (
                    <p className="text-xs text-gray-500 mb-6 font-mono">
                        Última actualización: {lastUpdated}
                    </p>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-black text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                        {saving ? "Guardando..." : "Guardar Cambios"}
                    </button>
                </div>
            </div>
        </div>
    );
}
