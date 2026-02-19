"use client";

import { ModuleConfig } from '@/lib/types';
import { useConfigStore } from '@/lib/store';
import { useRef, useState } from 'react';

export const ModuleHitBox = ({ module }: { module: ModuleConfig }) => {
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);
    const selectModule = useConfigStore((state) => state.actions.selectModule);
    const [hovered, setHovered] = useState(false);

    const isSelected = selectedModuleId === module.id;

    const { x, y, z } = module.position;
    const { w, h, d } = module.size;

    // Center position
    const cx = (x + w / 2) * 0.001;
    const cy = (y + h / 2) * 0.001;
    const cz = (z + d / 2) * 0.001;

    // Dimensions
    const args: [number, number, number] = [w * 0.001, h * 0.001, d * 0.001];

    return (
        <mesh
            position={[cx, cy, cz]}
            onClick={(e) => {
                e.stopPropagation();
                selectModule(module.id);
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
            }}
            onPointerOut={(e) => {
                setHovered(false);
            }}
        >
            <boxGeometry args={args} />
            <meshBasicMaterial
                color={isSelected ? "#00ff00" : "#0000ff"}
                transparent
                opacity={isSelected ? 0.1 : hovered ? 0.05 : 0}
                wireframe={isSelected}
            />
        </mesh>
    );
};
