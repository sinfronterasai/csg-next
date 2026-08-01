'use client';

import { useEffect, useRef, useState } from 'react';

type Vector3 = { x: number; y: number; z: number };

const STAR_CATALOG: { name: string; position: Vector3; color?: string }[] = [
  { name: 'Sirius', position: { x: 3.2, y: 1.1, z: -2.4 }, color: '#a3d1ff' },
  { name: 'Betelgeuse', position: { x: -3.8, y: 2.6, z: -1.2 }, color: '#ffaa77' },
  { name: 'Rigel', position: { x: -3.1, y: -2.4, z: -0.8 }, color: '#c8e4ff' },
  { name: 'Aldebaran', position: { x: 2.4, y: -3.0, z: -1.6 }, color: '#ffb382' },
  { name: 'Polaris', position: { x: 0.05, y: 4.0, z: -0.9 }, color: '#e8f2ff' },
  { name: 'Vega', position: { x: 1.8, y: 3.4, z: -2.0 }, color: '#c9e4ff' },
  { name: 'Antares', position: { x: -1.9, y: -3.3, z: -1.4 }, color: '#ff9e75' },
  { name: 'Capella', position: { x: 4.1, y: 2.8, z: -1.1 }, color: '#fff0d0' },
];

function waitForSize(container: HTMLDivElement) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const measure = () => {
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 500;
      if (width > 0 && height > 0) {
        resolve({ width, height });
      } else {
        requestAnimationFrame(measure);
      }
    };
    measure();
  });
}

