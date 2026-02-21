"use client";

import { useConfigStore } from '@/lib/store';
import { Environment } from '@react-three/drei';

export const RoomEnvironment = () => {
    const environment = useConfigStore((state) => state.environment);

    if (environment === 'none') {
        return (
            <>
                <Environment preset="studio" />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
                    <planeGeometry args={[20, 20]} />
                    <meshStandardMaterial color="#f0f0f0" roughness={1} />
                </mesh>
            </>
        );
    }

    if (environment === 'modern') {
        return (
            <group>
                <Environment preset="apartment" />

                {/* Floor: Light Wood */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
                    <planeGeometry args={[20, 20]} />
                    <meshStandardMaterial color="#e8e0d5" roughness={0.8} metalness={0.1} />
                </mesh>

                {/* Corner Walls */}
                <group position={[0, 0, -0.5]}>
                    {/* Back Wall */}
                    <mesh position={[0, 2.5, 0]} receiveShadow>
                        <planeGeometry args={[10, 5]} />
                        <meshStandardMaterial color="#fafafa" />
                    </mesh>
                    {/* Left Wall */}
                    <mesh rotation={[0, Math.PI / 2, 0]} position={[-5, 2.5, 5]} receiveShadow>
                        <planeGeometry args={[10, 5]} />
                        <meshStandardMaterial color="#f0f0f0" />
                    </mesh>
                </group>

                {/* Warm Lighting from side */}
                <pointLight position={[3, 4, 3]} intensity={40} color="#ffdfba" castShadow shadow-mapSize={[1024, 1024]} />
                <ambientLight intensity={0.7} />
            </group>
        );
    }

    if (environment === 'industrial') {
        return (
            <group>
                <Environment preset="warehouse" />

                {/* Floor: Polished Concrete */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
                    <planeGeometry args={[20, 20]} />
                    <meshStandardMaterial color="#333333" roughness={0.1} metalness={0.5} />
                </mesh>

                {/* Back Wall: Concrete / Dark */}
                <mesh position={[0, 2.5, -1]} receiveShadow>
                    <planeGeometry args={[10, 5]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
                </mesh>

                {/* Contrast Lighting */}
                <spotLight position={[4, 6, 4]} angle={0.4} penumbra={1} intensity={80} castShadow shadow-mapSize={[1024, 1024]} />
                <ambientLight intensity={0.3} />
            </group>
        );
    }

    return null;
};
