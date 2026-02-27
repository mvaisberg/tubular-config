import Scene from "@/components/3d/Scene";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { Toolbar } from "@/components/ui/Toolbar";
import { Sidebar } from "@/components/ui/Sidebar";
import { DataLoader } from "@/components/DataLoader";
import { Suspense } from "react";
import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

export async function generateMetadata({ searchParams }: { searchParams: { quote?: string } }): Promise<Metadata> {
  const quoteId = searchParams.quote;

  if (quoteId) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase.from('quotes').select('configuration').eq('id', quoteId).single();

      const imageUrl = data?.configuration?.image_url;
      if (imageUrl) {
        return {
          title: "Diseño Tubular",
          description: "Mira este diseño de mueble personalizado.",
          openGraph: {
            title: "Diseño Tubular",
            description: "Mira este diseño de mueble personalizado.",
            images: [
              {
                url: imageUrl,
                width: 1200,
                height: 630,
                alt: "Mueble Tubular Personalizado",
              },
            ],
          },
        };
      }
    }
  }

  return {
    title: "Tubular - Configurator",
    description: "Configurador 3D de muebles",
  };
}

export default function Home() {
  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-white overflow-hidden">
      <Suspense fallback={null}>
        <DataLoader />
      </Suspense>
      <div className="flex-1 relative h-[55dvh] md:h-full shrink-0 md:shrink">
        <Scene />
        <PriceDisplay />
        <Suspense fallback={null}>
          <Toolbar />
        </Suspense>
      </div>
      <Sidebar />
    </div>
  );
}
