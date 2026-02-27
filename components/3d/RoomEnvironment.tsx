"use client";

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { Environment, useTexture } from '@react-three/drei';
import { useConfigStore } from '@/lib/store';

const WoodFloor = () => {
    const [colorMap, normalMap, roughnessMap] = useTexture([
        '/floor/wood_planks_diff_1k.jpg',
        '/floor/wood_planks_nor_dx_1k.jpg',
        '/floor/wood_planks_rough_1k.jpg'
    ]);

    useEffect(() => {
        [colorMap, normalMap, roughnessMap].forEach((t) => {
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(40, 40);
            t.needsUpdate = true;
        });
        colorMap.colorSpace = THREE.SRGBColorSpace;
    }, [colorMap, normalMap, roughnessMap]);

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial
                map={colorMap}
                normalMap={normalMap}
                roughnessMap={roughnessMap}
            />
        </mesh>
    );
};

const WoodFloor2 = () => {
    const [colorMap, normalMap, roughnessMap] = useTexture([
        '/floor/floor2/wood_planks_grey_diff_1k.jpg',
        '/floor/floor2/wood_planks_grey_nor_dx_1k.jpg',
        '/floor/floor2/wood_planks_grey_rough_1k.jpg'
    ]);

    useEffect(() => {
        [colorMap, normalMap, roughnessMap].forEach((t) => {
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(40, 40);
            t.needsUpdate = true;
        });
        colorMap.colorSpace = THREE.SRGBColorSpace;
    }, [colorMap, normalMap, roughnessMap]);

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial
                map={colorMap}
                normalMap={normalMap}
                roughnessMap={roughnessMap}
            />
        </mesh>
    );
};

export const RoomEnvironment = () => {
    const { scene } = useThree();

    const environmentConfig = useConfigStore((state) => state.environment);

    useEffect(() => {
        // Fondo color sólido gris muy claro
        scene.background = new THREE.Color('#f5f5f5');
    }, [scene]);

    const createRoom = () => {
        if (environmentConfig === 'none') {
            return null;
        }

        switch (environmentConfig) {
            case 'env1':
                return (
                    <group>
                        <WoodFloor />
                        <mesh position={[0, 5, -5]} receiveShadow>
                            <planeGeometry args={[50, 10]} />
                            <meshStandardMaterial color="#ffffff" roughness={1} />
                        </mesh>
                    </group>
                );
            case 'env2':
                return (
                    <group>
                        <WoodFloor2 />
                        <mesh position={[0, 5, -5]} receiveShadow>
                            <planeGeometry args={[50, 10]} />
                            <meshStandardMaterial color="#eeeeee" roughness={1} />
                        </mesh>
                    </group>
                );
            default:
                return null;
        }
    };

    return (
        <group>
            {createRoom()}

            {/* Entorno invisible para generar reflejos hiper realistas hiper cromados en los metales sin manchar el fondo simple */}
            <Environment preset="studio" background={false} />

            {/* Iluminación básica estilo catálogo con sombras */}
            <hemisphereLight intensity={1.0} groundColor="#d0d0d0" color="#ffffff" />
            <directionalLight
                position={[5, 10, 5]}
                intensity={2.0}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0001}
            />
            <directionalLight
                position={[-5, 5, 2]}
                intensity={1.0}
            />
        </group>
    );
};
