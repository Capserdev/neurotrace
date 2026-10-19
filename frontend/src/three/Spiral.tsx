import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

// Archimedean spiral - the actual Parkinson's drawing test - rendered as a glowing
// line that slowly rotates and breathes. `tremor` injects the small stroke
// irregularity the paper describes in PD drawings; here it's a subtle, tasteful
// wobble that makes the hero feel alive.
export function Spiral({
  color = "#3e6be0",
  tremor = 0.03,
  turns = 5,
}: {
  color?: string;
  tremor?: number;
  turns?: number;
}) {
  const group = useRef<THREE.Group>(null);

  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const total = turns * 120;
    for (let i = 0; i <= total; i++) {
      const theta = (i / 120) * Math.PI * 2;
      const r = 0.06 * theta;
      const wob =
        tremor *
        Math.sin(theta * 9) *
        (theta / (turns * Math.PI * 2));
      const x = Math.cos(theta) * (r + wob);
      const y = Math.sin(theta) * (r + wob);
      pts.push([x, y, 0]);
    }
    return pts;
  }, [tremor, turns]);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.z += delta * 0.08;
    const s = 1 + Math.sin(state.clock.elapsedTime * 0.6) * 0.02;
    group.current.scale.set(s, s, s);
  });

  return (
    <group ref={group}>
      <Line points={points} color={color} lineWidth={2.4} transparent opacity={0.9} />
      <Line
        points={points}
        color={color}
        lineWidth={7}
        transparent
        opacity={0.12}
      />
    </group>
  );
}
