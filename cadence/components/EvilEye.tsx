/**
 * @file EvilEye.tsx
 * @description A calm, realistic eye rendered in WebGL via ogl. Adapted from
 *              the React Bits "EvilEye" component — the procedural fire/noise
 *              texture and the vertical-slit pupil have been removed. The
 *              result is a standard almond-shaped eye with a white sclera,
 *              a circular dark iris, a round pupil, and a soft specular
 *              highlight. The iris smoothly tracks the cursor within the eye
 *              to add life without drawing attention away from foreground UI.
 *
 * COGNITIVE DEBT NOTICE:
 *   - The shader uses two overlapping circles to define the almond (lens)
 *     sclera boundary — the region where BOTH circles overlap is "inside
 *     the eye." This is simpler and cheaper than an SDF lens and trivially
 *     anti-aliased via smoothstep on the boundary distance.
 *   - Pointer tracking smooths via exponential lerp (same pattern as the
 *     original React Bits component) so the pupil never jitters.
 *   - The original `noiseScale` and `flameSpeed` props are gone — they
 *     would be dead uniforms in this simplified shader.
 */
'use client';

import { Renderer, Program, Mesh, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';
import './EvilEye.css';

function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const vertexShader = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uResolution;
uniform float uPupilSize;
uniform float uIrisWidth;
uniform float uGlowIntensity;
uniform float uIntensity;
uniform float uScale;
uniform vec2 uMouse;
uniform float uPupilFollow;
uniform vec3 uIrisColor;
uniform vec3 uBgColor;

void main() {
  // Normalize coords, Y-scaled, centered
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
  uv /= uScale;

  // --- Almond (lens) sclera shape -------------------------------------
  // Two overlapping circles define the classic lens/almond: inside means
  // we're within BOTH circles' radii at once.
  const float R = 1.55;   // circle radius
  const float K = 1.10;   // circle center Y offset (controls aspect of the eye)
  float d1 = length(vec2(uv.x, uv.y + K));
  float d2 = length(vec2(uv.x, uv.y - K));
  float scleraEdge = max(d1, d2);            // 0 at eye center, R at boundary
  float edgeAA = fwidth(scleraEdge) + 0.002; // pixel-size anti-alias band
  float sclera = 1.0 - smoothstep(R - edgeAA, R + edgeAA, scleraEdge);

  // --- Iris (circular) tracks the cursor ------------------------------
  vec2 pupilOffset = uMouse * uPupilFollow * 0.22;
  vec2 irisUv = uv - pupilOffset;
  float irisD = length(irisUv);

  float irisR = uIrisWidth * 1.55;
  float irisAA = fwidth(irisD) + 0.003;
  float iris = 1.0 - smoothstep(irisR - irisAA, irisR + irisAA, irisD);
  iris *= sclera; // iris cannot bleed past the sclera

  // Gentle radial darkening inside the iris — reads as depth
  float irisDepth = smoothstep(0.0, irisR, irisD) * 0.25;

  // --- Pupil (round, concentric with iris) ----------------------------
  float pupilR = uPupilSize * irisR * 0.45;
  float pupilAA = fwidth(irisD) + 0.002;
  float pupil = 1.0 - smoothstep(pupilR - pupilAA, pupilR + pupilAA, irisD);
  pupil *= sclera;

  // --- Specular highlight (tiny white dot, upper-left of iris) --------
  vec2 highlightPos = irisUv - vec2(-irisR * 0.38, irisR * 0.38);
  float highlightD = length(highlightPos);
  float highlightR = irisR * 0.10;
  float highlight = 1.0 - smoothstep(highlightR - 0.01, highlightR + 0.005, highlightD);
  highlight *= iris; // only visible on top of the iris

  // --- Soft outer glow around the eye ---------------------------------
  float outside = max(0.0, scleraEdge - R);
  float glow = exp(-outside * 3.2) * uGlowIntensity;

  // --- Compose --------------------------------------------------------
  vec3 scleraColor = vec3(0.97, 0.97, 0.95) * uIntensity;
  vec3 color = uBgColor;

  // Ambient glow haloing the eye
  color += uIrisColor * glow * 0.4;

  // White sclera fill
  color = mix(color, scleraColor, sclera);

  // Iris (dark) with radial depth
  vec3 irisShaded = uIrisColor * (1.0 - irisDepth);
  color = mix(color, irisShaded, iris);

  // Pupil punched to pure black
  color = mix(color, vec3(0.0), pupil);

  // Specular highlight — almost-white, slightly warm
  color = mix(color, vec3(0.98, 0.98, 0.96), highlight * 0.9);

  gl_FragColor = vec4(color, 1.0);
}
`;

interface EvilEyeProps {
  /** Iris color in HEX (the dark disc). Defaults to near-black. */
  eyeColor?: string;
  /** Overall brightness multiplier for the sclera. */
  intensity?: number;
  /** Size of the pupil relative to the iris. Range ~0.3–1.0. */
  pupilSize?: number;
  /** Iris radius in scene units. Range ~0.15–0.4. */
  irisWidth?: number;
  /** Strength of the outer glow halo around the eye. */
  glowIntensity?: number;
  /** Zoom level. >1 zooms in, <1 zooms out. */
  scale?: number;
  /** How much the pupil follows the cursor. 0 disables tracking. */
  pupilFollow?: number;
  /** Background color in HEX. */
  backgroundColor?: string;
}

export default function EvilEye({
  eyeColor = '#080808',
  intensity = 1.0,
  pupilSize = 0.55,
  irisWidth = 0.28,
  glowIntensity = 0.18,
  scale = 0.9,
  pupilFollow = 1.0,
  backgroundColor = '#0d0f0c',
}: EvilEyeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    // Enable derivative functions (fwidth) on WebGL1.
    gl.getExtension('OES_standard_derivatives');

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.ty = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };

    const onMouseLeave = () => {
      mouse.tx = 0;
      mouse.ty = 0;
    };

    // Track from the window, not the container — the canvas is usually
    // pointer-events:none when used as a background, so container-level
    // listeners would never fire.
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uResolution: {
          value: [
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height,
          ],
        },
        uPupilSize: { value: pupilSize },
        uIrisWidth: { value: irisWidth },
        uGlowIntensity: { value: glowIntensity },
        uIntensity: { value: intensity },
        uScale: { value: scale },
        uMouse: { value: [0, 0] },
        uPupilFollow: { value: pupilFollow },
        uIrisColor: { value: hexToVec3(eyeColor) },
        uBgColor: { value: hexToVec3(backgroundColor) },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      renderer.setSize(container.offsetWidth, container.offsetHeight);
      program.uniforms.uResolution.value = [
        gl.canvas.width,
        gl.canvas.height,
        gl.canvas.width / gl.canvas.height,
      ];
    };
    window.addEventListener('resize', resize);
    resize();

    container.appendChild(gl.canvas);

    let animationFrameId = 0;
    const update = () => {
      animationFrameId = requestAnimationFrame(update);
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      program.uniforms.uMouse.value = [mouse.x, mouse.y];
      renderer.render({ scene: mesh });
    };
    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      if (gl.canvas.parentNode === container) {
        container.removeChild(gl.canvas);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    eyeColor,
    intensity,
    pupilSize,
    irisWidth,
    glowIntensity,
    scale,
    pupilFollow,
    backgroundColor,
  ]);

  return <div ref={containerRef} className="evil-eye-container" />;
}
