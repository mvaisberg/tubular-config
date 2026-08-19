import { createClient } from "@/lib/supabase/server";
import PartsTable from "@/components/admin/PartsTable";
import ProfitAnalyzer from "@/components/admin/ProfitAnalyzer";
import PnLReport from "@/components/admin/PnLReport";
import BillingSimulator from "@/components/admin/BillingSimulator";

function Section({ num, title, desc, children }: {
    num: string; title: string; desc: string; children: React.ReactNode;
}) {
    return (
        <section>
            <div className="flex items-start gap-3 mb-3">
                <span className="w-7 h-7 shrink-0 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center">{num}</span>
                <div>
                    <h2 className="text-lg font-semibold tracking-tight text-gray-900 leading-7">{title}</h2>
                    <p className="text-sm text-gray-500">{desc}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

export default async function PartsPage() {
    const supabase = await createClient();
    const { data: parts } = await supabase.from("parts").select("*").order("sku");
    const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).single();
    const { data: fixedCosts } = await supabase.from("fixed_costs").select("id, name, amount").order("amount", { ascending: false });

    return (
        <div className="space-y-10 pb-32">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Parts & Costs</h1>
                <p className="text-sm text-gray-500 mt-1">Costos, rentabilidad y simulación</p>
            </header>

            {/* Sólo admins llegan a esta ruta (middleware) — análisis con impuestos y márgenes reales */}
            <Section
                num="1"
                title="Rentabilidad por canal"
                desc="Análisis real de UNA venta: pegá un link del configurador o un SKU del catálogo y mirá qué te queda vendiéndola facturada con tarjeta vs en efectivo, con el despiece de partes."
            >
                <ProfitAnalyzer partsData={parts || []} settings={settings || { usd_exchange_rate: 1530, profit_margin: 70 }} />
            </Section>

            <Section
                num="2"
                title="Cuadro de resultados"
                desc="Lo que pasó DE VERDAD en un período: todos los pedidos del manager (Woo + manuales), sus costos variables reales por canal, los fijos de la estructura y el resultado."
            >
                <PnLReport />
            </Section>

            <Section
                num="3"
                title="Simulador de facturación"
                desc="Escenario hipotético: ingresá cuánto facturarías por mes en cada combinación de material y medio de cobro, y mirá cuánto quedaría después de todos los costos."
            >
                <BillingSimulator
                    settings={settings || { usd_exchange_rate: 1530, profit_margin: 70 }}
                    fixedCosts={fixedCosts || []}
                />
            </Section>

            <Section
                num="4"
                title="Partes y costos"
                desc="El catálogo de piezas con su costo de compra: acá se cargan los precios que alimentan todos los cálculos de arriba."
            >
                <PartsTable initialParts={parts || []} />
            </Section>
        </div>
    );
}
