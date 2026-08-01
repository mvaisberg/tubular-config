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
                    {/* Chrome stem from ball to caster hood */}
                    <mesh position={[0, -0.007, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.006, 0.006, 0.014, 16]} />
                        <meshPhysicalMaterial color="#d9d9d9" metalness={1.0} roughness={0.18} clearcoat={0.3} />
                    </mesh>
                    {/* USM caster: capucha cromada (domo + faldón) que cubre la mitad
                        superior de la rueda; la rueda negra asoma por debajo.
                        Leve offset horizontal para el look de rueda giratoria (trail). */}
                    {/* Swivel del caster: giro que deja la cara redonda de la rueda
                        mirando hacia la cámara (no el canto) */}
                    <group rotation={[0, Math.PI * 0.38, 0]}>
                        {/* Dome (flattened top hemisphere) */}
                        <mesh position={[0, -0.022, 0]} scale={[1, 0.65, 1]} castShadow receiveShadow>
                            <sphereGeometry args={[0.021, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                            <meshPhysicalMaterial color="#d9d9d9" metalness={1.0} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.1} envMapIntensity={1.2} side={2} />
                        </mesh>
                        {/* Skirt (short cylindrical band under the dome) */}
                        <mesh position={[0, -0.027, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[0.021, 0.021, 0.010, 32, 1, true]} />
                            <meshPhysicalMaterial color="#d9d9d9" metalness={1.0} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.1} envMapIntensity={1.2} side={2} />
                        </mesh>
                        {/* Black wheel: axle offset from the stem (swivel trail) so it peeks
                            out from under the hood, lower half clearly visible */}
                        <mesh position={[0, -0.034, 0.009]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                            <cylinderGeometry args={[0.020, 0.020, 0.016, 32]} />
                            <meshStandardMaterial color="#111111" roughness={0.6} metalness={0.1} />
                        </mesh>
                    </group>
                </group>
            )}
        </group>
    );
};
