import Scene from "@/components/3d/Scene";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { Toolbar } from "@/components/ui/Toolbar";

import { Sidebar } from "@/components/ui/Sidebar";

export default function Home() {
  return (
    <div className="w-full h-screen bg-white">
      <Sidebar />
      <Scene />
      <PriceDisplay />
      <Toolbar />
    </div>
  );
}
