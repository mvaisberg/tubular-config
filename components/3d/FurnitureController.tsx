"use client";

import { useConfigStore } from '@/lib/store';
import { generateParts } from '@/lib/calculator';
import { useMemo, useEffect } from 'react';
import { Ball } from './parts/Ball';
import { Tube } from './parts/Tube';
import { Panel } from './parts/Panel';
import { ModuleHitBox } from './ModuleHitBox';
import { DerivedPart } from '@/lib/types';
import { Line, Text, Billboard } from '@react-three/drei';

export const FurnitureController = () => {
    const modules = useConfigStore((state) => state.modules);
    const addModule = useConfigStore((state) => state.actions.addModule);
    const fetchPartsData = useConfigStore((state) => state.actions.fetchPartsData);
    const fetchSettings = useConfigStore((state) => state.actions.fetchSettings);
    const showDimensions = useConfigStore((state) => state.showDimensions);

    // Initial seed
    useEffect(() => {
        fetchPartsData(); // Fetch prices
        fetchSettings(); // Fetch costs/margins
    }, []); // Run once on mount

    const parts = useMemo(() => generateParts(modules), [modules]);

    // Calculate bounds of modules to keep assembly centered in view and to draw dimensions
    const bounds = useMemo(() => {
        if (modules.length === 0) return null;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        modules.forEach(mod => {
            minX = Math.min(minX, mod.position.x);
            maxX = Math.max(maxX, mod.position.x + mod.size.w);
            minY = Math.min(minY, mod.position.y);
            maxY = Math.max(maxY, mod.position.y + mod.size.h);
            minZ = Math.min(minZ, mod.position.z);
            maxZ = Math.max(maxZ, mod.position.z + mod.size.d);
        });

        const centerX = -((minX + maxX) / 2) * 0.001;
        const centerZ = -((minZ + maxZ) / 2) * 0.001;

        return {
            minX: minX * 0.001,
            maxX: maxX * 0.001,
            minY: minY * 0.001,
            maxY: maxY * 0.001,
            minZ: minZ * 0.001,
            maxZ: maxZ * 0.001,
            width: maxX - minX,
            height: (maxY - minY) + 40,
            depth: maxZ - minZ,
            centerX,
            centerZ
        };
    }, [modules]);

    return (
        <group position={[bounds?.centerX || 0, 0, bounds?.centerZ || 0]}>
            {parts.map((part: DerivedPart) => {
                if (part.type === 'ball') {
                    return <Ball key={part.id} position={part.position} hasFoot={part.hasFoot} />;
                }
                if (part.type === 'tube') {
                    return (
                        <Tube
                            key={part.id}
                            position={part.position}
                            length={part.length || 0}
                            orientation={(part.orientation as any) || 'y'}
                        />
                    );
                }
                if (part.type === 'panel') {
                    // cast orientation to specific panel type
                    const orient = part.orientation as 'xy' | 'xz' | 'yz';
                    return (
                        <Panel
                            key={part.id}
                            position={part.position}
                            orientation={orient}
                            width={part.dimensions?.width || 0}
                            height={part.dimensions?.height || 0}
                            color={part.color}
                        />
                    );
                }
                return null;
            })}

            {/* HitBoxes for selection */}
            {modules.map((mod) => (
                <ModuleHitBox key={mod.id} module={mod} />
            ))}

            {/* Overall Dimensions Overlay */}
            {showDimensions && bounds && (
                <group>
                    {/* Width line (front bottom edge) */}
                    <mesh position={[(bounds.minX + bounds.maxX) / 2, bounds.minY + 0.01, bounds.maxZ + 0.06]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.002, 0.002, bounds.maxX - bounds.minX]} />
                        <meshBasicMaterial color="#354763" />
                    </mesh>
                    <Billboard position={[(bounds.minX + bounds.maxX) / 2, bounds.minY + 0.01, bounds.maxZ + 0.12]}>
                        <Text fontSize={0.05} color="#354763" outlineWidth={0.002} outlineColor="white">
                            {bounds.width}mm
                        </Text>
                    </Billboard>

                    {/* Height line (left front edge) */}
                    <mesh position={[bounds.minX - 0.06, (bounds.minY + bounds.maxY) / 2, bounds.maxZ + 0.06]}>
                        <cylinderGeometry args={[0.002, 0.002, bounds.maxY - bounds.minY]} />
                        <meshBasicMaterial color="#354763" />
                    </mesh>
                    <Billboard position={[bounds.minX - 0.12, (bounds.minY + bounds.maxY) / 2, bounds.maxZ + 0.06]}>
                        <Text fontSize={0.05} color="#354763" outlineWidth={0.002} outlineColor="white">
                            {bounds.height}mm
                        </Text>
                    </Billboard>

                    {/* Depth line (right bottom edge) */}
                    <mesh position={[bounds.maxX + 0.06, bounds.minY + 0.01, (bounds.minZ + bounds.maxZ) / 2]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.002, 0.002, bounds.maxZ - bounds.minZ]} />
                        <meshBasicMaterial color="#354763" />
                    </mesh>
                    <Billboard position={[bounds.maxX + 0.12, bounds.minY + 0.01, (bounds.minZ + bounds.maxZ) / 2]}>
                        <Text fontSize={0.05} color="#354763" outlineWidth={0.002} outlineColor="white">
                            {bounds.depth}mm
                        </Text>
                    </Billboard>
                </group>
            )}
        </group>
    );
};
