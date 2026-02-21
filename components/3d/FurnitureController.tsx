"use client";

import { useConfigStore } from '@/lib/store';
import { generateParts } from '@/lib/calculator';
import { useMemo, useEffect } from 'react';
import { Ball } from './parts/Ball';
import { Tube } from './parts/Tube';
import { Panel } from './parts/Panel';
import { ModuleHitBox } from './ModuleHitBox';
import { DerivedPart } from '@/lib/types';

export const FurnitureController = () => {
    const modules = useConfigStore((state) => state.modules);
    const addModule = useConfigStore((state) => state.actions.addModule);
    const fetchPartsData = useConfigStore((state) => state.actions.fetchPartsData);
    const fetchSettings = useConfigStore((state) => state.actions.fetchSettings);

    // Initial seed
    useEffect(() => {
        fetchPartsData(); // Fetch prices
        fetchSettings(); // Fetch costs/margins
    }, []); // Run once on mount

    const parts = useMemo(() => generateParts(modules), [modules]);

    // Calculate center of modules to keep assembly centered in view
    const centerOffset = useMemo(() => {
        if (modules.length === 0) return { x: 0, z: 0 };

        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        modules.forEach(mod => {
            minX = Math.min(minX, mod.position.x);
            maxX = Math.max(maxX, mod.position.x + mod.size.w);
            minZ = Math.min(minZ, mod.position.z);
            maxZ = Math.max(maxZ, mod.position.z + mod.size.d);
        });

        return {
            x: -((minX + maxX) / 2) * 0.001,
            z: -((minZ + maxZ) / 2) * 0.001
        };
    }, [modules]);

    return (
        <group position={[centerOffset.x, 0, centerOffset.z]}>
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
        </group>
    );
};
