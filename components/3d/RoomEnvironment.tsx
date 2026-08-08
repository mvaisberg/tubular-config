"use client";

import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { Environment, ContactShadows, useTexture } from '@react-three/drei';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { useConfigStore } from '@/lib/store';

const WALL_COLOR = '#f0ece5';
const CEILING_COLOR = '#faf8f4';
const SKIRTING_COLOR = '#eae6df';
const PICTURE_FRAME_COLOR = '#2e2b28';
const WINDOW_FRAME_COLOR = '#3a3a3a';
const SCENE_BG_COLOR = '#f5f5f5';

// All dimensions in meters (Three.js world units). Mueble es ~0.75m × 0.35m × 0.35m por módulo.
const ROOM_SIZE = 6;          // 6m × 6m floor (residencial chico)
const WALL_HEIGHT = 2.6;      // 2.6m de altura de techo (estándar)
const WALL_BACK_Z = -1.8;     // pared trasera a 1.8m del centro
const WALL_LEFT_X = -1.8;     // pared izquierda a 1.8m del centro
const SKIRTING_HEIGHT = 0.08; // zócalo de 8cm
const SKIRTING_DEPTH = 0.015; // 15mm de salida

const HEMI_INTENSITY = 0.45;
const KEY_LIGHT_INTENSITY = 0.9;
const KEY_LIGHT_COLOR = '#fff1e2';
const KEY_LIGHT_POS: [number, number, number] = [3, 4.5, 2.5];
const FILL_LIGHT_INTENSITY = 0.3;
const FILL_LIGHT_COLOR = '#e9f0fa';
const FILL_LIGHT_POS: [number, number, number] = [-2.5, 3, 2];

// Ventana en la pared trasera: marco + "vidrio" quemado a blanco (día exterior) + rect light.
const WINDOW_W = 1.3;
const WINDOW_H = 1.25;
const WINDOW_CENTER: [number, number] = [-0.95, 1.55]; // x, y sobre la pared trasera
const WINDOW_LIGHT_INTENSITY = 2.2;

// Luz ancha y suave desde atrás de la cámara (ventana fuera de cuadro) — modela las caras frontales
// y genera el brillo alargado típico de foto de interiores en los tubos cromados.
const FRONT_SOFT_INTENSITY = 0.7;
const FRONT_SOFT_POS: [number, number, number] = [2.2, 2.0, 3.0];
const FRONT_SOFT_SIZE: [number, number] = [2.4, 1.6];

const FADE_LERP = 0.12;
const FADE_EPS = 0.005;

const FadeGroup = ({ active, children }: { active: boolean; children: React.ReactNode }) => {
    const groupRef = useRef<THREE.Group>(null);
    const opacityRef = useRef(active ? 1 : 0);
    const [mounted, setMounted] = useState(active);
    const baseIntensities = useRef<Map<THREE.Light, number>>(new Map());
    const trackedMaterials = useRef<Set<THREE.Material>>(new Set());

    useEffect(() => {
        if (active) setMounted(true);
    }, [active]);

    useEffect(() => {
        if (!groupRef.current || !mounted) return;
        const group = groupRef.current;
        group.traverse((obj) => {
            if ((obj as THREE.Light).isLight && !baseIntensities.current.has(obj as THREE.Light)) {
                baseIntensities.current.set(obj as THREE.Light, (obj as THREE.Light).intensity);
            }
            if ((obj as THREE.Mesh).isMesh) {
                const mesh = obj as THREE.Mesh;
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                mats.forEach((m) => {
                    if (m && !trackedMaterials.current.has(m)) {
                        m.transparent = true;
                        trackedMaterials.current.add(m);
                    }
                });
            }
        });
    }, [mounted]);

    useFrame(() => {
        if (!groupRef.current) return;
        const target = active ? 1 : 0;
        opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, target, FADE_LERP);

        if (Math.abs(opacityRef.current - target) < FADE_EPS) {
            opacityRef.current = target;
            if (target === 0 && mounted) {
                setMounted(false);
                return;
            }
        }

        const op = opacityRef.current;
        baseIntensities.current.forEach((base, light) => {
            light.intensity = base * op;
        });
        trackedMaterials.current.forEach((m) => {
            m.opacity = op;
        });
    });

    return mounted ? <group ref={groupRef}>{children}</group> : null;
};

