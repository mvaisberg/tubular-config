import { create } from 'zustand'
import { ModuleConfig, DerivedPart, Dimension } from './types'
import { createClient } from './supabase/client'
import { generateParts } from './calculator'
import { calculatePricing, BOMItem } from './pricing'

export type EnvironmentType = 'none' | 'env1' | 'env2' | 'env3';

interface PartData {
    id: string
    sku: string
    type: string
    name?: string
    price_ars?: number
    price_usd?: number
    dimensions: any
}

interface ConfigState {
    modules: ModuleConfig[]
    partsData: PartData[]
    settings: {
        usd_exchange_rate: number;
        profit_margin: number;
        shipping_cost: number;
        transaction_fee_percent: number;
        transaction_fee_iva_percent: number;
        installments_6_percent: number;
        iva_percent: number;
        target_margin_percent: number;
    } | null;
    bomSummary: Record<string, BOMItem>
    totalCost: number
    totalPrice: number
    metrics: {
        basePrice: number;
        grossProfit: number;
        realRevenue: number;
        roasBreakEven: number;
        roasTarget: number;
    } | null;
    selectedModuleId: string | null
    cameraResetVersion: number
    environment: EnvironmentType
    showDimensions: boolean
    showAddButtons: boolean
    actions: {
        addModule: (module: ModuleConfig) => void
        removeModule: (id: string) => void
        updateModule: (id: string, updates: Partial<ModuleConfig>) => void
        updateColumnWidth: (id: string, newWidth: number) => void
        updateRowHeight: (id: string, newHeight: number) => void
        updateAllModules: (updates: Partial<ModuleConfig>) => void
        selectModule: (id: string | null) => void
        setModules: (modules: ModuleConfig[]) => void
        setEnvironment: (env: EnvironmentType) => void
        toggleDimensions: () => void
        toggleAddButtons: () => void
        reset: () => void
        fetchPartsData: () => Promise<void>
        fetchSettings: () => Promise<void>
        calculatePrice: () => void
        triggerCameraReset: () => void
    }
}

const enforceModuleConstraints = (module: ModuleConfig): ModuleConfig => {
    const is750x750 = module.size.w === 750 && module.size.h === 750;

    if (is750x750 && module.hasPanel.back) {
        return {
            ...module,
            hasPanel: {
                ...module.hasPanel,
                back: false
            }
        };
    }

    return module;
};

export const useConfigStore = create<ConfigState>((set, get) => ({
    modules: [{
        id: 'initial-module',
        position: { x: 0, y: 0, z: 0 },
        size: { w: 750, h: 350, d: 350 },
        color: 'white',
        material: 'steel',
        hasPanel: { top: true, bottom: true, left: true, right: true, front: false, back: true }
    }],
    partsData: [],
    settings: null,
    bomSummary: {},
    totalCost: 0,
    totalPrice: 0,
    metrics: null,
    selectedModuleId: null,
    cameraResetVersion: 0,
    environment: 'none',
    showDimensions: false,
    showAddButtons: true,
    actions: {
        selectModule: (id) => set({ selectedModuleId: id }),
        triggerCameraReset: () => set((state) => ({ cameraResetVersion: state.cameraResetVersion + 1 })),
        setEnvironment: (env) => set({ environment: env }),
        toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),
        toggleAddButtons: () => set((state) => ({ showAddButtons: !state.showAddButtons })),
        setModules: (modules) => {
            set({ modules, selectedModuleId: null });
            get().actions.calculatePrice();
        },
        addModule: (module) => {
            set((state) => ({ modules: [...state.modules, module] }));
            get().actions.calculatePrice();
        },
        updateModule: (id, updates) => {
            set((state) => ({
                modules: state.modules.map((m) =>
                    m.id === id ? enforceModuleConstraints({ ...m, ...updates }) : m
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
                    return enforceModuleConstraints({ ...m, size: { ...m.size, w: newWidth as Dimension } });
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
                    return enforceModuleConstraints({ ...m, size: { ...m.size, h: newHeight as Dimension } });
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
                modules: state.modules.map((m) => enforceModuleConstraints({ ...m, ...updates })),
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
                    hasPanel: { top: true, bottom: true, left: true, right: true, front: false, back: false }
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
        fetchSettings: async () => {
            const supabase = createClient();
            const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
            if (data) {
                set({
                    settings: {
                        usd_exchange_rate: data.usd_exchange_rate || 1000,
                        profit_margin: data.profit_margin || 50,
                        shipping_cost: data.shipping_cost || 20000,
                        transaction_fee_percent: data.transaction_fee_percent || 2.5,
                        transaction_fee_iva_percent: data.transaction_fee_iva_percent || 21,
                        installments_6_percent: data.installments_6_percent || 13,
                        iva_percent: data.iva_percent || 21,
                        target_margin_percent: data.target_margin_percent || 65
                    }
                });
                get().actions.calculatePrice();
            } else if (error) {
                console.error('Error fetching settings:', error);
            }
        },
        calculatePrice: () => {
            const { modules, partsData, settings } = get();
            if (!settings) return;

            const result = calculatePricing(modules, partsData, settings);

            set({
                totalCost: result.totalCost,
                totalPrice: result.totalPrice,
                bomSummary: result.bomSummary,
                metrics: result.metrics
            });
        }
    },
}))

export const useConfigActions = () => useConfigStore((state) => state.actions)