export default function Constellations() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [labels, setLabels] = useState<Array<{ name: string; x: number; y: number }>>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const boot = async () => {
      const THREE_CDN = (window as any).THREE;
      const OrbitControls = (window as any).THREE?.OrbitControls;

      if (!THREE_CDN || !OrbitControls) {
        setTimeout(boot, 50);
        return;
      }

      const { width, height } = await waitForSize(container);
      if (cancelled) return;

      const scene = new THREE_CDN.Scene();
      const camera = new THREE_CDN.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 10;

      const renderer = new THREE_CDN.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.maxDistance = 20;
      controls.minDistance = 4;

      const numNodes = 120;
      const nodePos: number[] = [];
      const nodeGeo = new THREE_CDN.BufferGeometry();
      for (let i = 0; i < numNodes; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1);
        const r = 4.5;
        nodePos.push(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        );
      }
      const nodePosArray = new Float32Array(nodePos);
      nodeGeo.setAttribute('position', new THREE_CDN.BufferAttribute(nodePosArray, 3));

      const nodeMat = new THREE_CDN.PointsMaterial({ color: 0xDFB76C, size: 0.12, transparent: true, opacity: 0.9 });
      const starNodes = new THREE_CDN.Points(nodeGeo, nodeMat);
      scene.add(starNodes);

      const lineGeo = new THREE_CDN.BufferGeometry();
      const lineIndices: number[] = [];
      for (let i = 0; i < numNodes; i++) {
        const p1 = new THREE_CDN.Vector3(nodePosArray[i * 3], nodePosArray[i * 3 + 1], nodePosArray[i * 3 + 2]);
        for (let j = i + 1; j < numNodes; j++) {
          const p2 = new THREE_CDN.Vector3(nodePosArray[j * 3], nodePosArray[j * 3 + 1], nodePosArray[j * 3 + 2]);
          const dist = p1.distanceTo(p2);
          if (dist < 1.6 && Math.random() > 0.4) {
            lineIndices.push(i, j);
          }
        }
      }
      lineGeo.setAttribute('position', new THREE_CDN.BufferAttribute(nodePosArray, 3));
      lineGeo.setIndex(lineIndices);
      const lineMat = new THREE_CDN.LineBasicMaterial({ color: 0x8A2BE2, transparent: true, opacity: 0.25 });
      const constellationLines = new THREE_CDN.LineSegments(lineGeo, lineMat);
      scene.add(constellationLines);

      const bgStarGeo = new THREE_CDN.BufferGeometry();
      const bgStars = 800;
      const bgStarPos: number[] = [];
      for (let i = 0; i < bgStars; i++) {
        bgStarPos.push((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50);
      }
      bgStarGeo.setAttribute('position', new THREE_CDN.Float32BufferAttribute(bgStarPos, 3));
      const bgStarMat = new THREE_CDN.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.4 });
      const bgPoints = new THREE_CDN.Points(bgStarGeo, bgStarMat);
      scene.add(bgPoints);

      const namedStarGroup = new THREE_CDN.Group();
      scene.add(namedStarGroup);

      const namedStars = STAR_CATALOG.map((star) => {
        const geometry = new THREE_CDN.SphereGeometry(0.08, 16, 16);
        const material = new THREE_CDN.MeshBasicMaterial({ color: star.color || '#ffffff' });
        const mesh = new THREE_CDN.Mesh(geometry, material);
        mesh.position.set(star.position.x, star.position.y, star.position.z);
        namedStarGroup.add(mesh);
        return { name: star.name, mesh };
      });

      const tempV = new THREE_CDN.Vector3();

      const updateLabels = () => {
        const rect = container.getBoundingClientRect();
        const next = namedStars.map((star) => {
          tempV.set(star.mesh.position.x, star.mesh.position.y, star.mesh.position.z);
          tempV.project(camera);
          const x = (tempV.x * 0.5 + 0.5) * rect.width;
          const y = (-(tempV.y * 0.5) + 0.5) * rect.height;
          return { name: star.name, x, y };
        });
        setLabels(next);
      };

      let rotationSpeed = 0.002;
      const speedSlider = document.getElementById('star-speed') as HTMLInputElement | null;
      const toggleBtn = document.getElementById('toggle-lines') as HTMLButtonElement | null;

      speedSlider?.addEventListener('input', (e) => {
        rotationSpeed = ((e.target as HTMLInputElement).valueAsNumber / 100) * 0.01;
      });
      toggleBtn?.addEventListener('click', () => {
        constellationLines.visible = !constellationLines.visible;
        if (toggleBtn) toggleBtn.innerText = constellationLines.visible ? 'Hide Lines' : 'Show Lines';
      });

      function animate() {
        requestAnimationFrame(animate);
        starNodes.rotation.y += rotationSpeed;
        constellationLines.rotation.y += rotationSpeed;
        namedStarGroup.rotation.y += rotationSpeed;
        controls.update();
        renderer.render(scene, camera);
        updateLabels();
      }
      animate();

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const w = entry.contentRect.width || width;
        const h = entry.contentRect.height || height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      resizeObserver.observe(container);

      setReady(true);

      return () => {
        cancelled = true;
        resizeObserver.disconnect();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        setReady(false);
      };
    };

    let cleanup: (() => void) | undefined;
    const maybeCleanup = async () => {
      if (cleanup) cleanup();
      cleanup = await boot();
    };

    maybeCleanup();
  }, []);

  return (
    <section className="py-24 relative z-10 bg-cosmic-950/80 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs uppercase tracking-[0.4em] text-gold block">Cosmic Navigator</span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">Interactive <br />Celestial Map</h2>
            <p className="text-gray-400 text-sm font-light leading-relaxed">
              Drag to orbit the celestial vault, scroll to zoom deep into nebulae, and hover over stellar nodes. Interact with the cosmic geometry to realign the stars.
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-center space-x-4 glass-panel p-4 rounded-2xl border-white/5 hover:border-gold/20 transition-all">
                <div className="w-10 h-10 rounded-full bg-cosmic-primary/20 flex items-center justify-center text-cosmic-primary"><i className="fa-solid fa-arrows-spin"></i></div>
                <div>
                  <span className="block text-sm font-semibold text-white">Celestial Speed</span>
                  <input type="range" id="star-speed" min="0" max="100" defaultValue={20} className="w-32 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-gold" />
                </div>
              </div>
              <div className="flex items-center space-x-4 glass-panel p-4 rounded-2xl border-white/5 hover:border-gold/20 transition-all">
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold"><i className="fa-solid fa-wand-magic-sparkles"></i></div>
                <div>
                  <span className="block text-sm font-semibold text-white">Constellation Lines</span>
                  <button id="toggle-lines" className="text-xs bg-gold text-cosmic-950 px-3 py-1 rounded-md font-semibold tracking-wider mt-1 uppercase">Hide Lines</button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 h-[450px] md:h-[550px] relative rounded-[40px] overflow-hidden glass-panel border border-gold/30 glow-border group interactive-canvas-container">
            <div ref={containerRef} id="interactive-canvas-container" className="w-full h-full" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-300">Loading celestial view…</div>
            )}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {labels.map((label) => (
                <span
                  key={label.name}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium text-white/90 drop-shadow-md"
                  style={{ left: `${label.x}px`, top: `${label.y}px`, textShadow: '0 0 6px rgba(0,0,0,0.75)' }}
                >
                  {label.name}
                </span>
              ))}
            </div>
            <div className="absolute bottom-6 left-6 pointer-events-none glass-panel px-4 py-2.5 rounded-full border-white/5 flex items-center space-x-3 text-xs tracking-wider">
              <i className="fa-solid fa-hand-pointer text-gold animate-bounce"></i>
              <span className="text-gray-300">Left Click + Drag to rotate celestial sphere</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
