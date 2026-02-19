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
    actions: {
        addModule: (module: ModuleConfig) => void
        removeModule: (id: string) => void
        selectModule: (id: string | null) => void
        reset: () => void
        fetchPartsData: () => Promise<void>
        calculatePrice: () => void
    }
}

export const useConfigStore = create<ConfigState>((set, get) => ({
    modules: [],
    partsData: [],
    totalPrice: 0,
    selectedModuleId: null,
    actions: {
        selectModule: (id) => set({ selectedModuleId: id }),
        addModule: (module) => {
            set((state) => ({ modules: [...state.modules, module], selectedModuleId: module.id })); // Auto-select new
            get().actions.calculatePrice();
        },
        removeModule: (id) => {
            set((state) => ({ modules: state.modules.filter((m) => m.id !== id) }));
            get().actions.calculatePrice();
        },
        reset: () => {
            set({ modules: [], totalPrice: 0 });
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
