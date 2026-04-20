import { useMemo } from 'react';

export const Ball = ({ position, hasFoot, useWheel }: { position: [number, number, number], hasFoot?: boolean, useWheel?: boolean }) => {
    // scale down: mm -> m
    const pos: [number, number, number] = [position[0] * 0.001, position[1] * 0.001, position[2] * 0.001];

    // USM ball: 25mm diameter (sphere radius 12.5mm = 0.0125m)
    // Foot (plastic): stem 10mm diameter × 20mm high + base 30mm × 5mm
    // Wheel (USM caster, approximate): chrome stem + black cylindrical housing with rubber tread

    return (
        <group position={pos}>
            <mesh castShadow receiveShadow>
                <sphereGeometry args={[0.0125, 32, 32]} />
                <meshPhysicalMaterial
                    color="#e8e8e8"
                    metalness={1.0}
                    roughness={0.15}
                    clearcoat={0.3}
                    clearcoatRoughness={0.1}
                    envMapIntensity={1.2}
                />
            </mesh>
            {hasFoot && !useWheel && (
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
            {hasFoot && useWheel && (
                <group position={[0, -0.0125, 0]}>
                    {/* Chrome stem from ball to caster housing */}
                    <mesh position={[0, -0.008, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.006, 0.006, 0.016, 16]} />
                        <meshPhysicalMaterial color="#d9d9d9" metalness={1.0} roughness={0.18} clearcoat={0.3} />
                    </mesh>
                    {/* Caster housing (black cylindrical body) */}
                    <mesh position={[0, -0.022, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.02, 0.02, 0.012, 32]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.2} />
                    </mesh>
                    {/* Wheel tread (thicker torus/cylinder lying on side at the bottom) */}
                    <mesh position={[0, -0.034, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.018, 0.018, 0.022, 32]} />
                        <meshStandardMaterial color="#0f0f0f" roughness={0.7} metalness={0.1} />
                    </mesh>
                </group>
            )}
        </group>
    );
};
