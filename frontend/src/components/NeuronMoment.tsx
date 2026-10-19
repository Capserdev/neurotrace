import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { Reveal } from "./Reveal";

// The "phoenix" reimagined for a neuroscience project: a glowing iridescent
// neuron (soma + dendrites) with a radiant halo and sparks firing outward - the
// noomo iridescent-shimmer look, on-theme. Real-time WebGL, no pre-rendered
// assets.

const iriVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const iriFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  vec3 pal(float t){ return 0.55 + 0.45*cos(6.28318*(t + vec3(0.0,0.33,0.67))); }
  void main() {
    float fres = pow(1.0 - clamp(dot(vNormal, vView), 0.0, 1.0), 2.0);
    float hue = fres * 1.3 + uTime * 0.05;
    vec3 col = pal(hue);
    col = mix(col, vec3(0.96,0.94,0.90), 0.12);
    col += fres * 0.45;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  vec3 pal(float t){ return 0.55 + 0.45*cos(6.28318*(t + vec3(0.0,0.33,0.67))); }
  void main() {
    float rim = pow(1.0 - clamp(dot(vNormal, vView), 0.0, 1.0), 3.0);
    vec3 col = pal(uTime * 0.08 + 0.2);
    gl_FragColor = vec4(col * rim, rim * 0.9);
  }
`;

function Soma() {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const glowUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    glowUniforms.uTime.value = t;
    if (ref.current) {
      ref.current.rotation.y = t * 0.15;
      ref.current.rotation.x = Math.sin(t * 0.2) * 0.2;
      const s = 1 + Math.sin(t * 1.2) * 0.03;
      ref.current.scale.setScalar(s);
    }
    if (glowRef.current) glowRef.current.rotation.y = -t * 0.1;
  });

  return (
    <group>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1, 5]} />
        <shaderMaterial vertexShader={iriVertex} fragmentShader={iriFragment} uniforms={uniforms} />
      </mesh>
      <mesh ref={glowRef} scale={1.35}>
        <icosahedronGeometry args={[1, 3]} />
        <shaderMaterial
          vertexShader={iriVertex}
          fragmentShader={glowFragment}
          uniforms={glowUniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

function Dendrites() {
  const count = 8;
  const dendrites = useMemo(() => {
    const arr: THREE.Vector3[][] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.3;
      const tilt = (Math.random() - 0.5) * 0.8;
      const len = 2.2 + Math.random() * 1.1;
      const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), tilt).normalize();
      const start = dir.clone().multiplyScalar(0.95);
      const end = dir.clone().multiplyScalar(len);
      const mid = start
        .clone()
        .lerp(end, 0.5)
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.6));
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      arr.push(curve.getPoints(24));
    }
    return arr;
  }, []);

  const sparkRefs = useRef<(THREE.Mesh | null)[]>([]);
  const phases = useMemo(() => dendrites.map(() => Math.random()), [dendrites]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    dendrites.forEach((pts, i) => {
      const spark = sparkRefs.current[i];
      if (!spark) return;
      const p = (t * 0.35 + phases[i]) % 1;
      const f = p * (pts.length - 1);
      const i0 = Math.floor(f);
      const frac = f - i0;
      const a = pts[i0];
      const b = pts[Math.min(pts.length - 1, i0 + 1)];
      spark.position.lerpVectors(a, b, frac);
      const scale = 0.06 + Math.sin(p * Math.PI) * 0.06;
      spark.scale.setScalar(scale);
    });
  });

  return (
    <group>
      {dendrites.map((pts, i) => (
        <group key={i}>
          <Line points={pts} color="#8a5cf6" lineWidth={1.4} transparent opacity={0.4} />
          <mesh position={pts[pts.length - 1]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshBasicMaterial color="#62c6e8" />
          </mesh>
          <mesh ref={(el) => { sparkRefs.current[i] = el; }}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Halo() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((s) => (uniforms.uTime.value = s.clock.elapsedTime));
  return (
    <mesh position={[0, 0, -1.5]} scale={7}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`
          precision highp float; varying vec2 vUv; uniform float uTime;
          vec3 pal(float t){ return 0.55 + 0.45*cos(6.28318*(t + vec3(0.0,0.33,0.67))); }
          void main(){
            float d = distance(vUv, vec2(0.5));
            float a = smoothstep(0.5, 0.0, d);
            vec3 col = pal(uTime*0.06);
            gl_FragColor = vec4(col, a*0.5);
          }
        `}
      />
    </mesh>
  );
}

export function NeuronMoment() {
  return (
    <section className="neuron-moment" id="spark">
      <div className="neuron-moment__canvas" aria-hidden="true">
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }} gl={{ alpha: true, antialias: true }} dpr={[1, 1.8]}>
          <Suspense fallback={null}>
            <Halo />
            <Soma />
            <Dendrites />
          </Suspense>
        </Canvas>
      </div>
      <div className="neuron-moment__text container">
        <Reveal as="p" className="eyebrow">
          The signal
        </Reveal>
        <Reveal as="h2" className="display-lg" delay={60}>
          Every diagnosis begins with a spark.
        </Reveal>
        <Reveal as="p" className="lead" delay={120} style={{ marginTop: "1em" }}>
          Parkinsonian disease shows up first in the fine motor signals of speech
          and handwriting - long before a scan. NeuroTrace listens for it.
        </Reveal>
      </div>
      <style>{`
        .neuron-moment { position:relative; min-height:100vh; display:grid; place-items:center;
          background:var(--ink); overflow:hidden; }
        .neuron-moment__canvas { position:absolute; inset:0; z-index:0; }
        .neuron-moment__text { position:relative; z-index:2; text-align:center; color:var(--cream);
          padding:0 clamp(20px,5vw,72px);
          text-shadow:0 2px 30px rgba(10,8,20,0.75), 0 1px 4px rgba(10,8,20,0.6); }
        .neuron-moment__text .eyebrow { color:var(--sky); }
        .neuron-moment__text .lead { color:rgba(244,239,230,0.9); margin-left:auto; margin-right:auto; }
      `}</style>
    </section>
  );
}
