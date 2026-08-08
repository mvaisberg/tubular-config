import { ModuleConfig } from './types';

// Muebles de catálogo para arrancar el diseño desde algo armado.
// Las imágenes de preview viven en public/presets/<id>.png (capturas del propio render).
export interface Preset {
    id: string;
    name: string;
    description: string;
    hasWheels: boolean;
    modules: ModuleConfig[];
}

const steelModule = (
    id: string,
    x: number,
    y: number,
    w: 350 | 500 | 750,
    h: 200 | 350 | 500 | 750,
    color: string,
    extra?: Partial<ModuleConfig>
): ModuleConfig => ({
    id,
    position: { x, y, z: 0 },
    size: { w, h, d: 350 },
    color,
    material: 'steel',
    hasPanel: { top: true, bottom: true, left: true, right: true, front: false, back: true },
    ...extra,
});

export const PRESETS: Preset[] = [
    {
        id: 'rack-tv',
        name: 'Rack de TV',
        description: '2,25 m de ancho, bajo, con pasacable para los enchufes',
        hasWheels: false,
        modules: [
            steelModule('rack-1', 0, 0, 750, 350, 'black'),
            steelModule('rack-2', 750, 0, 750, 350, 'black', { backPanelCableHole: true }),
            steelModule('rack-3', 1500, 0, 750, 350, 'black'),
        ],
    },
    {
        id: 'biblioteca',
        name: 'Biblioteca',
        description: '1,5 m de ancho por 1 m de alto, seis módulos',
        hasWheels: false,
        modules: [
            steelModule('bib-1', 0, 0, 750, 350, 'white'),
            steelModule('bib-2', 750, 0, 750, 350, 'white'),
            steelModule('bib-3', 0, 350, 750, 350, 'white'),
            steelModule('bib-4', 750, 350, 750, 350, 'white'),
            steelModule('bib-5', 0, 700, 750, 350, 'white'),
            steelModule('bib-6', 750, 700, 750, 350, 'white'),
        ],
    },
    {
        id: 'mesa-rodante',
        name: 'Mesa rodante',
        description: 'Angosta y con ruedas, ideal mesa de luz o arrimo',
        hasWheels: true,
        modules: [
            steelModule('mesa-1', 0, 0, 500, 350, 'beige'),
            steelModule('mesa-2', 0, 350, 500, 350, 'beige'),
        ],
    },
];
