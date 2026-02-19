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

    // Initial seed for testing
    useEffect(() => {
        fetchPartsData(); // Fetch prices

        if (modules.length === 0) {
            addModule({
                id: 'init-1',
                position: { x: 0, y: 0, z: 0 },
                size: { w: 750, h: 350, d: 350 },
                color: 'white',
                hasPanel: { top: true, bottom: true, left: true, right: true, front: false, back: true }
            });
            addModule({
                id: 'init-2',
                position: { x: 750, y: 0, z: 0 },
                size: { w: 750, h: 350, d: 350 },
                color: 'blue',
                hasPanel: { top: true, bottom: true, left: true, right: true, front: true, back: true }
            });
        }
    }, [addModule, modules.length]);

    const parts = useMemo(() => generateParts(modules), [modules]);

    return (
        <group>
            {parts.map((part: DerivedPart) => {
                if (part.type === 'ball') {
                    return <Ball key={part.id} position={part.position} />;
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
