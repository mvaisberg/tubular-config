"use client";

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { Environment } from '@react-three/drei';

export const RoomEnvironment = () => {
    const { scene } = useThree();

    useEffect(() => {
        // Fondo color sólido gris muy claro
        scene.background = new THREE.Color('#f5f5f5');
    }, [scene]);

    // Función createRoom() para agregar piso y pared trasera simples
    const createRoom = () => (
        <group>
            {/* Piso que recibe sombras */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[50, 50]} />
                <meshStandardMaterial color="#eeeeee" roughness={0.8} />
            </mesh>

            {/* Pared trasera simple (opcional para dar límite visual) */}
            <mesh position={[0, 5, -5]} receiveShadow>
                <planeGeometry args={[50, 10]} />
                <meshStandardMaterial color="#f5f5f5" roughness={1} />
            </mesh>
        </group>
    );

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
