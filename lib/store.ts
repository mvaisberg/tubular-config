import { create } from 'zustand'
import { ModuleConfig, DerivedPart, Dimension, ModuleMaterial } from './types'
import { createClient } from './supabase/client'
import { generateParts } from './calculator'
import { calculatePricing, BOMItem } from './pricing'

export type EnvironmentType = 'none' | 'room';

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
    hasWheels: boolean
    toastMessage: string | null
    history: ModuleConfig[][]
    future: ModuleConfig[][]
    actions: {
        showToast: (message: string) => void
        addModule: (module: ModuleConfig) => void
        removeModule: (id: string) => void
        updateModule: (id: string, updates: Partial<ModuleConfig>) => void
        updateColumnWidth: (id: string, newWidth: number) => void
        updateRowHeight: (id: string, newHeight: number) => void
        setAllDepth: (newDepth: number) => void
        updateAllModules: (updates: Partial<ModuleConfig>) => void
        selectModule: (id: string | null) => void
        setModules: (modules: ModuleConfig[]) => void
        setEnvironment: (env: EnvironmentType) => void
        toggleDimensions: () => void
        toggleAddButtons: () => void
        setShowAddButtons: (value: boolean) => void
        setHasWheels: (value: boolean) => void
        reset: () => void
        fetchPartsData: () => Promise<void>
        fetchSettings: () => Promise<void>
        calculatePrice: () => void
        triggerCameraReset: () => void
        undo: () => void
        redo: () => void
    }
}

const MAX_HISTORY = 50;

// Available panel sizes in the parts database (width × height, checked in both orientations)
// Steel: panels for top/bottom/sides/back. Acrylic: only shelves (top/bottom).
const AVAILABLE_PANEL_SIZES_BY_MATERIAL: Record<ModuleMaterial, [number, number][]> = {
    steel: [[750, 350], [350, 350]],
    acrylic: [
        [200, 250], [200, 350],
        [350, 250], [350, 350],
        [400, 250], [400, 350],
        [750, 250], [750, 350],
    ],
};

function panelSizeExists(a: number, b: number, material: ModuleMaterial): boolean {
    return AVAILABLE_PANEL_SIZES_BY_MATERIAL[material].some(
        ([pw, ph]) => (a === pw && b === ph) || (a === ph && b === pw)
    );
}

// Check which panel faces have a matching part for a given module size
export function getAvailablePanels(w: number, h: number, d: number, material: ModuleMaterial = 'steel') {
    return {
        topBottom: panelSizeExists(w, d, material),    // XZ plane
        leftRight: panelSizeExists(d, h, material),    // YZ plane
        frontBack: panelSizeExists(w, h, material),    // XY plane
    };
}

// Returns modules contiguous in X with `target` in the same row (same y, same z).
// Two modules are contiguous if one ends exactly where the next begins.
const getRowCluster = (modules: ModuleConfig[], target: ModuleConfig): ModuleConfig[] => {
    const row = modules
        .filter(m => Math.abs(m.position.y - target.position.y) < 1 && Math.abs(m.position.z - target.position.z) < 1)
        .sort((a, b) => a.position.x - b.position.x);

    const idx = row.findIndex(m => m.id === target.id);
    if (idx === -1) return [target];

    const cluster: ModuleConfig[] = [row[idx]];
    for (let i = idx - 1; i >= 0; i--) {
        const left = row[i];
        const right = cluster[0];
        if (Math.abs(left.position.x + left.size.w - right.position.x) < 1) cluster.unshift(left);
        else break;
    }
    for (let i = idx + 1; i < row.length; i++) {
        const right = row[i];
        const left = cluster[cluster.length - 1];
        if (Math.abs(left.position.x + left.size.w - right.position.x) < 1) cluster.push(right);
        else break;
    }
    return cluster;
};

