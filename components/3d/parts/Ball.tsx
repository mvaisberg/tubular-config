import { Instance, Instances } from '@react-three/drei';
import { useMemo } from 'react';

// Using Instances for performance if we have many balls
export const Ball = ({ position }: { position: [number, number, number] }) => {
    // scale down: mm -> m
    const pos: [number, number, number] = [position[0] * 0.001, position[1] * 0.001, position[2] * 0.001];
    return (
        <mesh position={pos}>
            <sphereGeometry args={[0.0125, 16, 16]} />
            <meshStandardMaterial color="#d4d4d4" metalness={0.8} roughness={0.2} />
        </mesh>
    );
};
