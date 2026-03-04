"use client";

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { Environment, useTexture, ContactShadows } from '@react-three/drei';
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
            <meshBasicMaterial
                map={colorMap}
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
            <meshBasicMaterial
                map={colorMap}
            />
        </mesh>
    );
};

const WoodFloor3 = () => {
    const [colorMap, normalMap, roughnessMap] = useTexture([
        '/floor/floor3/WoodFloor052_1K-JPG_Color.jpg',
        '/floor/floor3/WoodFloor052_1K-JPG_NormalDX.jpg',
        '/floor/floor3/WoodFloor052_1K-JPG_Roughness.jpg'
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
            <meshBasicMaterial
                map={colorMap}
            />
        </mesh>
    );
};

export const RoomEnvironment = () => {
    const { scene } = useThree();

    const environmentConfig = useConfigStore((state) => state.environment);

    useEffect(() => {
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
                            <meshStandardMaterial color="#ffffff" roughness={1} envMapIntensity={0} />
                        </mesh>
                    </group>
                );
            case 'env2':
                return (
                    <group>
                        <WoodFloor2 />
                        <mesh position={[0, 5, -5]} receiveShadow>
                            <planeGeometry args={[50, 10]} />
                            <meshStandardMaterial color="#eeeeee" roughness={1} envMapIntensity={0} />
                        </mesh>
                    </group>
                );
            case 'env3':
                return (
                    <group>
                        <WoodFloor3 />
                        <mesh position={[0, 5, -5]} receiveShadow>
                            <planeGeometry args={[50, 10]} />
                            <meshStandardMaterial color="#f0f0f0" roughness={1} envMapIntensity={0} />
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

            {/* Environment map for realistic metallic reflections */}
            <Environment preset="studio" background={false} />

            {/* Soft contact shadow under furniture — like Konektra's groundPlaneShadow */}
            <ContactShadows
                position={[0, 0.001, 0]}
                opacity={0.4}
                scale={10}
                blur={2.5}
                far={1}
            />

            {/* Soft ambient — just enough to fill deep shadows without washing out */}
            <ambientLight intensity={0.3} />

            {/* Key light — main shadow caster, moderate intensity */}
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
            {/* Fill light — softer, opposite side */}
            <directionalLight position={[-4, 6, -3]} intensity={0.3} />
            {/* Rim / top light — subtle separation */}
            <directionalLight position={[0, 10, -5]} intensity={0.2} />
        </group>
    );
};