const enforceModuleConstraints = (module: ModuleConfig): ModuleConfig => {
    const { w, h, d } = module.size;
    const avail = getAvailablePanels(w, h, d, module.material);

    const hasPanel = { ...module.hasPanel };

    // Force off panels that have no matching part size
    if (!avail.topBottom) {
        hasPanel.top = false;
        hasPanel.bottom = false;
    }
    if (!avail.leftRight) {
        hasPanel.left = false;
        hasPanel.right = false;
    }
    if (!avail.frontBack) {
        hasPanel.front = false;
        hasPanel.back = false;
    }

    // Front panel is never available
    hasPanel.front = false;

    // La chapa pasacable sólo existe en 750×350: si cambia el tamaño o se saca la trasera, se limpia.
    const backPanelCableHole = (hasPanel.back && w === 750 && h === 350)
        ? module.backPanelCableHole
        : undefined;

    return { ...module, hasPanel, backPanelCableHole };
};

export const useConfigStore = create<ConfigState>((set, get) => {
    const snapshot = () => set((state) => ({
        history: [...state.history, state.modules].slice(-MAX_HISTORY),
        future: [],
    }));

    return ({
    modules: [{
        id: 'initial-module',
        position: { x: 0, y: 0, z: 0 },
        size: { w: 750, h: 350, d: 350 },
        color: 'black',
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
    hasWheels: false,
    toastMessage: null,
    history: [],
    future: [],
    actions: {
        showToast: (message) => {
            set({ toastMessage: message });
            // Auto-ocultar a los 3s (si no lo pisó otro toast).
            setTimeout(() => {
                if (get().toastMessage === message) set({ toastMessage: null });
            }, 3000);
        },
        selectModule: (id) => set({ selectedModuleId: id }),
        triggerCameraReset: () => set((state) => ({ cameraResetVersion: state.cameraResetVersion + 1 })),
        setEnvironment: (env) => set({ environment: env }),
        toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),
        toggleAddButtons: () => set((state) => ({ showAddButtons: !state.showAddButtons })),
        setShowAddButtons: (value) => set({ showAddButtons: value }),
        setHasWheels: (value) => {
            set({ hasWheels: value });
            get().actions.calculatePrice();
        },
        setModules: (modules) => {
            snapshot();
            set({ modules, selectedModuleId: null });
            get().actions.calculatePrice();
        },
        addModule: (module) => {
            snapshot();
            set((state) => {
                const added = enforceModuleConstraints(module);
                let modules = [...state.modules, added];

                // If the new module bridges two clusters with different heights
                // (or sits in a row whose contiguous cluster has mixed heights),
                // normalize the cluster to the tallest height. Cells above the
                // cluster (within its X bounds, same z) shift up by the delta
                // their supporting column gained.
                const cluster = getRowCluster(modules, added);
                const maxH = Math.max(...cluster.map(m => m.size.h)) as Dimension;
                const needsMerge = cluster.some(m => m.size.h !== maxH);
                if (needsMerge) {
                    const clusterIds = new Set(cluster.map(m => m.id));
                    const minX = Math.min(...cluster.map(m => m.position.x));
                    const maxX = Math.max(...cluster.map(m => m.position.x + m.size.w));
                    const baseY = added.position.y;
                    const z = added.position.z;

                    modules = modules.map(m => {
                        if (clusterIds.has(m.id)) {
                            return enforceModuleConstraints({ ...m, size: { ...m.size, h: maxH } });
                        }
                        if (m.position.y > baseY && Math.abs(m.position.z - z) < 1) {
                            const s = m.position.x, e = m.position.x + m.size.w;
                            if (s >= minX - 0.5 && e <= maxX + 0.5) {
                                const supporter = cluster.find(c =>
                                    c.position.x < e - 0.5 && c.position.x + c.size.w > s + 0.5
                                );
                                if (supporter) {
                                    const shift = (maxH as number) - (supporter.size.h as number);
                                    return { ...m, position: { ...m.position, y: m.position.y + shift } };
                                }
                            }
                        }
                        return m;
                    });
                }

                return { modules };
            });
            get().actions.calculatePrice();
        },
        updateModule: (id, updates) => {
            snapshot();
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

            snapshot();
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

            set({ modules: updatedModules as ModuleConfig[] });
            get().actions.calculatePrice();
        },
        updateRowHeight: (id, newHeight) => {
            const state = get();
            const targetModule = state.modules.find(m => m.id === id);
            if (!targetModule) return;

            const currentY = targetModule.position.y;
            const currentZ = targetModule.position.z;
            const currentHeight = targetModule.size.h;
            const delta = newHeight - currentHeight;

            if (delta === 0) return;

            // Limit to the horizontally-contiguous cluster of the edited module.
            const cluster = getRowCluster(state.modules, targetModule);
            const clusterIds = new Set(cluster.map(m => m.id));
            const minX = Math.min(...cluster.map(m => m.position.x));
            const maxX = Math.max(...cluster.map(m => m.position.x + m.size.w));

            // Block if any module above the cluster straddles its X bounds —
            // editing would leave the upper module visually unsupported.
            const conflict = state.modules.some(m => {
                if (m.position.y <= currentY) return false;
                if (Math.abs(m.position.z - currentZ) > 1) return false;
                const s = m.position.x, e = m.position.x + m.size.w;
                const overlaps = s < maxX - 0.5 && e > minX + 0.5;
                if (!overlaps) return false;
                return s < minX - 0.5 || e > maxX + 0.5;
            });
            if (conflict) {
                if (typeof window !== 'undefined') {
                    alert('No se puede cambiar la altura: hay un módulo superior apoyado fuera del cluster. Separá los módulos primero.');
                }
                return;
            }

            snapshot();
            const updatedModules = state.modules.map(m => {
                if (clusterIds.has(m.id)) {
                    return enforceModuleConstraints({ ...m, size: { ...m.size, h: newHeight as Dimension } });
                }
                // Shift Y for modules above this cluster, contained in its X bounds, same z.
                if (m.position.y > currentY && Math.abs(m.position.z - currentZ) < 1) {
                    const s = m.position.x, e = m.position.x + m.size.w;
                    if (s >= minX - 0.5 && e <= maxX + 0.5) {
                        return { ...m, position: { ...m.position, y: m.position.y + delta } };
                    }
                }
                return m;
            });

            set({ modules: updatedModules as ModuleConfig[] });
            get().actions.calculatePrice();
        },
        setAllDepth: (newDepth) => {
            snapshot();
            set((state) => ({
                modules: state.modules.map((m) =>
                    enforceModuleConstraints({ ...m, size: { ...m.size, d: newDepth as Dimension } })
                ),
            }));
            get().actions.calculatePrice();
        },
        updateAllModules: (updates) => {
            snapshot();
            set((state) => ({
                modules: state.modules.map((m) => enforceModuleConstraints({ ...m, ...updates })),
            }));
            get().actions.calculatePrice();
        },
        removeModule: (id) => {
            snapshot();
            set((state) => ({
                modules: state.modules.filter((m) => m.id !== id),
                selectedModuleId: state.selectedModuleId === id ? null : state.selectedModuleId
            }));
            get().actions.calculatePrice();
        },
        reset: () => {
            snapshot();
            set({
                modules: [{
                    id: crypto.randomUUID(),
                    position: { x: 0, y: 0, z: 0 },
                    size: { w: 750, h: 350, d: 350 },
                    color: 'black',
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
            const { modules, partsData, settings, hasWheels } = get();
            if (!settings) return;

            const result = calculatePricing(modules, partsData, settings, hasWheels);

            set({
                totalCost: result.totalCost,
                totalPrice: result.totalPrice,
                bomSummary: result.bomSummary,
                metrics: result.metrics
            });
        },
        undo: () => {
            const state = get();
            if (state.history.length === 0) return;
            const previous = state.history[state.history.length - 1];
            const newHistory = state.history.slice(0, -1);
            const stillExists = previous.some(m => m.id === state.selectedModuleId);
            set({
                modules: previous,
                history: newHistory,
                future: [...state.future, state.modules].slice(-MAX_HISTORY),
                selectedModuleId: stillExists ? state.selectedModuleId : null,
            });
            get().actions.calculatePrice();
        },
        redo: () => {
            const state = get();
            if (state.future.length === 0) return;
            const next = state.future[state.future.length - 1];
            const newFuture = state.future.slice(0, -1);
            const stillExists = next.some(m => m.id === state.selectedModuleId);
            set({
                modules: next,
                future: newFuture,
                history: [...state.history, state.modules].slice(-MAX_HISTORY),
                selectedModuleId: stillExists ? state.selectedModuleId : null,
            });
            get().actions.calculatePrice();
        },
    },
});
})

export const useConfigActions = () => useConfigStore((state) => state.actions)
