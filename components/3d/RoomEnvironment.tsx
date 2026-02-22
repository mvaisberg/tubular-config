"use client";

import { useConfigStore } from '@/lib/store';
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const HDR_MAP: Record<string, string> = {
    'none': '/hdr/living.hdr',
    'modern': '/hdr/living.hdr',
    'industrial': '/hdr/living.hdr',
};

export const RoomEnvironment = () => {
    const environment = useConfigStore((state) => state.environment);
    const { gl, scene } = useThree();
    const pmremGenerator = useRef<THREE.PMREMGenerator | null>(null);
    const currentEnvMap = useRef<THREE.Texture | null>(null);

    useEffect(() => {
        pmremGenerator.current = new THREE.PMREMGenerator(gl);
        pmremGenerator.current.compileEquirectangularShader();

        return () => {
            pmremGenerator.current?.dispose();
        };
    }, [gl]);

    useEffect(() => {
        const loadEnvironment = (hdrPath: string) => {
            new RGBELoader().load(hdrPath, (texture) => {
                if (pmremGenerator.current) {
                    const envMap = pmremGenerator.current.fromEquirectangular(texture).texture;

                    if (currentEnvMap.current) {
                        currentEnvMap.current.dispose();
                    }
                    currentEnvMap.current = envMap;

                    scene.environment = envMap;
                    scene.background = envMap;
                }
                texture.dispose();
            });
        };

        const changeEnvironment = (name: string) => {
            const path = HDR_MAP[name] || '/hdr/living.hdr';
            loadEnvironment(path);
        };

        changeEnvironment(environment);

    }, [environment, scene]);

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <shadowMaterial opacity={0.6} />
        </mesh>
    );
};
