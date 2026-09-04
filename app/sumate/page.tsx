import type { Metadata } from "next";
import { Suspense } from "react";
import CollaboratorForm from "@/components/CollaboratorForm";

// Página oculta: se llega con el link directo. Sin index ni menú.
export const metadata: Metadata = {
    title: "Sumate a Tubular",
    robots: { index: false, follow: false },
};

export default function SumatePage() {
    return (
        <main className="min-h-screen bg-[#faf9f6]">
            <div className="max-w-2xl mx-auto px-5 py-10 md:py-16">
                <div className="mb-10">
                    <span className="text-2xl font-black tracking-tight text-[#354763]">tubular<span className="align-super text-[10px]">™</span></span>
                </div>

                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#354763]/60 mb-2">Sumate</p>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#354763] leading-tight">
                    Trabajemos juntos
                </h1>
                <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-gray-700">
                    <p>
                        Fabricamos muebles modulares de diseño en acero y acrílico, en nuestro taller de
                        Colegiales. Si te interesa sumarte —trabajando con nosotros o haciendo contenido—
                        dejanos tus datos y quedás en nuestra base.
                    </p>
                    <p className="text-sm text-gray-500">
                        No es una búsqueda abierta: es una base que miramos cuando necesitamos a alguien
                        o armamos una acción. Toma 2 minutos.
                    </p>
                </div>

                <div className="mt-8">
                    <Suspense fallback={null}>
                        <CollaboratorForm />
                    </Suspense>
                </div>
            </div>
        </main>
    );
}
