import { useMemo } from 'react';
import * as THREE from 'three';
import { useConfigStore } from '@/lib/store';

// Agujero pasacable de la chapa trasera 750×350: 60mm ancho × 50mm alto,
// centrado horizontalmente, arranca a 40mm del borde inferior de la chapa.
const HOLE_W = 0.060;
const HOLE_H = 0.050;
const HOLE_BOTTOM = 0.040;
const HOLE_R = 0.010; // esquinas redondeadas del slot

export const Panel = ({ position, orientation, width, height, color = 'white', cableHole = false }: { position: [number, number, number], orientation: 'xy' | 'xz' | 'yz', width: number, height: number, color?: string, cableHole?: boolean }) => {
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
        // Steel — unlit, pure flat color (meshBasicMaterial)
        if (colorName === 'black') return { color: '#1C1C1C', isAcrylic: false };
        if (colorName === 'white') return { color: '#FAFAFA', isAcrylic: false };
        if (colorName === 'beige') return { color: '#a48f7a', isAcrylic: false };

        // Acrylic plenos (opaque) — flat unlit
        if (colorName === 'black_solid') return { color: '#1C1C1C', isAcrylic: false };
        if (colorName === 'white_solid') return { color: '#FAFAFA', isAcrylic: false };

        // Acrylic — translucido sin reflexiones especulares.
        // specularIntensity=0 + reflectivity=0 + ior=1.0 mata el Fresnel (los reflejos rasantes).
        // thickness ~0 evita refracción visible que duplique tubos/bolas.
        // Roughness alta para que cualquier highlight residual sea totalmente difuso.
        if (colorName === 'transparent') return { color: '#ffffff', isAcrylic: true, opacity: 1, transparent: true, metalness: 0, roughness: 0.35, transmission: 0.95, thickness: 0.001, ior: 1.0, clearcoat: 0, envMapIntensity: 0, specularIntensity: 0, reflectivity: 0 };
        if (colorName === 'orange_translucent') return { color: '#E64A00', isAcrylic: true, opacity: 0.7, transparent: true, metalness: 0, roughness: 0.4, transmission: 0.7, thickness: 0.001, ior: 1.0, clearcoat: 0, envMapIntensity: 0, specularIntensity: 0, reflectivity: 0 };
        if (colorName === 'blue_translucent') return { color: '#003366', isAcrylic: true, opacity: 0.7, transparent: true, metalness: 0, roughness: 0.4, transmission: 0.7, thickness: 0.001, ior: 1.0, clearcoat: 0, envMapIntensity: 0, specularIntensity: 0, reflectivity: 0 };
        if (colorName === 'green_translucent') return { color: '#003D1F', isAcrylic: true, opacity: 0.7, transparent: true, metalness: 0, roughness: 0.4, transmission: 0.7, thickness: 0.001, ior: 1.0, clearcoat: 0, envMapIntensity: 0, specularIntensity: 0, reflectivity: 0 };

        return { color: colorName, isAcrylic: false };
    };

    const params = getColorParams(color);

    // En modo ambientado el panel pasa a material iluminado (chapa pintada al horno:
    // difusa, leve sheen). En modo configurador queda el color plano sin luz (look catálogo).
    const roomActive = useConfigStore((state) => state.environment) === 'room';
    const materialEl = params.isAcrylic ? (
        <meshPhysicalMaterial
            color={params.color}
            metalness={params.metalness}
            roughness={params.roughness}
            transparent={params.transparent}
            opacity={params.opacity}
            transmission={params.transmission || 0}
            thickness={params.thickness || 0}
            ior={params.ior || 1.0}
            clearcoat={params.clearcoat || 0}
            envMapIntensity={params.envMapIntensity ?? 0}
            specularIntensity={params.specularIntensity ?? 0}
            reflectivity={params.reflectivity ?? 0}
        />
    ) : roomActive ? (
        <meshStandardMaterial color={params.color} roughness={1} metalness={0} envMapIntensity={0.05} />
    ) : (
        <meshBasicMaterial color={params.color} />
    );

    // Geometría con hueco para la chapa pasacable (sólo aplica a la chapa trasera, plano xy).
    const holeGeometry = useMemo(() => {
        if (!cableHole || orientation !== 'xy') return null;

        const w = Math.max(1, width - 19) * 0.001;
        const h = Math.max(1, height - 19) * 0.001;

        const shape = new THREE.Shape();
        shape.moveTo(-w / 2, -h / 2);
        shape.lineTo(w / 2, -h / 2);
        shape.lineTo(w / 2, h / 2);
        shape.lineTo(-w / 2, h / 2);
        shape.closePath();

        const x0 = -HOLE_W / 2, x1 = HOLE_W / 2;
        const y0 = -h / 2 + HOLE_BOTTOM, y1 = y0 + HOLE_H;
        const r = HOLE_R;
        const hole = new THREE.Path();
        hole.moveTo(x0 + r, y0);
        hole.lineTo(x1 - r, y0);
        hole.quadraticCurveTo(x1, y0, x1, y0 + r);
        hole.lineTo(x1, y1 - r);
        hole.quadraticCurveTo(x1, y1, x1 - r, y1);
        hole.lineTo(x0 + r, y1);
        hole.quadraticCurveTo(x0, y1, x0, y1 - r);
        hole.lineTo(x0, y0 + r);
        hole.quadraticCurveTo(x0, y0, x0 + r, y0);
        shape.holes.push(hole);

        const geom = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
        geom.translate(0, 0, -thickness / 2);
        return geom;
    }, [cableHole, orientation, width, height]);

    if (holeGeometry) {
        return (
            <mesh position={offset as [number, number, number]} geometry={holeGeometry} castShadow receiveShadow>
                {materialEl}
            </mesh>
        );
    }

    return (
        <mesh position={offset as [number, number, number]} castShadow receiveShadow>
            <boxGeometry args={args} />
            {materialEl}
        </mesh>
    );
};