const AreaLight = ({ position, size, intensity, color = '#ffffff', lookAt = [0, 0.5, 0] as [number, number, number] }: {
    position: [number, number, number];
    size: [number, number];
    intensity: number;
    color?: string;
    lookAt?: [number, number, number];
}) => {
    const ref = useRef<THREE.RectAreaLight>(null);
    useLayoutEffect(() => {
        RectAreaLightUniformsLib.init();
        ref.current?.lookAt(...lookAt);
    }, [lookAt]);
    return (
        <rectAreaLight
            ref={ref}
            position={position}
            width={size[0]}
            height={size[1]}
            intensity={intensity}
            color={color}
        />
    );
};

// Piso de parquet chevron con mapas PBR reales (color + normal + roughness).
const ParquetFloor = () => {
    const [colorMap, normalMap, roughMap] = useTexture([
        '/configurador/floor/parquet/color.jpg',
        '/configurador/floor/parquet/normal.jpg',
        '/configurador/floor/parquet/rough.jpg',
    ]);
    const { gl } = useThree();

    useEffect(() => {
        const maxAniso = gl.capabilities.getMaxAnisotropy();
        [colorMap, normalMap, roughMap].forEach((t) => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(3, 3);
            t.anisotropy = Math.min(8, maxAniso);
            t.needsUpdate = true;
        });
        colorMap.colorSpace = THREE.SRGBColorSpace;
    }, [colorMap, normalMap, roughMap, gl]);

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[ROOM_SIZE, ROOM_SIZE]} />
            <meshStandardMaterial
                map={colorMap}
                normalMap={normalMap}
                roughnessMap={roughMap}
                normalScale={new THREE.Vector2(0.7, 0.7)}
                metalness={0}
                envMapIntensity={0.35}
            />
        </mesh>
    );
};

const Picture = () => {
    const art = useTexture('/configurador/art/cuadro.jpg');
    useEffect(() => {
        art.colorSpace = THREE.SRGBColorSpace;
        art.anisotropy = 4;
    }, [art]);
    return (
        <group position={[0.7, 1.5, WALL_BACK_Z + 0.015]}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={[0.64, 0.49, 0.025]} />
                <meshStandardMaterial color={PICTURE_FRAME_COLOR} roughness={0.45} metalness={0.1} />
            </mesh>
            <mesh position={[0, 0, 0.014]}>
                <planeGeometry args={[0.56, 0.41]} />
                <meshStandardMaterial map={art} roughness={0.85} metalness={0} />
            </mesh>
        </group>
    );
};

// Ventana con marco sobre la pared trasera. El "vidrio" es un plano casi blanco sin
// tonemapping: queda quemado como un exterior a plena luz — vende la foto.
const Window = () => {
    const [wx, wy] = WINDOW_CENTER;
    const z = WALL_BACK_Z + 0.01;
    const f = 0.045; // grosor del marco
    return (
        <group>
            <mesh position={[wx, wy, z]}>
                <planeGeometry args={[WINDOW_W - f, WINDOW_H - f]} />
                <meshBasicMaterial color={'#fdfcf8'} toneMapped={false} />
            </mesh>
            {/* marco: 4 listones + travesaño central */}
            <mesh position={[wx, wy + WINDOW_H / 2, z + 0.01]} castShadow>
                <boxGeometry args={[WINDOW_W + f, f, 0.05]} />
                <meshStandardMaterial color={WINDOW_FRAME_COLOR} roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[wx, wy - WINDOW_H / 2, z + 0.01]} castShadow>
                <boxGeometry args={[WINDOW_W + f, f, 0.05]} />
                <meshStandardMaterial color={WINDOW_FRAME_COLOR} roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[wx - WINDOW_W / 2, wy, z + 0.01]} castShadow>
                <boxGeometry args={[f, WINDOW_H + f, 0.05]} />
                <meshStandardMaterial color={WINDOW_FRAME_COLOR} roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[wx + WINDOW_W / 2, wy, z + 0.01]} castShadow>
                <boxGeometry args={[f, WINDOW_H + f, 0.05]} />
                <meshStandardMaterial color={WINDOW_FRAME_COLOR} roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh position={[wx, wy, z + 0.008]}>
                <boxGeometry args={[WINDOW_W, 0.025, 0.03]} />
                <meshStandardMaterial color={WINDOW_FRAME_COLOR} roughness={0.5} metalness={0.3} />
            </mesh>
            {/* alféizar */}
            <mesh position={[wx, wy - WINDOW_H / 2 - f / 2 - 0.01, z + 0.03]} castShadow>
                <boxGeometry args={[WINDOW_W + 0.16, 0.03, 0.09]} />
                <meshStandardMaterial color={'#e8e4dd'} roughness={0.6} metalness={0} />
            </mesh>
        </group>
    );
};

