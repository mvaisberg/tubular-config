import Scene from "@/components/3d/Scene";
import { Toolbar } from "@/components/ui/Toolbar";
import { Sidebar } from "@/components/ui/Sidebar";
import { Toast } from "@/components/ui/Toast";
import { FirstVisitHint } from "@/components/ui/FirstVisitHint";
import { DataLoader } from "@/components/DataLoader";
import { SceneLoader } from "@/components/ui/SceneLoader";
import { MetaTracker } from "@/components/MetaTracker";
import { ConfiguratorTracker } from "@/components/ConfiguratorTracker";
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tubular.com.ar';
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-white overflow-hidden">
      {/* Top nav bar */}
      <div className="flex items-center px-4 py-2 bg-white border-b border-gray-100 shrink-0 z-50">
        <a href={siteUrl} className="flex items-center gap-1 text-xs uppercase tracking-wider text-gray-500 hover:text-gray-900 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Volver a la tienda
        </a>
      </div>
      <Suspense fallback={null}>
        <DataLoader />
      </Suspense>
      <MetaTracker />
      <Suspense fallback={null}>
        <ConfiguratorTracker />
      </Suspense>
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <div className="flex-1 relative shrink min-h-0">
          <Scene />
          <SceneLoader />
          <Toast />
          <FirstVisitHint />
          <Suspense fallback={null}>
            <Toolbar />
          </Suspense>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
