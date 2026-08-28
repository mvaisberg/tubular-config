"use client";

// Formulario de postulación laboral (/trabaja). Mobile-first, sin login,
// CV opcional en PDF. Captura UTMs del link para saber de qué red vino.

import { useState } from "react";
import { useSearchParams } from "next/navigation";

const inputCls = "w-full border border-gray-300 rounded-xl px-4 py-3 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-[#354763]/40 focus:border-[#354763]";
const labelCls = "block text-sm font-semibold text-[#354763] mb-1.5";

function YesNo({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex gap-2">
            {[["si", "Sí"], ["no", "No"]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => onChange(v)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${value === v ? "bg-[#354763] text-white border-[#354763]" : "bg-white text-gray-600 border-gray-300"}`}>
                    {l}
                </button>
            ))}
            <input type="hidden" name={name} value={value} />
        </div>
    );
}

export default function JobApplicationForm() {
    const params = useSearchParams();
    const [schedule, setSchedule] = useState("");
    const [physical, setPhysical] = useState("");
    const [license, setLicense] = useState("");
    const [cvName, setCvName] = useState("");
    const [sending, setSending] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Las preguntas quedan ocultas hasta que la persona decide postularse.
    const [started, setStarted] = useState(false);

    if (done) {
        return (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-3">✅</div>
                <h2 className="text-xl font-black text-[#354763]">¡Recibimos tu postulación!</h2>
                <p className="text-sm text-gray-600 mt-2 max-w-sm mx-auto">
                    Gracias por tomarte el tiempo. Si tu perfil avanza, te contactamos por WhatsApp dentro de la semana.
                </p>
            </div>
        );
    }

    if (!started) {
        return (
            <button
                type="button"
                onClick={() => {
                    setStarted(true);
                    setTimeout(() => document.getElementById("form-postulacion")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                }}
                className="w-full py-4 bg-[#354763] text-white font-bold text-sm tracking-widest uppercase rounded-xl hover:bg-[#2a3850] transition-colors shadow-lg shadow-[#354763]/20"
            >
                Quiero postularme →
            </button>
        );
    }

    return (
        <form
            id="form-postulacion"
            className="bg-white border border-gray-200 rounded-2xl p-5 md:p-7 space-y-5 scroll-mt-6"
            onSubmit={async (e) => {
                e.preventDefault();
                if (!schedule || !physical || !license) { setError("Completá todas las preguntas de Sí/No y el registro."); return; }
                setSending(true); setError(null);
                try {
                    const fd = new FormData(e.currentTarget);
                    fd.set("utm_source", params.get("utm_source") || "");
                    fd.set("utm_medium", params.get("utm_medium") || "");
                    fd.set("utm_campaign", params.get("utm_campaign") || "");
                    const res = await fetch("/configurador/api/jobs/apply", { method: "POST", body: fd });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || "Error al enviar");
                    setDone(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                } catch (err) {
                    setError((err as Error).message);
                } finally {
                    setSending(false);
                }
            }}
        >
            {/* honeypot anti-bots */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

            <div>
                <label className={labelCls}>Nombre y apellido *</label>
                <input name="full_name" required maxLength={120} className={inputCls} autoComplete="name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>WhatsApp *</label>
                    <input name="whatsapp" required maxLength={40} inputMode="tel" className={inputCls} placeholder="11 1234 5678" autoComplete="tel" />
                </div>
                <div>
                    <label className={labelCls}>Año de nacimiento</label>
                    <input name="birth_year" maxLength={4} inputMode="numeric" className={inputCls} placeholder="2003" />
                </div>
            </div>
            <div>
                <label className={labelCls}>¿En qué barrio/localidad vivís y cuánto tardás en llegar a Colegiales? *</label>
                <input name="location" required maxLength={200} className={inputCls} placeholder="Ej: Villa Urquiza, 20 min en bici" />
            </div>
            <div>
                <label className={labelCls}>¿Podés trabajar lunes a viernes de 9 a 18 hs y sábados de 9 a 13 hs? *</label>
                <YesNo name="available_schedule" value={schedule} onChange={setSchedule} />
            </div>
            <div>
                <label className={labelCls}>El trabajo requiere esfuerzo físico: cargar y mover muebles, caños y materiales pesados durante la jornada. ¿Estás en condiciones de hacerlo? *</label>
                <YesNo name="physical_ok" value={physical} onChange={setPhysical} />
            </div>
            <div>
                <label className={labelCls}>¿Tenés registro de conducir vigente? *</label>
                <div className="grid grid-cols-2 gap-2">
                    {[["auto", "Auto"], ["moto", "Moto"], ["ambos", "Ambos"], ["no", "No tengo"]].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setLicense(v)}
                            className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${license === v ? "bg-[#354763] text-white border-[#354763]" : "bg-white text-gray-600 border-gray-300"}`}>
                            {l}
                        </button>
                    ))}
                </div>
                <input type="hidden" name="drivers_license" value={license} />
            </div>
            <div>
                <label className={labelCls}>Contanos tu experiencia en trabajos anteriores *</label>
                <p className="text-xs text-gray-500 mb-1.5">Si es tu primer trabajo, no pasa nada — contanos qué hiciste (estudios, changas, proyectos propios).</p>
                <textarea name="experience" required maxLength={2000} rows={4} className={inputCls} />
            </div>
            <div>
                <label className={labelCls}>¿En qué creés que te destacás? *</label>
                <input name="strengths" required maxLength={1000} className={inputCls} placeholder="Ej: soy prolijo, aprendo rápido, no falto nunca…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Sueldo pretendido en mano *</label>
                    <input name="salary_expectation" required maxLength={100} className={inputCls} placeholder="$ mensual" />
                </div>
                <div>
                    <label className={labelCls}>¿Desde cuándo podés empezar? *</label>
                    <input name="start_date" required maxLength={100} className={inputCls} placeholder="Inmediato / desde el…" />
                </div>
            </div>
            <div>
                <label className={labelCls}>Adjuntá tu CV (PDF, opcional)</label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl px-4 py-5 text-sm text-gray-500 cursor-pointer hover:border-[#354763]/50 hover:text-[#354763]">
                    <input
                        type="file" name="cv" accept="application/pdf" className="hidden"
                        onChange={e => setCvName(e.target.files?.[0]?.name || "")}
                    />
                    {cvName ? <span className="font-semibold text-[#354763]">📄 {cvName}</span> : <span>Tocá para elegir el archivo (máx. 10 MB)</span>}
                </label>
                <p className="text-xs text-gray-400 mt-1">Si no lo tenés a mano, mandalo después: no es obligatorio.</p>
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>}

            <button
                type="submit" disabled={sending}
                className="w-full py-4 bg-[#354763] text-white font-bold text-sm tracking-widest uppercase rounded-xl hover:bg-[#2a3850] transition-colors disabled:opacity-60"
            >
                {sending ? "Enviando…" : "Enviar postulación"}
            </button>
        </form>
    );
}
