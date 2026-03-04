import { useRef, useMemo } from 'react';

interface PanelProps {
    position: [number, number, number];
    orientation: 'xy' | 'xz' | 'yz';
    dimension: number; // width for xy/xz, height for yz
    // We need both dimensions!
    // derivedPart structure in types.ts only has 'dimension' which is ambiguous.
    // I need to update types.ts to support width/height or separate props.
    // For now, let's infer or pass it through.
    // In calculator.ts I passed `dimension: w_dim`. I lost the other dimension.
    // I should fix types.ts first or hack it.
    // Let's assume the ID contains dimensions? `panel-{plane}-{x}-{y}-{z}-{w}-{h}`
    // But better to pass it in props.
    // I'll update types.ts to allow extra data or dimensions object.

    // TEMPORARY HACK: I'll use the id to parse dimensions if needed, OR better, update the type.
    // I will look at how I implemented generateParts in calculator.ts. I passed `dimension: w_dim`. I missed h_dim.

    // I will assume for now I receive w and h as separate props if I update types.
    // But let's look at the props I *can* pass.
    // DerivedPart has: id, type, position, rotation, length, orientation, dimension, color.
}

// I need to fix types.ts and calculator.ts to include full dimensions for panels.
// Let's do that in next step. For now, this is a placeholder.

export const Panel = ({ position, orientation, width, height, color = 'white' }: { position: [number, number, number], orientation: 'xy' | 'xz' | 'yz', width: number, height: number, color?: string }) => {
    // USM panels are thin.
    const thickness = 0.005; // 5mm

    const args = useMemo(() => {
        // Geometry args: width, height, depth
        // Subtract 19mm (tube diameter) so the panel sits inside the frame without z-fighting the tubes.
        const insetW = Math.max(1, width - 19) * 0.001;
        const insetH = Math.max(1, height - 19) * 0.001;

        switch (orientation) {
            case 'xy': return [insetW, insetH, thickness] as [number, number, number];
            case 'xz': return [insetW, thickness, insetH] as [number, number, number];
            case 'yz': return [thickness, insetH, insetW] as [number, number, number];
        }
    }, [orientation, width, height]);

    const offset = useMemo(() => {
        // Center the panel. Position is bottom-left-back corner.
        // xy: x + w/2, y + h/2, z
        // xz: x + w/2, y, z + h/2
        // yz: x, y + w/2, z + h/2 (if w is height and h is depth)

        const w = width * 0.001;
        const h = height * 0.001;
        const x = position[0] * 0.001;
        const y = position[1] * 0.001;
        const z = position[2] * 0.001;

        switch (orientation) {
            case 'xy': return [x + w / 2, y + h / 2, z];
            case 'xz': return [x + w / 2, y, z + h / 2];
            case 'yz': return [x, y + h / 2, z + w / 2];
        }
    }, [position, orientation, width, height]);

    // Color Mapping
    const getColorParams = (colorName: string) => {
        // Steel
        // Use higher metalness for shine, lower roughness for sharpness.
        // Use slightly brighter colors or ensure lighting hits them.
        if (colorName === 'black') return { color: '#1C1C1C', opacity: 1, transparent: false, metalness: 0.05, roughness: 0.6, envMapIntensity: 0.15 };
        if (colorName === 'white') return { color: '#FFFFFF', opacity: 1, transparent: false, metalness: 0.02, roughness: 0.5, envMapIntensity: 0.1 };
        if (colorName === 'beige') return { color: '#a48f7a', opacity: 1, transparent: false, metalness: 0.02, roughness: 0.6, envMapIntensity: 0.15 };

        // Acrylic - Make them pop more and act like tinted glass.
        if (colorName === 'transparent') return { color: '#ffffff', opacity: 1, transparent: true, metalness: 0.1, roughness: 0.05, transmission: 1.0, thickness: 0.05, ior: 1.5, clearcoat: 1.0, envMapIntensity: 0.6 };
        if (colorName === 'orange_translucent') return { color: '#FF5500', opacity: 0.8, transparent: true, metalness: 0.1, roughness: 0.1, transmission: 0.8, thickness: 0.05, ior: 1.5, clearcoat: 0.5, envMapIntensity: 0.6 };
        if (colorName === 'blue_translucent') return { color: '#0044FF', opacity: 0.8, transparent: true, metalness: 0.1, roughness: 0.1, transmission: 0.8, thickness: 0.05, ior: 1.5, clearcoat: 0.5, envMapIntensity: 0.6 };
        if (colorName === 'green_translucent') return { color: '#00D12D', opacity: 0.8, transparent: true, metalness: 0.1, roughness: 0.1, transmission: 0.8, thickness: 0.05, ior: 1.5, clearcoat: 0.5, envMapIntensity: 0.6 };

        return { color: colorName, opacity: 1, transparent: false, metalness: 0.5, roughness: 0.4, envMapIntensity: 0.4 };
    };

    const params = getColorParams(color);

    return (
        <mesh position={offset as [number, number, number]} castShadow receiveShadow>
            <boxGeometry args={args} />
            <meshPhysicalMaterial
                color={params.color}
                metalness={params.metalness}
                roughness={params.roughness}
                transparent={params.transparent}
                opacity={params.opacity}
                transmission={params.transmission || 0}
                thickness={params.thickness || 0}
                ior={params.ior || 1.5}
                clearcoat={params.clearcoat || 0}
                envMapIntensity={params.envMapIntensity || 0.5}
            />
        </mesh>
    );
};
