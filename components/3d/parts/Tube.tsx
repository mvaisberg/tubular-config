import { Axis } from '@/lib/types';
import { useMemo } from 'react';
import * as THREE from 'three';

interface TubeProps {
    position: [number, number, number];
    length: number; // in mm
    orientation: Axis;
}

export const Tube = ({ position, length, orientation }: TubeProps) => {
    // USM Tubes are 19mm diameter
    const radius = 0.0095;
    // Actual tube length is Axis - 2xBallRadius? 
    // Usually Configurator logic simplifies and lets balls swallow ends of tubes.
    // Let's use full length for now to ensure connection, or subtract 25mm (12.5*2).
    // USM Axis 750 -> Tube length ~730.
    // Let's subtract 23mm as per research? Or just 25mm.
    const visualLength = (length - 25) * 0.001;

    const pos: [number, number, number] = [position[0] * 0.001, position[1] * 0.001, position[2] * 0.001];

    // Align cylinder to axis
    // Cylinder geometry default is Y axis.
    const rotation = useMemo(() => {
        if (orientation === 'x') return [0, 0, -Math.PI / 2] as [number, number, number];
        if (orientation === 'z') return [Math.PI / 2, 0, 0] as [number, number, number];
        return [0, 0, 0] as [number, number, number]; // Y is default
    }, [orientation]);

    // Cylinder is centered at origin. We need to move it to "center" of the span.
    // start + length/2
    const centerPos = useMemo(() => {
        const offset = (length * 0.001) / 2;
        if (orientation === 'x') return [pos[0] + offset, pos[1], pos[2]] as [number, number, number];
        if (orientation === 'y') return [pos[0], pos[1] + offset, pos[2]] as [number, number, number];
        return [pos[0], pos[1], pos[2] + offset] as [number, number, number];
    }, [pos, orientation, length]);

    return (
        <mesh position={centerPos} rotation={rotation}>
            <cylinderGeometry args={[radius, radius, visualLength, 16]} />
            <meshStandardMaterial color="#d4d4d4" metalness={0.6} roughness={0.3} />
        </mesh>
    );
};
