import { Instance, Instances } from '@react-three/drei';
import { useMemo } from 'react';

// Using Instances for performance if we have many balls
export const Ball = ({ position, hasFoot }: { position: [number, number, number], hasFoot?: boolean }) => {
    // scale down: mm -> m
    const pos: [number, number, number] = [position[0] * 0.001, position[1] * 0.001, position[2] * 0.001];

    // USM Foot approximate dimensions
    // Stem: 10mm diameter, 20mm height
    // Base: 30mm diameter, 5mm height
    // Offset: attached to bottom of sphere radius (12.5mm)

    return (
        <group position={pos}>
            <mesh castShadow receiveShadow>
                <sphereGeometry args={[0.0125, 32, 32]} />
                <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.05} />
            </mesh>
            {hasFoot && (
                <group position={[0, -0.0125, 0]}>
                    <mesh position={[0, -0.01, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.005, 0.005, 0.02, 12]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>
                    <mesh position={[0, -0.02, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.015, 0.015, 0.005, 32]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>
                </group>
            )}
        </group>
    );
};