const RoomGeometry = () => (
    <group>
        <ParquetFloor />

        {/* techo */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, 0]}>
            <planeGeometry args={[ROOM_SIZE, ROOM_SIZE]} />
            <meshStandardMaterial color={CEILING_COLOR} roughness={0.95} metalness={0} />
        </mesh>

        <mesh position={[0, WALL_HEIGHT / 2, WALL_BACK_Z]} receiveShadow>
            <planeGeometry args={[ROOM_SIZE, WALL_HEIGHT]} />
            <meshStandardMaterial color={WALL_COLOR} roughness={0.95} metalness={0} />
        </mesh>

        <mesh rotation={[0, Math.PI / 2, 0]} position={[WALL_LEFT_X, WALL_HEIGHT / 2, 0]} receiveShadow>
            <planeGeometry args={[ROOM_SIZE, WALL_HEIGHT]} />
            <meshStandardMaterial color={WALL_COLOR} roughness={0.95} metalness={0} />
        </mesh>

        <mesh position={[0, SKIRTING_HEIGHT / 2, WALL_BACK_Z + SKIRTING_DEPTH / 2]} receiveShadow>
            <boxGeometry args={[ROOM_SIZE, SKIRTING_HEIGHT, SKIRTING_DEPTH]} />
            <meshStandardMaterial color={SKIRTING_COLOR} roughness={0.6} metalness={0} />
        </mesh>
        <mesh position={[WALL_LEFT_X + SKIRTING_DEPTH / 2, SKIRTING_HEIGHT / 2, 0]} receiveShadow>
            <boxGeometry args={[SKIRTING_DEPTH, SKIRTING_HEIGHT, ROOM_SIZE]} />
            <meshStandardMaterial color={SKIRTING_COLOR} roughness={0.6} metalness={0} />
        </mesh>

        <Window />
        <Picture />
    </group>
);

const RoomLighting = () => (
    <group>
        <hemisphereLight intensity={HEMI_INTENSITY} color={'#fff8ef'} groundColor={'#b3a897'} />
        <directionalLight
            position={KEY_LIGHT_POS}
            intensity={KEY_LIGHT_INTENSITY}
            color={KEY_LIGHT_COLOR}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.1}
            shadow-camera-far={12}
            shadow-camera-left={-3}
            shadow-camera-right={3}
            shadow-camera-top={3}
            shadow-camera-bottom={-3}
            shadow-bias={-0.0001}
            shadow-normalBias={0.02}
        />
        <directionalLight position={FILL_LIGHT_POS} intensity={FILL_LIGHT_INTENSITY} color={FILL_LIGHT_COLOR} />
        {/* luz de la ventana visible en la pared trasera */}
        <AreaLight
            position={[WINDOW_CENTER[0], WINDOW_CENTER[1], WALL_BACK_Z + 0.04]}
            size={[WINDOW_W, WINDOW_H]}
            intensity={WINDOW_LIGHT_INTENSITY}
        />
        {/* ventana fuera de cuadro detrás de la cámara */}
        <AreaLight
            position={FRONT_SOFT_POS}
            size={FRONT_SOFT_SIZE}
            intensity={FRONT_SOFT_INTENSITY}
            color={'#fffaf2'}
        />
    </group>
);

const DefaultLighting = () => (
    <group>
        <ambientLight intensity={0.3} />
        <directionalLight
            position={[5, 8, 5]}
            intensity={0.8}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.1}
            shadow-camera-far={20}
            shadow-camera-left={-3}
            shadow-camera-right={3}
            shadow-camera-top={3}
            shadow-camera-bottom={-3}
            shadow-bias={-0.0001}
        />
        <directionalLight position={[-4, 6, -3]} intensity={0.3} />
        <directionalLight position={[0, 10, -5]} intensity={0.2} />
    </group>
);

export const RoomEnvironment = () => {
    const { scene } = useThree();
    const environment = useConfigStore((state) => state.environment);
    const roomActive = environment === 'room';

    useEffect(() => {
        scene.background = new THREE.Color(SCENE_BG_COLOR);
    }, [scene]);

    return (
        <group>
            {/* HDR self-hosteado (mismo "studio" de drei) — sin depender del CDN externo. */}
            <Environment files="/configurador/hdr/studio.hdr" background={false} />
            <ContactShadows position={[0, 0.001, 0]} opacity={0.4} scale={10} blur={2.5} far={1} />

            <FadeGroup active={!roomActive}>
                <DefaultLighting />
            </FadeGroup>

            <FadeGroup active={roomActive}>
                <RoomGeometry />
                <RoomLighting />
            </FadeGroup>
        </group>
    );
};
