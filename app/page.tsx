import Scene from "@/components/3d/Scene";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { Toolbar } from "@/components/ui/Toolbar";

import { Sidebar } from "@/components/ui/Sidebar";

export default function Home() {
  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 relative h-full">
        <Scene />
        <PriceDisplay />
        <Toolbar />
      </div>
    </div>
  );
}
