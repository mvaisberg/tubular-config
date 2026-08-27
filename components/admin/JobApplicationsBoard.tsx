"use client";

// Pipeline de postulaciones laborales (solo admin): estados, notas, CV y WhatsApp.

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, FileText, MessageCircle } from "lucide-react";

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

export default function JobApplicationsBoard({ initial }: { initial: App[] }) {
    const supabase = createClient();
    const [apps, setApps] = useState<App[]>(initial);
    const [filter, setFilter] = useState("active");
    const [openId, setOpenId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        if (filter === "all") return apps;
        if (filter === "active") return apps.filter(a => a.status !== "discarded");
        return apps.filter(a => a.status === filter);
    }, [apps, filter]);

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
    const age = (y: number | null) => y ? `${new Date().getFullYear() - y} años` : null;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
                {[["active", `Activas (${apps.filter(a => a.status !== "discarded").length})`],
                  ["new", `Nuevas (${apps.filter(a => a.status === "new").length})`],
                  ["shortlisted", "Preseleccionadas"], ["interviewed", "Entrevistadas"],
                  ["discarded", "Descartadas"], ["all", `Todas (${apps.length})`]].map(([k, l]) => (
                    <button key={k} onClick={() => setFilter(k)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {l}
                    </button>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-sm text-gray-400">
                    Todavía no hay postulaciones acá. Compartí el link tubular.com.ar/trabaja en redes.
                </div>
            )}

            <div className="space-y-2">
                {filtered.map(a => {
                    const open = openId === a.id;
                    const st = STATUS[a.status] || STATUS.new;
                    const wa = (a.whatsapp || "").replace(/\D/g, "");
                    const waLink = `https://wa.me/${wa.startsWith("54") ? wa : "549" + wa}`;
                    const flags = [
                        a.available_schedule === false && "⚠ horario NO",
                        a.physical_ok === false && "⚠ físico NO",
                    ].filter(Boolean).join(" · ");
                    return (
                        <article key={a.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <button onClick={() => setOpenId(open ? null : a.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-900">{a.full_name}</span>
                                        {age(a.birth_year) && <span className="text-xs text-gray-400">{age(a.birth_year)}</span>}
                                        <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                                        {a.cv_path && <FileText size={13} className="text-gray-400" />}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                                        {a.location || "—"} · {a.salary_expectation || "sin sueldo"} · {format(new Date(a.created_at), "d MMM HH:mm", { locale: es })}
                                        {a.utm_source ? ` · vía ${a.utm_source}` : ""}
                                        {flags && <span className="text-rose-600 font-medium"> · {flags}</span>}
                                    </div>
                                </div>
                                <ChevronDown size={15} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                            </button>
                            {open && (
                                <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50/50 text-sm">
                                    <div className="grid md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                                        <Row k="WhatsApp" v={a.whatsapp} />
                                        <Row k="Zona / viaje" v={a.location} />
                                        <Row k="Horario L-V + sáb" v={a.available_schedule ? "Sí ✓" : "No ✗"} />
                                        <Row k="Esfuerzo físico" v={a.physical_ok ? "Sí ✓" : "No ✗"} />
                                        <Row k="Registro" v={a.drivers_license} />
                                        <Row k="Empieza" v={a.start_date} />
                                        <Row k="Sueldo pretendido" v={a.salary_expectation} />
                                        <Row k="Origen" v={a.utm_source ? `${a.utm_source}` : "directo"} />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Experiencia</div>
                                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{a.experience || "—"}</p>
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">En qué se destaca</div>
                                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{a.strengths || "—"}</p>
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Notas internas</div>
                                        <textarea
                                            defaultValue={a.admin_notes || ""}
                                            onBlur={e => saveNotes(a.id, e.target.value)}
                                            rows={2}
                                            placeholder="Se guarda solo al salir del campo…"
                                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">
                                            <MessageCircle size={13} /> WhatsApp
                                        </a>
                                        {a.cv_path && (
                                            <button onClick={() => openCv(a.cv_path!)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800">
                                                <FileText size={13} /> Ver CV
                                            </button>
                                        )}
                                        <div className="ml-auto flex gap-1.5">
                                            {Object.entries(STATUS).map(([k, v]) => (
                                                <button key={k} onClick={() => setStatus(a.id, k)}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${a.status === k ? v.cls : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"}`}>
                                                    {v.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>
        </div>
    );
}

function Row({ k, v }: { k: string; v: string | null }) {
    return (
        <div className="flex gap-2">
            <span className="text-gray-400 w-28 shrink-0">{k}</span>
            <span className="text-gray-800 font-medium">{v || "—"}</span>
        </div>
    );
}
