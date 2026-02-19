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
        // xy: w, h, thickness
        // xz: w, thickness, h (depth)
        // yz: thickness, w (height), h (depth) -- wait.
        // If orientation is yz, width is usually "depth" of module, height is "height" of module?
        // Let's map it:
        // xy implies Flat on Z axis. dimensions are x and y.
        // xz implies Flat on Y axis. dimensions are x and z.
        // yz implies Flat on X axis. dimensions are y and z.

        switch (orientation) {
            case 'xy': return [width * 0.001, height * 0.001, thickness] as [number, number, number];
            case 'xz': return [width * 0.001, thickness, height * 0.001] as [number, number, number];
            case 'yz': return [thickness, width * 0.001, height * 0.001] as [number, number, number];
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
            case 'yz': return [x, y + w / 2, z + h / 2];
        }
    }, [position, orientation, width, height]);

    return (
        <mesh position={offset as [number, number, number]}>
            <boxGeometry args={args} />
            <meshStandardMaterial color={color} metalness={0.1} roughness={0.8} />
        </mesh>
    );
};
