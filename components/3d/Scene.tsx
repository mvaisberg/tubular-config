"use client";

import { useConfigStore } from '@/lib/store';
import { useRef, useEffect, Suspense, useState } from 'react';
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { RoomEnvironment } from "./RoomEnvironment";
import { FurnitureController } from "./FurnitureController";
import * as THREE from 'three';

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
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div className="w-full h-full">
            <Canvas
                shadows
                gl={{
                    preserveDrawingBuffer: true,
                    antialias: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.0,
                }}
                camera={{ position: isMobile ? [1.1, 1.1, 1.1] : [1.4, 1.4, 1.4], fov: 50 }}
                onPointerMissed={() => selectModule(null)}
            >
                <Suspense fallback={null}>
                    <RoomEnvironment />
                    <CameraController />

                    <FurnitureController />
                </Suspense>
            </Canvas>
        </div>
    );
}
