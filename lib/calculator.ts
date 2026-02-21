import { ModuleConfig, DerivedPart, Coordinates } from './types';

const BALL_RADIUS = 0.0125; // 25mm diameter approx (USM ball is ~25mm)
// USM dimensions are center-to-center.
// We represent positions in mm, then convert to meters for rendering (scale 0.001)

export function generateParts(modules: ModuleConfig[]): DerivedPart[] {
    const parts: Map<string, DerivedPart> = new Map();

    // Helper to add part if not exists
    const addPart = (part: DerivedPart) => {
        if (!parts.has(part.id)) {
            parts.set(part.id, part);
        }
    };

    modules.forEach((mod) => {
        // Determine the 8 corners of the module in 3D space relative to origin
        // We need a system to map "Grid Coordinates" to "World Coordinates".
        // For simplicity, let's assume the module.position is already in "World Space" steps or we calculate it.
        // BUT, modules have different sizes.
        // So if module A is at {0,0,0} with width 750.
        // Module B at right of A should be at {750, 0, 0}.
        // This implies we need absolute positioning in mm for the modules.

        const x = mod.position.x;
        const y = mod.position.y;
        const z = mod.position.z;
        const w = mod.size.w;
        const h = mod.size.h;
        const d = mod.size.d;

        // 8 CORNERS (Balls)
        const corners = [
            [x, y, z],
            [x + w, y, z],
            [x, y + h, z],
            [x + w, y + h, z],
            [x, y, z + d],
            [x + w, y, z + d],
            [x, y + h, z + d],
            [x + w, y + h, z + d]
        ];

        corners.forEach(([cx, cy_val, cz_val], idx) => {
            const id = `ball-${cx}-${cy_val}-${cz_val}`;
            addPart({
                id,
                type: 'ball',
                position: [cx, cy_val, cz_val] as [number, number, number],
                hasFoot: cy_val === 0
            });
        });

        // 12 TUBES
        // We define tubes by their Start and End points (or Start + Axis + Length)
        // To ensure uniqueness, we can sort coordinates or order them?
        // Using `tube-axis-x-y-z-length` where x,y,z is the "min" coordinate.

        // Horizontal Width (X-axis) - 4 tubes
        // (x,y,z) -> (x+w, y, z)
        // (x, y+h, z) -> (x+w, y+h, z)
        // ...
        const addTube = (x1: number, y1: number, z1: number, axis: 'x' | 'y' | 'z', length: number) => {
            const id = `tube-${axis}-${x1}-${y1}-${z1}-${length}`;
            // Position should be center of tube for rendering? Or start? 
            // Let's store start position + length.
            addPart({
                id,
                type: 'tube',
                orientation: axis,
                length,
                position: [x1, y1, z1]
            });
        };

        // X-axis tubes
        addTube(x, y, z, 'x', w);
        addTube(x, y + h, z, 'x', w);
        addTube(x, y, z + d, 'x', w);
        addTube(x, y + h, z + d, 'x', w);

        // Y-axis tubes (Height)
        addTube(x, y, z, 'y', h);
        addTube(x + w, y, z, 'y', h);
        addTube(x, y, z + d, 'y', h);
        addTube(x + w, y, z + d, 'y', h);

        // Z-axis tubes (Depth)
        addTube(x, y, z, 'z', d);
        addTube(x + w, y, z, 'z', d);
        addTube(x, y + h, z, 'z', d);
        addTube(x + w, y + h, z, 'z', d);

        // PANELS
        // We dedup panels based on their global position and dimensions.
        // Panel positions are their bottom-left-back corner? Or center?
        // Let's use the corner with lowest coordinates.

        // PANELS
        // We dedup panels based on their global position and dimensions.
        // Panel positions are their bottom-left-back corner? Or center?
        // Let's use the corner with lowest coordinates.

        const addPanel = (x1: number, y1: number, z1: number, plane: 'xy' | 'xz' | 'yz', w_dim: number, h_dim: number) => {
            const id = `panel-${plane}-${x1}-${y1}-${z1}-${w_dim}-${h_dim}`;
            addPart({
                id,
                type: 'panel',
                position: [x1, y1, z1] as [number, number, number],
                orientation: plane,
                dimensions: { width: w_dim, height: h_dim },
                color: mod.color,
                material: mod.material
            });
        };

        // Top Panel (XZ) at y + h
        if (mod.hasPanel.top) {
            addPanel(x, y + h, z, 'xz', w, d);
        }
        // Bottom Panel (XZ) at y
        if (mod.hasPanel.bottom) {
            addPanel(x, y, z, 'xz', w, d);
        }

        // Left Panel (YZ) at x
        if (mod.hasPanel.left) {
            // dimensions: depth=d, height=h. 
            addPanel(x, y, z, 'yz', d, h);
        }
        // Right Panel (YZ) at x + w
        if (mod.hasPanel.right) {
            addPanel(x + w, y, z, 'yz', d, h);
        }

        // Front Panel (XY) at z + d
        if (mod.hasPanel.front) {
            addPanel(x, y, z + d, 'xy', w, h);
        }
        // Back Panel (XY) at z
        if (mod.hasPanel.back) {
            addPanel(x, y, z, 'xy', w, h);
        }

    });

    return Array.from(parts.values());
}
