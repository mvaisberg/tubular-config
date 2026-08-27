import type { Metadata } from "next";
import { Suspense } from "react";
import JobApplicationForm from "@/components/JobApplicationForm";

// Página oculta: solo se llega con el link directo (redes). Sin index ni menú.
export const metadata: Metadata = {
    title: "Trabajá en Tubular — Operario/a de Producción y Armado",
    robots: { index: false, follow: false },
};

export default function TrabajaPage() {
    return (
        <main className="min-h-screen bg-[#faf9f6]">
            <div className="max-w-2xl mx-auto px-5 py-10 md:py-16">
                {/* Marca */}
                <div className="mb-10">
                    <span className="text-2xl font-black tracking-tight text-[#354763]">tubular<span className="align-super text-[10px]">™</span></span>
                </div>

                {/* La propuesta */}
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#354763]/60 mb-2">Búsqueda laboral</p>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#354763] leading-tight">
                    Operario/a de Producción y Armado
                </h1>
                <p className="text-sm font-semibold text-[#354763]/70 mt-2">Colegiales, CABA · Presencial · Jornada completa</p>

                <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-gray-700">
                    <p>
                        Buscamos sumar una persona a nuestro taller de muebles de diseño en Colegiales.
                        Fabricamos muebles modulares de acero y acrílico con un sistema constructivo propio
                        — un oficio que se aprende acá adentro.
                    </p>
                    <p>
                        El día a día: armado de muebles, preparación de pedidos, orden del depósito y
                        recepción de materiales. El ambiente de trabajo es agradable, las relaciones
                        laborales son buenas, y se trabaja a buen ritmo.
                    </p>
                    <ul className="space-y-1.5 text-sm">
                        <li>• <b>Horario:</b> lunes a viernes de 9 a 18 hs, sábados de 9 a 13 hs</li>
                        <li>• <b>Zona:</b> Colegiales, CABA</li>
                        <li>• <b>Perfil:</b> con ganas de aprender y de trabajar — no hace falta experiencia previa</li>
                        <li>• El trabajo requiere esfuerzo físico (cargar y mover muebles y materiales)</li>
                    </ul>
                    <p className="text-sm text-gray-500">
                        Completá el formulario (toma 3 minutos). Si tu perfil avanza, te llamamos dentro de la semana.
                    </p>
                </div>

                <div className="mt-8">
                    <Suspense fallback={null}>
                        <JobApplicationForm />
                    </Suspense>
                </div>
            </div>
        </main>
    );
}
