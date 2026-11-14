import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Loader2, RotateCcw } from "lucide-react";
import type { SiteDetail } from "../lib/types";
import { sampleGrid } from "../lib/dem";
import { bodyState } from "../lib/time";

/**
 * 3D view of the real LOLA terrain around a polar site, lit by the Sun at the selected instant
 * (Sun direction from the site's JPL Horizons series). Shadows come from terrain inside the box;
 * the dashed skyline ring is the site's 100 km ray-traced horizon, which is what decides power
 * and comms at the site itself. Display only - no analysis depends on this view.
 */

const RAD = Math.PI / 180;
const AREAS: [number, string][] = [[5000, "±5 km"], [10000, "±10 km"]];
const EXAG: [number, string][] = [[1, "1×"], [2, "2×"], [3, "3×"]];

interface Props {
  site: SiteDetail;
  tH: number;
  height?: number;
}

/** Local East/North unit vectors in the south-polar stereographic map plane at longitude lon. */
function mapFrame(lonDeg: number) {
  const l = lonDeg * RAD;
  return { E: [Math.cos(l), -Math.sin(l)], N: [Math.sin(l), Math.cos(l)] };
}

/** az/el (deg) -> scene direction (x = map x, y = up, z = -map y). */
function sceneDir(az: number, el: number, lonDeg: number): THREE.Vector3 {
  const { E, N } = mapFrame(lonDeg);
  const h = Math.cos(el * RAD);
  const s = Math.sin(az * RAD), c = Math.cos(az * RAD);
  const mx = h * (s * E[0] + c * N[0]);
  const my = h * (s * E[1] + c * N[1]);
  return new THREE.Vector3(mx, Math.sin(el * RAD), -my).normalize();
}

function glowTexture(inner: string, outer: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function labelSprite(text: string, color = "#cbd5e1"): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.font = "600 40px Inter, system-ui, sans-serif";
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.1, 1.1, 1);
  return s;
}

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  sunLight: THREE.DirectionalLight;
  sun: THREE.Sprite;
  earth: THREE.Sprite;
  marker: THREE.Mesh;
  ringR: number;
  /** latest Sun direction (scene), used to frame the default view */
  sunDir: THREE.Vector3;
  render: () => void;
  resetView: () => void;
  dispose: () => void;
}

