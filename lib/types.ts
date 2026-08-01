export type Axis = 'x' | 'y' | 'z';

export type Dimension = 100 | 200 | 250 | 350 | 395 | 400 | 500 | 750;

export interface Coordinates {
    x: number;
    y: number;
    z: number;
}

export type ModuleMaterial = 'acrylic' | 'steel';

export interface ModuleConfig {
    id: string;
    position: Coordinates; // Grid coordinates (not world units), e.g., [0, 0, 0]
    size: {
        w: Dimension;
        h: Dimension;
        d: Dimension;
    };
    color: string;
    material: ModuleMaterial;
    // Override material for the top panel only. Used in steel modules to allow an acrylic shelf
    // on top of a steel frame. Falls back to `material` when undefined.
    topPanelMaterial?: ModuleMaterial;
    hasPanel: {
        top: boolean;
        bottom: boolean;
        left: boolean;
        right: boolean;
        front: boolean; // Door or panel
        back: boolean;
    };
    // Chapa trasera con agujero pasacable. Sólo válida para chapa 750×350 (mismo precio que la standard).
    backPanelCableHole?: boolean;
    // Future: drawer, lock, etc.
}

export type PartType = 'ball' | 'tube' | 'panel' | 'foot';

export interface DerivedPart {
    id: string; // Unique ID composed of coordinates/type
    type: PartType;
    position: [number, number, number]; // World coordinates
    rotation?: [number, number, number];
    length?: number; // For tubes
    orientation?: Axis | 'xy' | 'xz' | 'yz'; // Expanded for panels
    dimensions?: { width: number; height: number }; // For panels
    color?: string; // For panels
    material?: ModuleMaterial; // For panels
    cableHole?: boolean; // For panels: agujero pasacable 60×50mm, centrado, a 40mm de la base
    hasFoot?: boolean; // For balls at the bottom
}

export interface PartData {
    sku: string;
    name: string;
    type: string;
    dimensions: any;
    cost: number;
    price: number;
    stock: number;
}
