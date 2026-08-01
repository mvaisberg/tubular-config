"use client";

import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { Environment, ContactShadows } from '@react-three/drei';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { useConfigStore } from '@/lib/store';

const FLOOR_COLOR = '#8a8a8a';
const WALL_COLOR = '#f5f2ed';
const SKIRTING_COLOR = '#6b6b6b';
const PICTURE_FRAME_COLOR = '#3a3a3a';
const PICTURE_ART_COLOR = '#b8a890';
const SCENE_BG_COLOR = '#f5f5f5';

// All dimensions in meters (Three.js world units). Mueble es ~0.75m × 0.35m × 0.35m por módulo.
const ROOM_SIZE = 6;          // 6m × 6m floor (residencial chico)
const WALL_HEIGHT = 2.6;      // 2.6m de altura de techo (estándar)
const WALL_BACK_Z = -1.8;     // pared trasera a 1.8m del centro
const WALL_LEFT_X = -1.8;     // pared izquierda a 1.8m del centro
const SKIRTING_HEIGHT = 0.08; // zócalo de 8cm
const SKIRTING_DEPTH = 0.015; // 15mm de salida

const HEMI_INTENSITY = 0.35;
const KEY_LIGHT_INTENSITY = 1.0;
const KEY_LIGHT_COLOR = '#fff4e6';
const KEY_LIGHT_POS: [number, number, number] = [3, 5, 2];
const FILL_LIGHT_INTENSITY = 0.3;
const FILL_LIGHT_POS: [number, number, number] = [-2.5, 3, 2];
const WINDOW_LIGHT_INTENSITY = 2.5;
const WINDOW_LIGHT_SIZE: [number, number] = [1.4, 1.1];
const WINDOW_LIGHT_POS: [number, number, number] = [0, 1.7, WALL_BACK_Z + 0.04];

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

const WindowLight = () => {
    const ref = useRef<THREE.RectAreaLight>(null);
    useLayoutEffect(() => {
        RectAreaLightUniformsLib.init();
        ref.current?.lookAt(0, 0.5, 0);
    }, []);
    return (
        <rectAreaLight
            ref={ref}
            position={WINDOW_LIGHT_POS}
            width={WINDOW_LIGHT_SIZE[0]}
            height={WINDOW_LIGHT_SIZE[1]}
            intensity={WINDOW_LIGHT_INTENSITY}
            color={'#ffffff'}
        />
    );
};

const Picture = () => (
    <group position={[0.7, 1.55, WALL_BACK_Z + 0.012]}>
        <mesh receiveShadow>
            <boxGeometry args={[0.6, 0.45, 0.02]} />
            <meshStandardMaterial color={PICTURE_FRAME_COLOR} roughness={0.6} metalness={0} />
        </mesh>
        <mesh position={[0, 0, 0.011]}>
            <planeGeometry args={[0.52, 0.37]} />
            <meshStandardMaterial color={PICTURE_ART_COLOR} roughness={0.9} metalness={0} />
        </mesh>
    </group>
);

const RoomGeometry = () => (
    <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[ROOM_SIZE, ROOM_SIZE]} />
            <meshStandardMaterial color={FLOOR_COLOR} roughness={0.85} metalness={0} />
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
            <meshStandardMaterial color={SKIRTING_COLOR} roughness={0.7} metalness={0} />
        </mesh>
        <mesh position={[WALL_LEFT_X + SKIRTING_DEPTH / 2, SKIRTING_HEIGHT / 2, 0]} receiveShadow>
            <boxGeometry args={[SKIRTING_DEPTH, SKIRTING_HEIGHT, ROOM_SIZE]} />
            <meshStandardMaterial color={SKIRTING_COLOR} roughness={0.7} metalness={0} />
        </mesh>

        <Picture />
    </group>
);

const RoomLighting = () => (
    <group>
        <hemisphereLight intensity={HEMI_INTENSITY} color={'#ffffff'} groundColor={'#8d8d8d'} />
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
        />
        <directionalLight position={FILL_LIGHT_POS} intensity={FILL_LIGHT_INTENSITY} />
        <WindowLight />
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