export default function Terrain3D({ site, tH, height = 360 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const refs = useRef<SceneRefs | null>(null);
  const [half, setHalf] = useState(10000);
  const [exag, setExag] = useState(2);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [err, setErr] = useState("");

  const sun = bodyState(site.sun, site.horizon_mask_deg, tH, site.time.step_h);
  const earth = bodyState(site.earth, site.horizon_mask_deg, tH, site.time.step_h);

  // Build the scene for a site / area / exaggeration.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    setStatus("loading");
    const n = half > 6000 ? 201 : 161;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setStatus("error");
      setErr("WebGL is not available in this browser.");
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#04060c");
    const camera = new THREE.PerspectiveCamera(45, 1, 0.02, 600);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.maxPolarAngle = 88 * RAD;
    controls.minDistance = 1;
    controls.maxDistance = 80;

    scene.add(new THREE.AmbientLight(0x9fb3d9, 0.14)); // faint fill (stands in for earthshine) so shadowed relief stays readable
    const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
    sunLight.castShadow = true;
    const k = (half / 1000) * 1.6;
    Object.assign(sunLight.shadow.camera, { left: -k, right: k, top: k, bottom: -k, near: 0.1, far: 200 });
    sunLight.shadow.mapSize.set(4096, 4096);
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.03;
    scene.add(sunLight, sunLight.target);

    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(255,244,214,1)", "rgba(255,200,80,0)"), depthWrite: false, transparent: true }));
    sunSprite.scale.set(4, 4, 1);
    const earthSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(125,200,255,1)", "rgba(60,130,255,0)"), depthWrite: false, transparent: true }));
    earthSprite.scale.set(3, 3, 1);
    scene.add(sunSprite, earthSprite);

    const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 12), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    marker.position.y = 0.3;
    scene.add(marker);

    const ringR = (half / 1000) * 1.35;
    const disposables: { dispose: () => void }[] = [];

    const render = () => renderer.render(scene, camera);
    const resetView = () => {
      // Side-lit view: stand ~70 deg round from the Sun's side, so sunlit slopes face the camera and
      // the long, grazing polar shadows run across the frame (a camera facing the Sun only sees the
      // shadowed back slopes, because the Sun sits on the horizon).
      const sd = refs.current?.sunDir ?? new THREE.Vector3(0, 0, -1);
      const hz = new THREE.Vector3(sd.x, 0, sd.z);
      if (hz.lengthSq() < 1e-6) hz.set(0, 0, -1);
      hz.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 110 * RAD);
      const dist = (half / 1000) * 1.9;
      camera.position.set(-hz.x * dist, (half / 1000) * 0.95, -hz.z * dist);
      controls.target.set(0, 0, 0);
      controls.update();
      render();
    };
    controls.addEventListener("change", render);

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    });
    ro.observe(el);

    sampleGrid(site.lat, site.lon, half, n)
      .then(({ heights, step, radius }) => {
        if (cancelled) return;
        const c = (n - 1) / 2;
        const h0 = heights[c * n + c];
        let minH = Infinity;
        for (const v of heights) if (isFinite(v) && v < minH) minH = v;
        const geo = new THREE.PlaneGeometry((2 * half) / 1000, (2 * half) / 1000, n - 1, n - 1);
        geo.rotateX(-Math.PI / 2); // plane row 0 (map +y) -> scene -z
        const pos = geo.attributes.position as THREE.BufferAttribute;
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            const idx = j * n + i;
            const dx = (i - c) * step, dy = (c - j) * step;
            const hm = isFinite(heights[idx]) ? heights[idx] : minH;
            const drop = (dx * dx + dy * dy) / (2 * radius); // lunar curvature (not exaggerated)
            pos.setY(idx, ((hm - h0) * exag - drop) / 1000);
          }
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({ color: 0xa8a49c, roughness: 1, metalness: 0 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        disposables.push(geo, mat);

        // Real 100 km skyline (angles are true, not exaggerated), drawn as a dashed ring.
        const pts: THREE.Vector3[] = [];
        for (let a = 0; a <= 360; a++) {
          const d = sceneDir(a, 0, site.lon);
          const m = site.horizon_mask_deg[a % 360];
          pts.push(new THREE.Vector3(d.x * ringR, Math.tan(m * RAD) * ringR + 0.002, d.z * ringR));
        }
        const ringGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const ringMat = new THREE.LineDashedMaterial({ color: 0x7dd3fc, dashSize: 0.25, gapSize: 0.15, transparent: true, opacity: 0.8 });
        const ring = new THREE.Line(ringGeo, ringMat);
        ring.computeLineDistances();
        scene.add(ring);
        disposables.push(ringGeo, ringMat);

        for (const [label, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]] as [string, number][]) {
          const s = labelSprite(label, label === "N" ? "#f8fafc" : "#94a3b8");
          const d = sceneDir(az, 0, site.lon);
          s.position.set(d.x * (ringR + 0.9), 0.4, d.z * (ringR + 0.9));
          scene.add(s);
        }

        setStatus("ready");
        resetView();
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus("error");
        setErr(e instanceof Error ? e.message : String(e));
      });

    refs.current = {
      renderer, scene, camera, controls, sunLight, sun: sunSprite, earth: earthSprite, marker, ringR, render, resetView,
      sunDir: sceneDir(sun.az, sun.el, site.lon),
      dispose: () => {
        ro.disconnect();
        controls.dispose();
        disposables.forEach((d) => d.dispose());
        scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (m && "map" in m && (m as THREE.SpriteMaterial).map) (m as THREE.SpriteMaterial).map!.dispose();
          m?.dispose?.();
          (o as THREE.Mesh).geometry?.dispose?.();
        });
        renderer.dispose();
        renderer.domElement.remove();
      },
    };
    return () => {
      cancelled = true;
      refs.current?.dispose();
      refs.current = null;
    };
  }, [site.id, site.lat, site.lon, site.horizon_mask_deg, half, exag]);

  // Move the Sun / Earth and update the light for the selected time.
  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    const sd = sceneDir(sun.az, sun.el, site.lon);
    const ed = sceneDir(earth.az, earth.el, site.lon);
    const D = r.ringR * 2.2;
    r.sunDir = sd;
    r.sunLight.position.copy(sd.clone().multiplyScalar(60));
    // Polar ridges can see the Sun a few degrees below the observer's horizontal plane, so keep the
    // light on unless the Sun is far below it; the shadow map decides what is actually lit.
    r.sunLight.intensity = sun.el > -8 ? 3.2 : 0;
    r.sun.position.copy(sd.clone().multiplyScalar(D));
    r.sun.visible = sun.el > -8;
    r.earth.position.copy(ed.clone().multiplyScalar(D));
    r.earth.visible = earth.el > -8;
    (r.marker.material as THREE.MeshBasicMaterial).color.set(sun.visible ? 0xfbbf24 : 0x64748b);
    // Bodies hidden behind the real (100 km) skyline are drawn faint.
    (r.sun.material as THREE.SpriteMaterial).opacity = sun.visible ? 1 : 0.3;
    (r.earth.material as THREE.SpriteMaterial).opacity = earth.visible ? 1 : 0.3;
    r.render();
  }, [sun.az, sun.el, sun.visible, earth.az, earth.el, site.lon, status]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`rounded px-1.5 py-0.5 font-medium ${sun.visible ? "bg-amber-500/15 text-amber-200" : "bg-slate-500/15 text-slate-300"}`}>
          Site {sun.visible ? "in sunlight" : "in shadow"}
        </span>
        <span className={`rounded px-1.5 py-0.5 font-medium ${earth.visible ? "bg-sky-500/15 text-sky-200" : "bg-slate-500/15 text-slate-300"}`}>
          Earth {earth.visible ? "in view" : "hidden"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-slate-400">area</span>
          <div className="flex overflow-hidden rounded-md border border-space-600">
            {AREAS.map(([v, l]) => (
              <button key={v} type="button" onClick={() => setHalf(v)} className={`px-2 py-1 ${half === v ? "bg-sky-500/20 text-sky-200" : "bg-space-800 text-slate-400 hover:bg-space-700"}`}>{l}</button>
            ))}
          </div>
          <span className="text-slate-400">relief</span>
          <div className="flex overflow-hidden rounded-md border border-space-600">
            {EXAG.map(([v, l]) => (
              <button key={v} type="button" onClick={() => setExag(v)} className={`px-2 py-1 ${exag === v ? "bg-sky-500/20 text-sky-200" : "bg-space-800 text-slate-400 hover:bg-space-700"}`}>{l}</button>
            ))}
          </div>
          <button type="button" onClick={() => refs.current?.resetView()} className="rounded-md border border-space-600 bg-space-800 p-1 text-slate-300 hover:bg-space-700" aria-label="Reset 3D view" title="Reset view">
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-md border border-space-700" style={{ height }}>
        <div ref={host} className="absolute inset-0" aria-label={`3D terrain around ${site.name}`} role="img" />
        {status !== "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-space-950/70 text-xs text-slate-300">
            {status === "loading" ? <span className="inline-flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Loading LOLA terrain…</span> : <span className="text-rose-300">{err}</span>}
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-space-950/80 px-1.5 py-0.5 text-[11px] text-slate-300">
          drag to orbit · scroll to zoom · right-drag to pan
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
        Real LOLA 80 m terrain, {half / 1000 * 2} × {half / 1000 * 2} km around the site (yellow pin), lit by the Sun at the selected time.
        Shadows come from terrain inside this box; the dashed blue ring is the site's skyline ray-traced out to 100 km, which is what decides
        power and comms at the pin. Relief {exag > 1 ? `exaggerated ${exag}×` : "true scale"}; lunar curvature included. Glows mark the Sun and Earth directions (faint = hidden behind the skyline as seen from the pin).
      </p>
    </div>
  );
}
