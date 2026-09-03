"use client";

// Postulaciones laborales (solo admin) en dos columnas: a la derecha los
// candidatos que pasan el filtro (edad, sueldo, disponibilidad), ordenados por
// score; a la izquierda el resto, con el motivo del descarte a la vista.

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { FileText, MessageCircle, SlidersHorizontal, StickyNote, X } from "lucide-react";
import { evaluate, DEFAULT_CRITERIA, type Criteria } from "@/lib/job-scoring";

interface App {
    id: string;
    created_at: string;
    full_name: string;
    whatsapp: string;
    birth_year: number | null;
    location: string | null;
    available_schedule: boolean | null;
    physical_ok: boolean | null;
    drivers_license: string | null;
    experience: string | null;
    strengths: string | null;
    salary_expectation: string | null;
    start_date: string | null;
    cv_path: string | null;
    utm_source: string | null;
    status: string;
    admin_notes: string | null;
    job_stability?: string | null;
    finalist_rank?: number | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
    new: { label: "Nueva", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    shortlisted: { label: "Preseleccionada", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    interviewed: { label: "Entrevistada", cls: "bg-violet-50 text-violet-700 border-violet-200" },
    hired: { label: "Contratada", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    discarded: { label: "Descartada", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

const money = (n: number | null) => n === null ? "—" : "$" + n.toLocaleString("es-AR");

// Estabilidad laboral leída del CV.
const STABILITY: Record<string, { label: string; cls: string }> = {
    alta: { label: "Estable", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    media: { label: "Media", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    baja: { label: "Rota mucho", cls: "bg-rose-50 text-rose-700 border border-rose-200" },
};

export default function JobApplicationsBoard({ initial }: { initial: App[] }) {
    const supabase = createClient();
    const [apps, setApps] = useState<App[]>(initial);
    const [openId, setOpenId] = useState<string | null>(null);
    const [hideDiscarded, setHideDiscarded] = useState(true);
    const [crit, setCrit] = useState<Criteria>(DEFAULT_CRITERIA);

    const FINALIST_STATES = ["shortlisted", "interviewed", "hired"];
    const { fit, rest, finalists } = useMemo(() => {
        const list = hideDiscarded ? apps.filter(a => a.status !== "discarded") : apps;
        const scored = list.map(a => ({ app: a, ev: evaluate(a, crit) }));
        const isFinal = (x: typeof scored[number]) => FINALIST_STATES.includes(x.app.status);
        return {
            finalists: scored.filter(isFinal).sort((a, b) => {
                const ra = a.app.finalist_rank ?? 999, rb = b.app.finalist_rank ?? 999;
                return ra !== rb ? ra - rb : b.ev.score - a.ev.score;
            }),
            fit: scored.filter(x => !isFinal(x) && x.ev.passes).sort((a, b) => b.ev.score - a.ev.score),
            rest: scored.filter(x => !isFinal(x) && !x.ev.passes).sort((a, b) => b.ev.score - a.ev.score),
        };
    }, [apps, crit, hideDiscarded]);

    const setStatus = async (id: string, status: string) => {
        setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
        await supabase.from("job_applications").update({ status }).eq("id", id);
    };
    const setStability = async (id: string, job_stability: string | null) => {
        setApps(prev => prev.map(a => a.id === id ? { ...a, job_stability } : a));
        await supabase.from("job_applications").update({ job_stability }).eq("id", id);
    };
    const saveNotes = async (id: string, admin_notes: string) => {
        await supabase.from("job_applications").update({ admin_notes }).eq("id", id);
    };
    const openCv = async (path: string) => {
        const res = await fetch(`/configurador/api/jobs/cv?path=${encodeURIComponent(path)}`);
        const json = await res.json();
        if (json.url) window.open(json.url, "_blank");
        else alert(json.error || "No se pudo abrir el CV");
    };

    const numCls = "w-20 border border-gray-200 rounded-md px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

    const Card = ({ app: a, ev }: { app: App; ev: ReturnType<typeof evaluate> }) => {
        const st = STATUS[a.status] || STATUS.new;
        return (
            <button
                onClick={() => setOpenId(a.id)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-left hover:border-gray-400 hover:shadow-sm transition-all"
            >
                <div className="flex items-center gap-1.5 flex-wrap">
                    {a.finalist_rank && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold shrink-0">{a.finalist_rank}</span>
                    )}
                    <span className="text-sm font-semibold text-gray-900">{a.full_name}</span>
                    {ev.age && <span className="text-xs text-gray-500">{ev.age}a</span>}
                    <span className={`text-[10px] font-medium border rounded-full px-1.5 py-0.5 ${st.cls}`}>{st.label}</span>
                    {a.cv_path && <FileText size={12} className="text-gray-400" />}
                    {a.admin_notes && <StickyNote size={12} className="text-indigo-400" />}
                    {a.drivers_license && a.drivers_license !== "no" && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 border border-red-300 bg-red-50 rounded px-1.5 py-0.5 uppercase">
                            {a.drivers_license === "moto" ? "🏍 Moto" : a.drivers_license === "auto" ? "🚗 Auto" : "🚗 Auto+Moto"}
                        </span>
                    )}
                    {a.job_stability && (
                        <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${STABILITY[a.job_stability]?.cls || ""}`}>
                            {STABILITY[a.job_stability]?.label}
                        </span>
                    )}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                    {money(ev.salary)} · {ev.commute !== null ? `${ev.commute} min` : "viaje ?"} · {(a.location || "—").slice(0, 30)}
                </div>
                {ev.reasons.length > 0 && (
                    <div className="text-[11px] text-rose-600 mt-0.5 truncate">{ev.reasons.join(" · ")}</div>
                )}
            </button>
        );
    };

    return (
        <div className="space-y-4">
            {/* Criterios */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <SlidersHorizontal size={15} className="text-gray-400" /> Filtro
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    Edad
                    <input type="number" value={crit.ageMin} onChange={e => setCrit(c => ({ ...c, ageMin: Number(e.target.value) }))} className={numCls} />
                    a
                    <input type="number" value={crit.ageMax} onChange={e => setCrit(c => ({ ...c, ageMax: Number(e.target.value) }))} className={numCls} />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    Viaje hasta
                    <input type="number" step="5" value={crit.commuteMax} onChange={e => setCrit(c => ({ ...c, commuteMax: Number(e.target.value) }))} className={numCls} />
                    min
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    Sueldo menor a $
                    <input type="number" step="50000" value={crit.salaryMax} onChange={e => setCrit(c => ({ ...c, salaryMax: Number(e.target.value) }))} className={numCls + " w-28"} />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-auto">
                    <input type="checkbox" checked={hideDiscarded} onChange={e => setHideDiscarded(e.target.checked)} />
                    Ocultar descartadas
                </label>
            </div>

            {apps.length === 0 && (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-sm text-gray-400">
                    Todavía no hay postulaciones. Compartí el link tubular.com.ar/trabaja en redes.
                </div>
            )}

            {/* Dos columnas: descartadas por filtro | recomendadas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                <section>
                    <header className="flex items-center justify-between mb-2 px-1">
                        <h2 className="text-sm font-semibold text-gray-500">No cumplen el filtro</h2>
                        <span className="text-xs font-semibold text-gray-400 tabular-nums">{rest.length}</span>
                    </header>
                    <div className="space-y-2 lg:max-h-[75vh] lg:overflow-y-auto pr-1">
                        {rest.map(x => <Card key={x.app.id} app={x.app} ev={x.ev} />)}
                        {rest.length === 0 && <p className="text-xs text-gray-400 italic px-1">Ninguna.</p>}
                    </div>
                </section>

                <section>
                    <header className="flex items-center justify-between mb-2 px-1">
                        <h2 className="text-sm font-semibold text-emerald-700">
                            ✓ Recomendados · ≤{crit.ageMax} años · ≤{crit.commuteMax} min · &lt;${(crit.salaryMax / 1000).toFixed(0)}k
                        </h2>
                        <span className="text-xs font-semibold text-emerald-600 tabular-nums">{fit.length}</span>
                    </header>
                    <div className="space-y-2 lg:max-h-[75vh] lg:overflow-y-auto pr-1">
                        {fit.map(x => <Card key={x.app.id} app={x.app} ev={x.ev} />)}
                        {fit.length === 0 && <p className="text-xs text-gray-400 italic px-1">Ninguna postulación cumple con estos criterios.</p>}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2 px-1">
                        Ordenados por cercanía al taller, margen de sueldo y qué tan completa está la postulación.
                    </p>
                </section>

                <section>
                    <header className="flex items-center justify-between mb-2 px-1">
                        <h2 className="text-sm font-semibold text-indigo-700">★ Finalistas · para entrevistar</h2>
                        <span className="text-xs font-semibold text-indigo-600 tabular-nums">{finalists.length}</span>
                    </header>
                    <div className="space-y-2 lg:max-h-[75vh] lg:overflow-y-auto pr-1">
                        {finalists.map(x => <Card key={x.app.id} app={x.app} ev={x.ev} />)}
                        {finalists.length === 0 && (
                            <p className="text-xs text-gray-400 italic px-1">
                                Marcá una postulación como Preseleccionada y aparece acá.
                            </p>
                        )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2 px-1">
                        Revisados uno por uno: estabilidad laboral en el CV, experiencia relevante y cómo redactan.
                    </p>
                </section>
            </div>

            {/* Ficha completa */}
            {(() => {
                const a = apps.find(x => x.id === openId);
                if (!a) return null;
                const ev = evaluate(a, crit);
                const st = STATUS[a.status] || STATUS.new;
                const wa = (a.whatsapp || "").replace(/\D/g, "");
                const waLink = `https://wa.me/${wa.startsWith("54") ? wa : "549" + wa}`;
                return (
                    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setOpenId(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8" onClick={e => e.stopPropagation()}>
                            {/* Encabezado */}
                            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-lg font-semibold text-gray-900">{a.full_name}</h3>
                                        {ev.age && <span className="text-sm text-gray-500">{ev.age} años</span>}
                                        <span className={`text-[11px] font-medium border rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Postulada el {format(new Date(a.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                                        {a.utm_source ? ` · llegó por ${a.utm_source}` : " · entró directo"}
                                    </p>
                                </div>
                                <button onClick={() => setOpenId(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={20} /></button>
                            </div>

                            <div className="p-5 space-y-5">
                                {/* Motivos de descarte */}
                                {ev.reasons.length > 0 && (
                                    <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                                        No cumple el filtro: {ev.reasons.join(" · ")}
                                    </div>
                                )}

                                {/* Datos */}
                                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                                    <Row k="WhatsApp" v={a.whatsapp} />
                                    <Row k="Zona y viaje" v={a.location} />
                                    <Row k="Horario L-V + sáb" v={a.available_schedule ? "Sí puede ✓" : "No puede ✗"} />
                                    <Row k="Esfuerzo físico" v={a.physical_ok ? "Sí puede ✓" : "No puede ✗"} />
                                    <div className="flex gap-2">
                                        <span className="text-gray-400 w-36 shrink-0">Registro</span>
                                        {a.drivers_license && a.drivers_license !== "no"
                                            ? <span className="font-bold text-red-600 uppercase">{a.drivers_license === "moto" ? "🏍 Moto" : a.drivers_license === "auto" ? "🚗 Auto" : "🚗 Auto y moto"}</span>
                                            : <span className="text-gray-900 font-medium">No tiene</span>}
                                    </div>
                                    <Row k="Puede empezar" v={a.start_date} />
                                    <Row k="Sueldo pretendido" v={`${a.salary_expectation || "—"}${ev.salary ? `  →  ${money(ev.salary)}` : ""}`} />
                                    <Row k="Año de nacimiento" v={a.birth_year ? String(a.birth_year) : null} />
                                </div>

                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Estabilidad laboral (según el CV)</div>
                                    <div className="flex gap-1.5">
                                        {["alta", "media", "baja"].map(k => (
                                            <button key={k} onClick={() => setStability(a.id, a.job_stability === k ? null : k)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${a.job_stability === k ? STABILITY[k].cls : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"}`}>
                                                {STABILITY[k].label}
                                            </button>
                                        ))}
                                        {!a.job_stability && <span className="text-xs text-gray-400 self-center ml-1">sin analizar</span>}
                                    </div>
                                </div>

                                <Block title="Experiencia en trabajos anteriores" text={a.experience} />
                                <Block title="En qué se destaca" text={a.strengths} />

                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Notas internas</div>
                                    <textarea
                                        key={a.id}
                                        defaultValue={a.admin_notes || ""}
                                        onBlur={e => saveNotes(a.id, e.target.value)}
                                        rows={Math.min(Math.max((a.admin_notes || "").split("\n").length + 1, 3), 14)}
                                        placeholder="Se guarda al salir del campo…"
                                        className="w-full text-sm leading-relaxed border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                </div>
                            </div>

                            {/* Acciones */}
                            <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
                                <a href={waLink} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">
                                    <MessageCircle size={14} /> WhatsApp
                                </a>
                                {a.cv_path && (
                                    <button onClick={() => openCv(a.cv_path!)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800">
                                        <FileText size={14} /> Ver CV
                                    </button>
                                )}
                                <div className="ml-auto flex flex-wrap gap-1.5">
                                    {Object.entries(STATUS).map(([k, v]) => (
                                        <button key={k} onClick={() => setStatus(a.id, k)}
                                            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${a.status === k ? v.cls : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"}`}>
                                            {v.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

function Row({ k, v }: { k: string; v: string | null }) {
    return (
        <div className="flex gap-2">
            <span className="text-gray-400 w-36 shrink-0">{k}</span>
            <span className="text-gray-900 font-medium break-words">{v || "—"}</span>
        </div>
    );
}

function Block({ title, text }: { title: string; text: string | null }) {
    return (
        <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{title}</div>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{text || "—"}</p>
        </div>
    );
}
