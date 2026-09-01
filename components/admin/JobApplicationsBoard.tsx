"use client";

// Postulaciones laborales (solo admin) en dos columnas: a la derecha los
// candidatos que pasan el filtro (edad, sueldo, disponibilidad), ordenados por
// score; a la izquierda el resto, con el motivo del descarte a la vista.

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, FileText, MessageCircle, SlidersHorizontal } from "lucide-react";
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
}

const STATUS: Record<string, { label: string; cls: string }> = {
    new: { label: "Nueva", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    shortlisted: { label: "Preseleccionada", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    interviewed: { label: "Entrevistada", cls: "bg-violet-50 text-violet-700 border-violet-200" },
    hired: { label: "Contratada", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    discarded: { label: "Descartada", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

const money = (n: number | null) => n === null ? "—" : "$" + n.toLocaleString("es-AR");

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
            finalists: scored.filter(isFinal).sort((a, b) => b.ev.score - a.ev.score),
            fit: scored.filter(x => !isFinal(x) && x.ev.passes).sort((a, b) => b.ev.score - a.ev.score),
            rest: scored.filter(x => !isFinal(x) && !x.ev.passes).sort((a, b) => b.ev.score - a.ev.score),
        };
    }, [apps, crit, hideDiscarded]);

    const setStatus = async (id: string, status: string) => {
        setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
        await supabase.from("job_applications").update({ status }).eq("id", id);
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
        const open = openId === a.id;
        const st = STATUS[a.status] || STATUS.new;
        const wa = (a.whatsapp || "").replace(/\D/g, "");
        const waLink = `https://wa.me/${wa.startsWith("54") ? wa : "549" + wa}`;
        return (
            <article className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setOpenId(open ? null : a.id)} className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{a.full_name}</span>
                            {ev.age && <span className="text-xs text-gray-500">{ev.age}a</span>}
                            <span className={`text-[10px] font-medium border rounded-full px-1.5 py-0.5 ${st.cls}`}>{st.label}</span>
                            {a.cv_path && <FileText size={12} className="text-gray-400" />}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                            {money(ev.salary)} · {ev.commute !== null ? `${ev.commute} min` : "viaje ?"} · {(a.location || "—").slice(0, 30)}
                        </div>
                        {ev.reasons.length > 0 && (
                            <div className="text-[11px] text-rose-600 mt-0.5 truncate">{ev.reasons.join(" · ")}</div>
                        )}
                    </div>
                    <ChevronDown size={14} className={`text-gray-400 shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                    <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50/50">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <Row k="WhatsApp" v={a.whatsapp} />
                            <Row k="Zona / viaje" v={a.location} />
                            <Row k="Horario" v={a.available_schedule ? "Sí ✓" : "No ✗"} />
                            <Row k="Físico" v={a.physical_ok ? "Sí ✓" : "No ✗"} />
                            <Row k="Registro" v={a.drivers_license} />
                            <Row k="Empieza" v={a.start_date} />
                            <Row k="Pide" v={`${a.salary_expectation || "—"}${ev.salary ? ` (${money(ev.salary)})` : ""}`} />
                            <Row k="Origen" v={a.utm_source || "directo"} />
                        </div>
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Experiencia</div>
                            <p className="text-[11px] text-gray-700 whitespace-pre-wrap">{a.experience || "—"}</p>
                        </div>
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Se destaca en</div>
                            <p className="text-[11px] text-gray-700 whitespace-pre-wrap">{a.strengths || "—"}</p>
                        </div>
                        <textarea
                            defaultValue={a.admin_notes || ""}
                            onBlur={e => saveNotes(a.id, e.target.value)}
                            rows={2} placeholder="Notas internas…"
                            className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                            <a href={waLink} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-semibold rounded-lg hover:bg-emerald-700">
                                <MessageCircle size={12} /> WhatsApp
                            </a>
                            {a.cv_path && (
                                <button onClick={() => openCv(a.cv_path!)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-semibold rounded-lg hover:bg-gray-800">
                                    <FileText size={12} /> CV
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {Object.entries(STATUS).map(([k, v]) => (
                                <button key={k} onClick={() => setStatus(a.id, k)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${a.status === k ? v.cls : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"}`}>
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </article>
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
                    Sueldo hasta $
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
                            ✓ Recomendados · {crit.ageMin}–{crit.ageMax} años, hasta ${(crit.salaryMax / 1000).toFixed(0)}k
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
        </div>
    );
}

function Row({ k, v }: { k: string; v: string | null }) {
    return (
        <div className="flex gap-1.5">
            <span className="text-gray-400 w-20 shrink-0">{k}</span>
            <span className="text-gray-800 font-medium truncate">{v || "—"}</span>
        </div>
    );
}
