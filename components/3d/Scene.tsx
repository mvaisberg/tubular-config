"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import { FurnitureController } from "./FurnitureController";

export default function Scene() {
    return (
        <div className="w-full h-full">
            <Canvas shadows camera={{ position: [2, 2, 2], fov: 50 }}>
                <Suspense fallback={null}>
                    <Environment preset="studio" />
                    <ambientLight intensity={0.5} />
                    <OrbitControls makeDefault />

                    {/* Floor */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
                        <planeGeometry args={[10, 10]} />
                        <meshStandardMaterial color="#f0f0f0" />
                    </mesh>

                    {/* Placeholder Cube */}
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[0.75, 0.35, 0.35]} />
                        <meshStandardMaterial color="orange" />
                    </mesh>

                    {/* Added FurnitureController based on instruction */}
                    {/* Note: The instruction's snippet contained an extra `</mesh>` which has been omitted to maintain syntax correctness. */}
                    <FurnitureController />

                </Suspense>
            </Canvas>
        </div>
    );
}
