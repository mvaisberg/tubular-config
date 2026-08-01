"use client";

import { useConfigStore } from '@/lib/store';
import { useRef, useEffect, Suspense, useState, useCallback } from 'react';
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { RoomEnvironment } from "./RoomEnvironment";
import { FurnitureController } from "./FurnitureController";
import * as THREE from 'three';

const CameraController = () => {
    const cameraResetVersion = useConfigStore((state) => state.cameraResetVersion);
    const modules = useConfigStore((state) => state.modules);
    const { camera, size } = useThree();
    const controlsRef = useRef<any>(null);
    const targetPos = useRef(new THREE.Vector3());
    const targetLookAt = useRef(new THREE.Vector3(0, 0.4, 0));
    const animating = useRef(false);

    const computeFit = useCallback(() => {
        if (modules.length === 0 || !size.width || !size.height) return null;
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        modules.forEach(m => {
            minX = Math.min(minX, m.position.x);
            maxX = Math.max(maxX, m.position.x + m.size.w);
            minY = Math.min(minY, m.position.y);
            maxY = Math.max(maxY, m.position.y + m.size.h);
            minZ = Math.min(minZ, m.position.z);
            maxZ = Math.max(maxZ, m.position.z + m.size.d);
        });
        // Match FurnitureController: model is centered in X/Z at origin, rests on floor (Y=0)
        const w = (maxX - minX) * 0.001;
        const h = (maxY - minY) * 0.001;
        const d = (maxZ - minZ) * 0.001;
        const radius = Math.sqrt(w * w + h * h + d * d) / 2;
        const center = new THREE.Vector3(0, h / 2, 0);
        const persp = camera as THREE.PerspectiveCamera;
        const fovV = (persp.fov * Math.PI) / 180;
        const aspect = size.width / size.height;
        const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
        const halfFov = Math.min(fovV, fovH) / 2;
        // Floor the distance so small muebles (1 módulo chico) no quedan pegados a la cámara.
        const fitDistance = (radius / Math.sin(halfFov)) * 1.2;
        const distance = Math.max(fitDistance, 2.0);
        const dir = new THREE.Vector3(1, 1, 1).normalize();
        const pos = center.clone().add(dir.multiplyScalar(distance));
        return { pos, target: center };
    }, [modules, camera, size.width, size.height]);

    // Auto-fit on viewport change only (sheet open/close, window resize).
    // Adding/removing modules does NOT trigger a refit — the user can use the toolbar's
    // "centrar cámara" button if they want to recenter.
    useEffect(() => {
        const fit = computeFit();
        if (fit) {
            targetPos.current.copy(fit.pos);
            targetLookAt.current.copy(fit.target);
            animating.current = true;
        }
    }, [size.width, size.height]);

    // Cancel the in-flight lerp as soon as the user touches the orbit controls,
    // otherwise drag/zoom gestures get stomped on by camera.position.lerp() each frame.
    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;
        const onStart = () => { animating.current = false; };
        controls.addEventListener('start', onStart);
        return () => controls.removeEventListener('start', onStart);
    }, []);

    // Manual reset trigger (toolbar center button)
    useEffect(() => {
        if (cameraResetVersion > 0) {
            const fit = computeFit();
            if (fit) {
                targetPos.current.copy(fit.pos);
                targetLookAt.current.copy(fit.target);
                animating.current = true;
            }
        }
    }, [cameraResetVersion]);

    useFrame(() => {
        if (!animating.current || !controlsRef.current) return;
        const k = 0.12;
        camera.position.lerp(targetPos.current, k);
        controlsRef.current.target.lerp(targetLookAt.current, k);
        controlsRef.current.update();
        if (camera.position.distanceTo(targetPos.current) < 0.005) {
            camera.position.copy(targetPos.current);
            controlsRef.current.target.copy(targetLookAt.current);
            controlsRef.current.update();
            animating.current = false;
        }
    });

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            maxPolarAngle={Math.PI / 2 - 0.05}
            minPolarAngle={0}
            maxDistance={8}
            minDistance={0.6}
            target={[0, 0.4, 0]}
        />
    );
};

export default function Scene() {
    const selectModule = useConfigStore((state) => state.actions.selectModule);
    const setShowAddButtons = useConfigStore((state) => state.actions.setShowAddButtons);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div className="w-full h-full">
            <Canvas
                shadows
                dpr={[1, 2]}
                gl={{
                    preserveDrawingBuffer: true,
                    antialias: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.0,
                }}
                camera={{ position: isMobile ? [1.1, 1.1, 1.1] : [1.4, 1.4, 1.4], fov: 50 }}
                onPointerMissed={() => {
                    selectModule(null);
                    setShowAddButtons(false);
                }}
            >
                <Suspense fallback={null}>
                    <RoomEnvironment />
                    <CameraController />

                    <FurnitureController />
                </Suspense>
            </Canvas>
        </div>
    );
}
