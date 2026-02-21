import Scene from "@/components/3d/Scene";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { Toolbar } from "@/components/ui/Toolbar";
import { Sidebar } from "@/components/ui/Sidebar";
import { DataLoader } from "@/components/DataLoader";
import { Suspense } from "react";

export default function Home() {
  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      <Suspense fallback={null}>
        <DataLoader />
      </Suspense>
      <Sidebar />
      <div className="flex-1 relative h-full">
        <Scene />
        <PriceDisplay />
        <Suspense fallback={null}>
          <Toolbar />
        </Suspense>
      </div>
    </div>
  );
}
