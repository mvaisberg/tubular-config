"use client";

// Gestión de las plantillas de Meta para el pedido de reviews: listar con su
// estado de aprobación, crear nuevas variantes (con estrellas, distinto copy, etc.)
// y elegir cuál dispara el flujo.

import { useEffect, useMemo, useState } from "react";
import { Plus, CheckCircle2, Clock, XCircle, Send, Loader2, RefreshCw } from "lucide-react";

interface MetaTemplate {
    name: string;
    status: string; // APPROVED | PENDING | REJECTED | ...
    language: string;
    category: string;
    components?: { type: string; text?: string }[];
}

const STATUS_BADGE: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    APPROVED: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 size={13} />, label: "Aprobada" },
    PENDING: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock size={13} />, label: "En revisión" },
    REJECTED: { cls: "bg-red-50 text-red-700 border-red-200", icon: <XCircle size={13} />, label: "Rechazada" },
};

const DEFAULT_BODY =
    "Hola {{1}}! 👋 Te escribimos de Tubular.\n\nHace unos días recibiste tu {{2}}. ¿Del 1 al 5, qué puntaje le pondrías? ⭐\n\nRespondé este mensaje y listo 💙";

export default function TemplatesManager() {
    const [templates, setTemplates] = useState<MetaTemplate[]>([]);
    const [active, setActive] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState("");
    const [body, setBody] = useState(DEFAULT_BODY);
    const [examples, setExamples] = useState<string[]>(["Martín", "mueble"]);

    const varCount = useMemo(() => new Set(body.match(/\{\{(\d+)\}\}/g) ?? []).size, [body]);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/configurador/api/reviews/templates");
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setTemplates(json.templates);
            setActive(json.active?.name ?? null);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const create = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/configurador/api/reviews/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, body, example: examples.slice(0, varCount) }),
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setShowForm(false);
            setName("");
            await load();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const activate = async (templateName: string) => {
        setCreating(true);
        try {
            const res = await fetch("/configurador/api/reviews/templates", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: templateName }),
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setActive(templateName);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setCreating(false);
        }
    };

    const bodyOf = (t: MetaTemplate) => t.components?.find(c => c.type === "BODY")?.text ?? "";

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold text-gray-900">Plantillas de WhatsApp</h2>
                <div className="flex gap-2">
                    <button onClick={load} className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100" title="Refrescar">
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                    >
                        <Plus size={14} /> Nueva plantilla
                    </button>
                </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
                El primer mensaje del flujo sale con una plantilla aprobada por Meta. Creá variantes (con estrellas, otro copy) y elegí cuál se usa.
            </p>

            {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            {showForm && (
                <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                    <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 block mb-1">Nombre (minúsculas y _)</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                            placeholder="review_estrellas_v2"
                            className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-white"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 block mb-1">
                            Mensaje — usá {"{{1}}"} para el nombre, {"{{2}}"} para el producto
                        </label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            rows={5}
                            className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-white resize-none font-mono"
                        />
                    </div>
                    {varCount > 0 && (
                        <div className="flex gap-2">
                            {Array.from({ length: varCount }, (_, i) => (
                                <div key={i} className="flex-1">
                                    <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 block mb-1">
                                        Ejemplo {"{{" + (i + 1) + "}}"}
                                    </label>
                                    <input
                                        value={examples[i] ?? ""}
                                        onChange={e => {
                                            const next = [...examples];
                                            next[i] = e.target.value;
                                            setExamples(next);
                                        }}
                                        className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-white"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button
                            onClick={create}
                            disabled={saving || !name || !body}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            Enviar a revisión de Meta
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {loading && templates.length === 0 && <div className="text-sm text-gray-400 py-4 text-center">Cargando plantillas…</div>}
                {templates.map((t) => {
                    const badge = STATUS_BADGE[t.status] ?? { cls: "bg-gray-50 text-gray-600 border-gray-200", icon: null, label: t.status };
                    const isActive = t.name === active;
                    return (
                        <div key={`${t.name}-${t.language}`} className={`border rounded-lg p-3 ${isActive ? "border-gray-900 bg-gray-50" : "border-gray-200"}`}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm font-semibold text-gray-800 truncate">{t.name}</span>
                                    <span className="text-[10px] text-gray-400">{t.language}</span>
                                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2 py-0.5 ${badge.cls}`}>
                                        {badge.icon} {badge.label}
                                    </span>
                                </div>
                                {isActive ? (
                                    <span className="text-[11px] font-semibold text-gray-900 shrink-0">● En uso</span>
                                ) : t.status === "APPROVED" && (
                                    <button
                                        onClick={() => activate(t.name)}
                                        disabled={creating}
                                        className="text-[12px] font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-2.5 py-1 hover:bg-gray-100 shrink-0"
                                    >
                                        Usar esta
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-3">{bodyOf(t)}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
