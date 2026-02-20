import { create } from 'zustand'
import { ModuleConfig, DerivedPart } from './types'
import { createClient } from './supabase/client'
import { generateParts } from './calculator'

interface PartData {
    id: string
    sku: string
    type: string
    price: number
    dimensions: any
}

interface ConfigState {
    modules: ModuleConfig[]
    partsData: PartData[]
    totalPrice: number
    selectedModuleId: string | null
    cameraResetVersion: number
    actions: {
        addModule: (module: ModuleConfig) => void
        removeModule: (id: string) => void
        updateModule: (id: string, updates: Partial<ModuleConfig>) => void
        updateColumnWidth: (id: string, newWidth: number) => void
        updateRowHeight: (id: string, newHeight: number) => void
        updateAllModules: (updates: Partial<ModuleConfig>) => void
        selectModule: (id: string | null) => void
        reset: () => void
        fetchPartsData: () => Promise<void>
        calculatePrice: () => void
        triggerCameraReset: () => void
    }
}

export const useConfigStore = create<ConfigState>((set, get) => ({
    modules: [],
    partsData: [],
    totalPrice: 0,
    selectedModuleId: null,
    cameraResetVersion: 0,
    actions: {
        selectModule: (id) => set({ selectedModuleId: id }),
        triggerCameraReset: () => set((state) => ({ cameraResetVersion: state.cameraResetVersion + 1 })),
        addModule: (module) => {
            set((state) => ({ modules: [...state.modules, module], selectedModuleId: module.id }));
            get().actions.calculatePrice();
        },
        updateModule: (id, updates) => {
            set((state) => ({
                modules: state.modules.map((m) =>
                    m.id === id ? { ...m, ...updates } : m
                ),
            }));
            get().actions.calculatePrice();
        },
        updateColumnWidth: (id, newWidth) => {
            const state = get();
            const targetModule = state.modules.find(m => m.id === id);
            if (!targetModule) return;

            const currentX = targetModule.position.x;
            const currentWidth = targetModule.size.w;
            const delta = newWidth - currentWidth;

            if (delta === 0) return;

            const updatedModules = state.modules.map(m => {
                // If in the same column (start X is same), update width
                if (m.position.x === currentX) {
                    return { ...m, size: { ...m.size, w: newWidth } };
                }
                // If after this column, shift X position
                if (m.position.x > currentX) {
                    return { ...m, position: { ...m.position, x: m.position.x + delta } };
                }
                return m;
            });

            set({ modules: updatedModules as ModuleConfig[] }); // Cast to ensure type safety
            set({ modules: updatedModules as ModuleConfig[] }); // Cast to ensure type safety
            get().actions.calculatePrice();
        },
        updateRowHeight: (id, newHeight) => {
            const state = get();
            const targetModule = state.modules.find(m => m.id === id);
            if (!targetModule) return;

            const currentY = targetModule.position.y;
            const currentHeight = targetModule.size.h;
            const delta = newHeight - currentHeight;

            if (delta === 0) return;

            const updatedModules = state.modules.map(m => {
                // If in the same row (start Y is same), update height
                if (m.position.y === currentY) {
                    return { ...m, size: { ...m.size, h: newHeight } };
                }
                // If above this row, shift Y position
                if (m.position.y > currentY) {
                    return { ...m, position: { ...m.position, y: m.position.y + delta } };
                }
                return m;
            });

            set({ modules: updatedModules as ModuleConfig[] });
            get().actions.calculatePrice();
        },
        updateAllModules: (updates) => {
            set((state) => ({
                modules: state.modules.map((m) => ({ ...m, ...updates })),
            }));
            get().actions.calculatePrice();
        },
        removeModule: (id) => {
            set((state) => ({
                modules: state.modules.filter((m) => m.id !== id),
                selectedModuleId: state.selectedModuleId === id ? null : state.selectedModuleId
            }));
            get().actions.calculatePrice();
        },
        reset: () => {
            set({
                modules: [{
                    id: crypto.randomUUID(),
                    position: { x: 0, y: 0, z: 0 },
                    size: { w: 750, h: 350, d: 350 },
                    color: 'white',
                    material: 'steel',
                    hasPanel: { top: true, bottom: true, left: true, right: true, front: false, back: true }
                }],
                selectedModuleId: null,
                totalPrice: 0 // Will be recalculated
            });
            get().actions.calculatePrice();
        },
        fetchPartsData: async () => {
            const supabase = createClient();
            const { data, error } = await supabase.from('parts').select('*');
            if (data) {
                set({ partsData: data });
                get().actions.calculatePrice();
            } else if (error) {
                console.error('Error fetching parts:', error);
            }
        },
        calculatePrice: () => {
            const { modules, partsData } = get();
            const derivedParts = generateParts(modules);
            let total = 0;

            derivedParts.forEach(part => {
                // Find matching part in DB
                let match: PartData | undefined;

                if (part.type === 'ball') {
                    match = partsData.find(p => p.type === 'connector'); // Map ball -> connector
                } else if (part.type === 'tube') {
                    // Find tube by length
                    // part.length should match dimensions->length
                    match = partsData.find(p => p.type === 'tube' && p.dimensions?.length === part.length);
                } else if (part.type === 'panel') {
                    // Find panel by dimensions
                    // part.dimensions.width/height vs DB dimensions width/height
                    // Need to match both irrespective of order? Or exact?
                    // Standard USM panels: 750x350.
                    if (part.dimensions) {
                        const { width, height } = part.dimensions;
                        match = partsData.find(p =>
                            p.type === 'panel' &&
                            ((p.dimensions?.width === width && p.dimensions?.height === height) ||
                                (p.dimensions?.width === height && p.dimensions?.height === width))
                        );
                    }
                }

                if (match) {
                    total += match.price;
                } else {
                    console.warn(`No price found for part: ${part.type} ${part.id}`);
                }
            });

            set({ totalPrice: total });
        }
    },
}))

export const useConfigActions = () => useConfigStore((state) => state.actions)
