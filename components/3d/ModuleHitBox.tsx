"use client";

import { ModuleConfig } from '@/lib/types';
import { useConfigStore } from '@/lib/store';
import { useRef, useState, useEffect } from 'react';
import { Billboard, Text } from '@react-three/drei';

const AddButton = ({ position, onClick, direction }: { position: [number, number, number], onClick: () => void, direction: string }) => {
    const [hovered, setHovered] = useState(false);

    useEffect(() => {
        if (hovered) document.body.style.cursor = 'pointer';
        else document.body.style.cursor = 'auto';
        return () => { document.body.style.cursor = 'auto'; };
    }, [hovered]);

    return (
        <Billboard position={position}>
            <group
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={(e) => {
                    setHovered(false);
                }}
            >
                <mesh>
                    {/* Radius 0.04m = 80mm diameter */}
                    <circleGeometry args={[0.04, 32]} />
                    <meshBasicMaterial
                        color={hovered ? "#2a3850" : "#354763"}
                        transparent
                        opacity={0.9}
                    />
                </mesh>
                <Text
                    position={[0, 0, 0.001]}
                    fontSize={0.06}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                >
                    +
                </Text>
            </group>
        </Billboard>
    );
};

export const ModuleHitBox = ({ module }: { module: ModuleConfig }) => {
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);
    const selectModule = useConfigStore((state) => state.actions.selectModule);
    const addModule = useConfigStore((state) => state.actions.addModule);
    const modules = useConfigStore((state) => state.modules);
    const [hovered, setHovered] = useState(false);

    const isSelected = selectedModuleId === module.id;

    const { x, y, z } = module.position;
    const { w, h, d } = module.size;

    // Helper to check neighbor
    const hasNeighbor = (dx: number, dy: number, dz: number) => {
        const tx = x + dx;
        const ty = y + dy;
        const tz = z + dz;
        return modules.some(m =>
            Math.abs(m.position.x - tx) < 1 &&
            Math.abs(m.position.y - ty) < 1 &&
            Math.abs(m.position.z - tz) < 1
        );
    };

    const hasRight = hasNeighbor(w, 0, 0);
    const hasLeft = hasNeighbor(-w, 0, 0); // Assuming standard size neighbors
    const hasTop = hasNeighbor(0, h, 0);
    // const hasBottom = hasNeighbor(0, -h, 0);
    // const hasFront = hasNeighbor(0, 0, d);

    const handleAdd = (direction: 'left' | 'right' | 'top') => {
        let newX = x;
        let newY = y;
        let newZ = z;

        if (direction === 'left') newX -= w;
        if (direction === 'right') newX += w;
        if (direction === 'top') newY += h;

        // Rule: Can't add side module if no support below (unless on floor).
        // If supporting column is missing, fill it down to y=0.

        const modulesToAdd: ModuleConfig[] = [];

        // Function to check if a spot is occupied in our modules list OR inside our temporary list
        const isOccupied = (tx: number, ty: number, tz: number) => {
            return modules.some(m =>
                Math.abs(m.position.x - tx) < 1 &&
                Math.abs(m.position.y - ty) < 1 &&
                Math.abs(m.position.z - tz) < 1
            ) || modulesToAdd.some(m =>
                Math.abs(m.position.x - tx) < 1 &&
                Math.abs(m.position.y - ty) < 1 &&
                Math.abs(m.position.z - tz) < 1
            );
        };

        // If adding to side (left/right), check for support below
        if (direction === 'left' || direction === 'right') {
            // Must be on floor OR have a module below it.
            // newY === 0 is floor.
            if (newY > 0) {
                // Check if there is a module at [newX, newY - h, newZ]
                const hasSupport = isOccupied(newX, newY - h, newZ);
                if (!hasSupport) {
                    // Can't add!
                    // Maybe could use a toast here ideally.
                    console.warn("Cannot add lateral module without support below.");
                    alert("Cannot add lateral module without support below.");
                    return;
                }
            }

            // If we are here, it's valid to add the single module
            if (!isOccupied(newX, newY, newZ)) {
                modulesToAdd.push({
                    id: crypto.randomUUID(),
                    position: { x: newX, y: newY, z: newZ },
                    size: { ...module.size },
                    color: module.color,
                    material: module.material,
                    hasPanel: { ...module.hasPanel }
                });
            }
        }

        // If adding top, just add one on top (support is guaranteed by current module)
        if (direction === 'top') {
            if (!isOccupied(newX, newY, newZ)) {
                modulesToAdd.push({
                    id: crypto.randomUUID(),
                    position: { x: newX, y: newY, z: newZ },
                    size: { ...module.size },
                    color: module.color,
                    material: module.material,
                    hasPanel: { ...module.hasPanel }
                });
            }
        }

        // Add all calculated modules
        modulesToAdd.forEach(m => addModule(m));
    };

    // Center position for HitBox
    const cx = (x + w / 2) * 0.001;
    const cy = (y + h / 2) * 0.001;
    const cz = (z + d / 2) * 0.001;

    // Button positions (meters)
    // Right: cx + w/2 + offset
    const rightPos: [number, number, number] = [((x + w) * 0.001), cy, cz];
    const leftPos: [number, number, number] = [(x * 0.001), cy, cz];
    const topPos: [number, number, number] = [cx, ((y + h) * 0.001), cz];

    // Dimensions
    const args: [number, number, number] = [w * 0.001, h * 0.001, d * 0.001];

    return (
        <group>
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
                    color="#354763"
                    transparent
                    opacity={isSelected ? 0.15 : hovered ? 0.05 : 0}
                    wireframe={isSelected}
                />
            </mesh>

            {(isSelected || hovered) && (
                <>
                    {!hasRight && (y === 0 || hasNeighbor(w, -h, 0)) && <AddButton position={rightPos} direction="right" onClick={() => handleAdd('right')} />}
                    {!hasLeft && (y === 0 || hasNeighbor(-w, -h, 0)) && <AddButton position={leftPos} direction="left" onClick={() => handleAdd('left')} />}
                    {!hasTop && <AddButton position={topPos} direction="top" onClick={() => handleAdd('top')} />}
                </>
            )}
        </group>
    );
};
