"use client";

import { useConfigStore } from '@/lib/store';
import { useRef, useEffect, Suspense } from 'react';
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { RoomEnvironment } from "./RoomEnvironment";
import { FurnitureController } from "./FurnitureController";

const CameraController = () => {
    // ... existing CameraController ...
    const cameraResetVersion = useConfigStore((state) => state.cameraResetVersion);
    const controlsRef = useRef<any>(null);

    useEffect(() => {
        if (cameraResetVersion > 0 && controlsRef.current) {
            controlsRef.current.reset();
            // Reset target to our preferred center if orbit reset doesn't preserve it
            controlsRef.current.target.set(0, 0.4, 0);
        }
    }, [cameraResetVersion]);

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            maxPolarAngle={Math.PI / 2 - 0.05}
            minPolarAngle={0}
            target={[0, 0.4, 0]}
        />
    );
};

export default function Scene() {
    const selectModule = useConfigStore((state) => state.actions.selectModule);
    return (
        <div className="w-full h-full">
            <Canvas shadows camera={{ position: [2, 2, 2], fov: 50 }} onPointerMissed={() => selectModule(null)}>
                <Suspense fallback={null}>
                    <RoomEnvironment />
                    <CameraController />

                    {/* USM feet raise the unit by ~35-40mm. Shifting up so y=0 is floor. */}
                    <group position={[0, 0.035, 0]}>
                        <FurnitureController />
                    </group>
                </Suspense>
            </Canvas>
        </div>
    );
}
