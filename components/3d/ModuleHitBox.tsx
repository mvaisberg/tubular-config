"use client";

import { ModuleConfig } from '@/lib/types';
import { useConfigStore } from '@/lib/store';
import { useState, useEffect } from 'react';
import { Html, Edges } from '@react-three/drei';
import { Plus, Trash2, Plug } from 'lucide-react';

const AddButton = ({ position, onClick, direction }: { position: [number, number, number], onClick: () => void, direction: string }) => {
    return (
        <Html position={position} center zIndexRange={[100, 0]}>
            <button
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#354763',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'background 0.15s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#2a3850')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#354763')}
            >
                <Plus size={16} color="#ffffff" strokeWidth={3} />
            </button>
        </Html>
    );
};

const DeleteButton = ({ position, onClick }: { position: [number, number, number], onClick: () => void }) => {
    return (
        <Html position={position} center zIndexRange={[100, 0]}>
            <button
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'background 0.15s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#dc2626')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#ef4444')}
            >
                <Trash2 size={16} color="#ffffff" strokeWidth={2.5} />
            </button>
        </Html>
    );
};

// Toggle de la chapa trasera con agujero pasacable. Mismo look que AddButton,
// pero con un enchufe: amarillo eléctrico cuando no está puesto, verde cuando está activo.
const CableHoleButton = ({ position, active, onClick }: { position: [number, number, number], active: boolean, onClick: () => void }) => {
    const baseColor = active ? '#22C55E' : '#FACC15';
    const hoverColor = active ? '#16A34A' : '#EAB308';
    return (
        <Html position={position} center zIndexRange={[100, 0]}>
            {/* key por estado: los handlers de hover escriben style.background directo al DOM
                y desincronizan el diff de React — remontar garantiza el color correcto. */}
            <button
                key={active ? 'on' : 'off'}
                title={active ? 'Sacar agujero pasacable' : 'Agregar agujero pasacable'}
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: baseColor,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'background 0.15s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = hoverColor)}
                onMouseOut={(e) => (e.currentTarget.style.background = baseColor)}
            >
                <Plug size={16} color="#1C1C1C" strokeWidth={2.5} />
            </button>
        </Html>
    );
};

export const ModuleHitBox = ({ module }: { module: ModuleConfig }) => {
    const selectedModuleId = useConfigStore((state) => state.selectedModuleId);
    const selectModule = useConfigStore((state) => state.actions.selectModule);
    const addModule = useConfigStore((state) => state.actions.addModule);
    const removeModule = useConfigStore((state) => state.actions.removeModule);
    const updateModule = useConfigStore((state) => state.actions.updateModule);
    const showToast = useConfigStore((state) => state.actions.showToast);
    const modules = useConfigStore((state) => state.modules);
    const showAddButtons = useConfigStore((state) => state.showAddButtons);
    const [hovered, setHovered] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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

        // Rule: all modules in the same column share width, all modules in the
        // same row share height. Inherit from existing peers in the target
        // column/row so we don't break that invariant.
        const peerInColumn = modules.find(m => Math.abs(m.position.x - newX) < 1);
        const peerInRow = modules.find(m => Math.abs(m.position.y - newY) < 1);
        const newSize = {
            w: peerInColumn ? peerInColumn.size.w : module.size.w,
            h: peerInRow ? peerInRow.size.h : module.size.h,
            d: module.size.d,
        };

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
                    showToast("Necesita un módulo de apoyo abajo para agregar acá.");
                    return;
                }
            }

            // If we are here, it's valid to add the single module
            if (!isOccupied(newX, newY, newZ)) {
                modulesToAdd.push({
                    id: crypto.randomUUID(),
                    position: { x: newX, y: newY, z: newZ },
                    size: newSize,
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
                    size: newSize,
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
    const frontZ = (z + d) * 0.001 + 0.04; // Bring entirely to the front

    const rightPos: [number, number, number] = [((x + w) * 0.001) + 0.02, cy, frontZ];
    const leftPos: [number, number, number] = [(x * 0.001) - 0.02, cy, frontZ];

    // Only allow deletion from extremes — never from the middle, since removing
    // a middle module would split the structure or leave modules unsupported.
    // A module is at an extreme iff: nothing rests on top of it AND it's at a
    // horizontal edge (no left neighbor or no right neighbor).
    const isExtreme = !hasTop && (!hasLeft || !hasRight);
    const showDeleteBtn = isSelected && modules.length > 1 && isExtreme;
    // Increased separation from 0.04 to 0.08
    const topPos: [number, number, number] = [showDeleteBtn ? cx - 0.08 : cx, ((y + h) * 0.001) + 0.02, frontZ];
    const topPosDel: [number, number, number] = [cx + 0.08, ((y + h) * 0.001) + 0.02, frontZ];

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
                    opacity={isSelected ? 0.12 : hovered ? 0.05 : 0}
                    wireframe={false}
                />
                {/* Outline de aristas: hace visible la selección incluso sobre acrílicos. */}
                {isSelected && <Edges color="#354763" lineWidth={2} />}
            </mesh>

            {(isMobile ? (isSelected || showAddButtons) : (isSelected || hovered)) && (
                <>
                    {!hasRight && (y === 0 || hasNeighbor(w, -h, 0)) && <AddButton position={rightPos} direction="right" onClick={() => handleAdd('right')} />}
                    {!hasLeft && (y === 0 || hasNeighbor(-w, -h, 0)) && <AddButton position={leftPos} direction="left" onClick={() => handleAdd('left')} />}
                    {!hasTop && <AddButton position={topPos} direction="top" onClick={() => handleAdd('top')} />}
                    {module.hasPanel.back && w === 750 && h === 350 && (
                        <CableHoleButton
                            position={[cx, cy, (z * 0.001) + 0.02]}
                            active={!!module.backPanelCableHole}
                            onClick={() => updateModule(module.id, { backPanelCableHole: !module.backPanelCableHole })}
                        />
                    )}
                </>
            )}

            {showDeleteBtn && (
                <DeleteButton position={topPosDel} onClick={() => removeModule(module.id)} />
            )}
        </group>
    );
};
