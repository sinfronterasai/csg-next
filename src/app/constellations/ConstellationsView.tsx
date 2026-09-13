'use client';

import { useEffect, useRef, useState } from 'react';
import {
  assertMatchingFrames,
  NAVIGATOR_FRAME_BASE,
  raDecToSceneVector,
  VECTOR_UNIT_TOLERANCE,
  type NavigatorFrame,
} from '@/lib/constellations/coordinates';
import { getNamedStarsAtEpoch } from '@/lib/constellations/starCatalog';

type Vector3 = { x: number; y: number; z: number };
type Body = {
  key: string; label: string; glyph: string; category: 'primary' | 'additional'; status: 'available' | 'unavailable';
  rightAscensionDeg?: number; declinationDeg?: number; vector?: Vector3; longitude?: number; sign?: string; signLabel?: string;
  degreeInSign?: number; house?: number | null; retrograde?: boolean; source: 'swiss-ephemeris';
  reason?: 'ephemeris-unavailable' | 'saved-placement-unavailable';
};
type NamedStar = {
  key: string; name: string; status: 'available'; rightAscensionDeg: number; declinationDeg: number;
  vector: Vector3; catalogId: string; catalogEpoch: string; catalogFrame: string; source: string; frame: NavigatorFrame;
};
type NatalResponse = {
  schemaVersion: 'csg-natal-navigator-v1';
  frame: NavigatorFrame;
  birthAnchor: { utc: string; timezone: string; source: 'saved-natal-chart' };
  bodies: Body[];
  namedStars: NamedStar[];
  source: {
    engine: 'swiss-ephemeris'; package: '@fusionstrings/swiss-eph'; flags: number;
    calculationTime: 'UTC-derived Julian day supplied as tjd_ut';
  };
  availability: { primary: 'available'; optionalUnavailable: string[] };
};
type PersonalizationState = 'loading' | 'signed-out' | 'no-chart' | 'unknown-time' | 'unavailable' | 'invalid' | 'known';
type Label = { name: string; x: number; y: number };
type SceneRuntime = {
  THREE: any; scene: any; camera: any; renderer: any; controls: any;
  verifiedStarGroup: any; natalMarkerGroup: any; astronomicalGroup: any; constellationLines: any;
  starMeshes: Array<{ name: string; mesh: any }>;
  markerMeshes: Map<string, any>;
  selectionRings: Map<string, any>;
  textureLoader: any;
  textureCache: Map<string, any>;
};

const PRIMARY_KEYS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
const ADDITIONAL_KEYS = ['chiron', 'juno', 'northnode'] as const;
const BODY_KEYS = [...PRIMARY_KEYS, ...ADDITIONAL_KEYS];
const PUBLIC_CATALOG_EPOCH = '2000-01-01T12:00:00.000Z';
const STAR_COLORS: Record<string, string> = { Sirius: '#a3d1ff', Betelgeuse: '#ffaa77', Rigel: '#c8e4ff', Aldebaran: '#ffb382', Polaris: '#e8f2ff', Vega: '#c9e4ff', Antares: '#ff9e75', Capella: '#fff0d0' };
const FALLBACK_STARS = getNamedStarsAtEpoch(2451545, PUBLIC_CATALOG_EPOCH);
const POSITION_FIELDS = ['rightAscensionDeg', 'declinationDeg', 'vector', 'longitude', 'sign', 'signLabel', 'degreeInSign', 'house', 'retrograde'] as const;
const MARKER_SCALE = 0.68;
const MARKER_ASSETS: Record<string, string> = {
  sun: '/cosmic-navigator/markers/sun.svg', moon: '/cosmic-navigator/markers/moon.svg',
  mercury: '/cosmic-navigator/markers/mercury.svg', venus: '/cosmic-navigator/markers/venus.svg',
  mars: '/cosmic-navigator/markers/mars.svg', jupiter: '/cosmic-navigator/markers/jupiter.svg',
  saturn: '/cosmic-navigator/markers/saturn.svg', uranus: '/cosmic-navigator/markers/uranus.svg',
  neptune: '/cosmic-navigator/markers/neptune.svg', pluto: '/cosmic-navigator/markers/pluto.svg',
  chiron: '/cosmic-navigator/markers/chiron.svg', juno: '/cosmic-navigator/markers/juno.svg',
  northnode: '/cosmic-navigator/markers/north-node.svg',
};
const SELECTION_RING_ASSET = '/cosmic-navigator/effects/selection-ring.svg';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const vectorMatches = (actual: Vector3, expected: Vector3) =>
  Math.abs(actual.x - expected.x) <= VECTOR_UNIT_TOLERANCE &&
  Math.abs(actual.y - expected.y) <= VECTOR_UNIT_TOLERANCE &&
  Math.abs(actual.z - expected.z) <= VECTOR_UNIT_TOLERANCE;

function validPosition(item: { status: string; rightAscensionDeg?: number; declinationDeg?: number; vector?: Vector3 }) {
  if (item.status !== 'available' || !finite(item.rightAscensionDeg) || item.rightAscensionDeg < 0 || item.rightAscensionDeg >= 360 ||
      !finite(item.declinationDeg) || item.declinationDeg < -90 || item.declinationDeg > 90 || !item.vector) return false;
  const { x, y, z } = item.vector;
  if (![x, y, z].every(finite)) return false;
  return vectorMatches(item.vector, raDecToSceneVector(item.rightAscensionDeg, item.declinationDeg));
}

function validAvailableBody(item: Body) {
  return validPosition(item) && typeof item.label === 'string' && !!item.label && typeof item.glyph === 'string' && !!item.glyph &&
    finite(item.longitude) && item.longitude >= 0 && item.longitude < 360 && finite(item.degreeInSign) &&
    item.degreeInSign >= 0 && item.degreeInSign < 30 && typeof item.sign === 'string' && !!item.sign &&
    typeof item.signLabel === 'string' && !!item.signLabel &&
    (item.house === null || (finite(item.house) && Number.isInteger(item.house) && item.house >= 1 && item.house <= 12)) &&
    typeof item.retrograde === 'boolean' && item.source === 'swiss-ephemeris';
}

function validUnavailableBody(item: Body) {
  return item.status === 'unavailable' && item.source === 'swiss-ephemeris' &&
    (item.reason === 'ephemeris-unavailable' || item.reason === 'saved-placement-unavailable') &&
    typeof item.label === 'string' && !!item.label && typeof item.glyph === 'string' && !!item.glyph &&
    POSITION_FIELDS.every((field) => !(field in item)) &&
    Object.keys(item).sort().join('|') === ['category', 'glyph', 'key', 'label', 'reason', 'source', 'status'].join('|');
}

function parsePayload(value: unknown): NatalResponse | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<NatalResponse>;
  const utc = data.birthAnchor?.utc;
  if (data.schemaVersion !== 'csg-natal-navigator-v1' || typeof utc !== 'string' ||
      !finite(Date.parse(utc)) || new Date(Date.parse(utc)).toISOString() !== utc ||
      data.birthAnchor?.source !== 'saved-natal-chart' || typeof data.birthAnchor.timezone !== 'string' || !data.birthAnchor.timezone ||
      !Array.isArray(data.bodies) || !Array.isArray(data.namedStars) ||
      data.source?.engine !== 'swiss-ephemeris' || data.source.package !== '@fusionstrings/swiss-eph' ||
      data.source.flags !== NAVIGATOR_FRAME_BASE.swissFlags ||
      data.source.calculationTime !== 'UTC-derived Julian day supplied as tjd_ut' ||
      data.availability?.primary !== 'available' || !Array.isArray(data.availability.optionalUnavailable)) return null;
  try {
    assertMatchingFrames({ ...NAVIGATOR_FRAME_BASE, epoch: utc }, data.frame as NavigatorFrame);
  } catch { return null; }

  if (data.bodies.length !== BODY_KEYS.length || data.bodies.some((item, index) => {
    const expectedKey = BODY_KEYS[index];
    const expectedCategory = index < PRIMARY_KEYS.length ? 'primary' : 'additional';
    return item.key !== expectedKey || item.category !== expectedCategory ||
      (expectedCategory === 'primary' ? item.status !== 'available' || !validAvailableBody(item) :
        item.status === 'available' ? !validAvailableBody(item) : !validUnavailableBody(item));
  })) return null;

  const unavailable = data.bodies.filter((item) => item.category === 'additional' && item.status === 'unavailable').map((item) => item.key);
  if (data.availability.optionalUnavailable.length !== unavailable.length ||
      data.availability.optionalUnavailable.some((key, index) => key !== unavailable[index])) return null;

  const julianDay = Date.parse(utc) / 86_400_000 + 2_440_587.5;
  let expectedStars: ReturnType<typeof getNamedStarsAtEpoch>;
  try { expectedStars = getNamedStarsAtEpoch(julianDay, utc); } catch { return null; }
  if (data.namedStars.length !== expectedStars.length || data.namedStars.some((item, index) => {
    const expected = expectedStars[index];
    if (!validPosition(item)) return true;
    try { assertMatchingFrames(data.frame as NavigatorFrame, item.frame); } catch { return true; }
    return item.key !== expected.key || item.name !== expected.name || item.status !== expected.status ||
      item.catalogId !== expected.catalogId || item.catalogEpoch !== expected.catalogEpoch ||
      item.catalogFrame !== expected.catalogFrame || item.source !== expected.source ||
      Math.abs(item.rightAscensionDeg - expected.rightAscensionDeg) > VECTOR_UNIT_TOLERANCE ||
      Math.abs(item.declinationDeg - expected.declinationDeg) > VECTOR_UNIT_TOLERANCE ||
      !vectorMatches(item.vector, expected.vector);
  })) return null;
  return data as NatalResponse;
}

function disposeMarker(marker: any) {
  marker.geometry?.dispose?.();
  marker.material?.dispose?.();
}

function syncAstronomicalData(runtime: SceneRuntime, data: NatalResponse | null, additional: boolean, disposables: any[]) {
  if (!data) return;
  data.namedStars.forEach((star, index) => {
    const entry = runtime.starMeshes[index];
    entry.name = star.name;
    entry.mesh.position.set(star.vector.x * 4.5, star.vector.y * 4.5, star.vector.z * 4.5);
    entry.mesh.material.color?.set?.(STAR_COLORS[star.name]);
  });

  const desired = data.bodies.filter((body) => body.status === 'available' && (body.category === 'primary' || additional));
  const desiredKeys = new Set(desired.map((body) => body.key));
  for (const [key, mesh] of runtime.markerMeshes) {
    if (!desiredKeys.has(key)) {
      runtime.natalMarkerGroup.remove(mesh);
      const ring = runtime.selectionRings.get(key);
      if (ring) { runtime.natalMarkerGroup.remove(ring); disposeMarker(ring); runtime.selectionRings.delete(key); }
      runtime.markerMeshes.delete(key);
      disposeMarker(mesh);
    }
  }
  for (const body of desired) {
    let mesh = runtime.markerMeshes.get(body.key);
    if (!mesh) {
      const geometry = new runtime.THREE.SphereGeometry(.14, 16, 16);
      const material = new runtime.THREE.MeshBasicMaterial({ color: '#DFB76C' });
      mesh = new runtime.THREE.Mesh(geometry, material);
      mesh.userData = { bodyKey: body.key, isFallback: true, baseScale: MARKER_SCALE };
      runtime.markerMeshes.set(body.key, mesh);
      runtime.natalMarkerGroup.add(mesh);

      const assetPath = MARKER_ASSETS[body.key];
      const cached = assetPath ? runtime.textureCache.get(assetPath) : undefined;
      const useTexture = (texture: any) => {
        if (!runtime.markerMeshes.has(body.key) || !texture) return;
        const sprite = new runtime.THREE.Sprite(new runtime.THREE.SpriteMaterial({ map: texture, transparent: true, opacity: .86, depthWrite: false }));
        sprite.scale.setScalar(MARKER_SCALE);
        sprite.position.copy(mesh.position);
        sprite.userData = { bodyKey: body.key, isFallback: false, baseScale: MARKER_SCALE };
        runtime.natalMarkerGroup.add(sprite);
        runtime.natalMarkerGroup.remove(mesh);
        runtime.markerMeshes.set(body.key, sprite);
        disposeMarker(mesh);
      };
      if (assetPath && cached && cached !== false) useTexture(cached);
      else if (assetPath && runtime.textureLoader && cached !== false) {
        runtime.textureCache.set(assetPath, null);
        runtime.textureLoader.load(assetPath, (texture: any) => {
          runtime.textureCache.set(assetPath, texture);
          useTexture(texture);
        }, undefined, () => runtime.textureCache.set(assetPath, false));
      }

      const ringTexture = runtime.textureCache.get(SELECTION_RING_ASSET);
      if (ringTexture) {
        const ring = new runtime.THREE.Sprite(new runtime.THREE.SpriteMaterial({ map: ringTexture, transparent: true, opacity: 0, depthWrite: false }));
        ring.scale.setScalar(MARKER_SCALE * 1.55);
        ring.userData = { bodyKey: body.key, selectionRing: true };
        runtime.selectionRings.set(body.key, ring);
        runtime.natalMarkerGroup.add(ring);
      }
    }
    mesh.position.set(body.vector!.x * 4.15, body.vector!.y * 4.15, body.vector!.z * 4.15);
    const ring = runtime.selectionRings.get(body.key);
    if (ring) ring.position.copy(mesh.position);
  }
}

function statusMessage(state: PersonalizationState) {
  if (state === 'loading') return 'Checking for your natal sky…';
  if (state === 'signed-out') return 'Sign in to place your natal sky among the stars.';
  if (state === 'no-chart') return 'Create your birth chart to reveal your natal sky.';
  if (state === 'unknown-time') return 'Add your exact birth time to place planets accurately.';
  if (state === 'unavailable') return 'Your natal sky is temporarily unavailable. The public map still works.';
  if (state === 'invalid') return 'Natal sky data could not be verified, so no personalized markers were shown.';
  return '';
}

export default function ConstellationsView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'webgl' | 'cdn'>('loading');
  const [personalization, setPersonalization] = useState<PersonalizationState>('loading');
  const [data, setData] = useState<NatalResponse | null>(null);
  const [additional, setAdditional] = useState(false);
  const [linesVisible, setLinesVisible] = useState(true);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [speed, setSpeed] = useState(20);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const closeDetailsRef = useRef<HTMLButtonElement>(null);
  const additionalToggleRef = useRef<HTMLButtonElement>(null);
  const selectionTriggerRef = useRef<HTMLElement | null>(null);
  const restoreSelectionFocusRef = useRef(false);
  const selectedKeyRef = useRef<string | null>(null);
  const hoveredKeyRef = useRef<string | null>(null);
  selectedKeyRef.current = selectedKey;
  hoveredKeyRef.current = hoveredKey;
  const sceneControls = useRef({ speed, linesVisible, labelsVisible });
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const sceneDisposablesRef = useRef<any[]>([]);
  const dataRef = useRef<NatalResponse | null>(data);
  const additionalRef = useRef(additional);
  dataRef.current = data;
  additionalRef.current = additional;
  sceneControls.current = { speed, linesVisible, labelsVisible };

  const selectBody = (key: string, trigger: HTMLElement | null) => {
    selectionTriggerRef.current = trigger;
    setSelectedKey(key);
  };
  const closeDetails = () => {
    restoreSelectionFocusRef.current = true;
    setSelectedKey(null);
  };

  useEffect(() => {
    if (selectedKey) {
      closeDetailsRef.current?.focus();
    } else if (restoreSelectionFocusRef.current) {
      restoreSelectionFocusRef.current = false;
      selectionTriggerRef.current?.focus();
    }
  }, [selectedKey]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/constellations/natal', { method: 'GET', credentials: 'same-origin', signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (result) => {
        if (result.status === 401) return setPersonalization('signed-out');
        if (result.status === 404) return setPersonalization('no-chart');
        if (result.status === 409) return setPersonalization('unknown-time');
        if (result.status === 503 || !result.ok) return setPersonalization('unavailable');
        const parsed = parsePayload(await result.json());
        if (!parsed) return setPersonalization('invalid');
        setData(parsed); setPersonalization('known');
      })
      .catch((error) => { if (error?.name !== 'AbortError') setPersonalization('unavailable'); });
    return () => controller.abort();
  }, []);

  const visibleBodies = data?.bodies.filter((body) => body.status === 'available' && (body.category === 'primary' || additional)) ?? [];
  const selected = data?.bodies.find((body) => body.key === selectedKey && (body.category === 'primary' || additional)) ?? null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let raf = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let renderer: any;
    let controls: any;
    const disposables: any[] = [];
    const listeners: Array<[string, EventListener]> = [];

    const boot = () => {
      if (cancelled) return;
      const THREE = (window as any).THREE;
      const OrbitControls = THREE?.OrbitControls;
      if (!THREE || !OrbitControls) { retryTimer = setTimeout(boot, 50); return; }
      if (timeoutTimer) clearTimeout(timeoutTimer);
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 500;
      try {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.z = 10;
        try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
        catch { setMapState('webgl'); return; }
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        container.appendChild(renderer.domElement);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.05; controls.enableZoom = true; controls.maxDistance = 20; controls.minDistance = 4;

        const decorativeBackgroundGroup = new THREE.Group(); decorativeBackgroundGroup.name = 'decorativeBackgroundGroup';
        const decorativeConstellationGroup = new THREE.Group(); decorativeConstellationGroup.name = 'decorativeConstellationGroup';
        const astronomicalGroup = new THREE.Group(); astronomicalGroup.name = 'astronomicalGroup';
        const verifiedStarGroup = new THREE.Group(); verifiedStarGroup.name = 'verifiedStarGroup';
        const natalMarkerGroup = new THREE.Group(); natalMarkerGroup.name = 'natalMarkerGroup';
        astronomicalGroup.add(verifiedStarGroup, natalMarkerGroup);
        scene.add(decorativeBackgroundGroup, decorativeConstellationGroup, astronomicalGroup);

        const bgPositions: number[] = [];
        for (let i = 0; i < 800; i++) bgPositions.push((Math.random() - .5) * 50, (Math.random() - .5) * 50, (Math.random() - .5) * 50);
        const bgGeo = new THREE.BufferGeometry(); bgGeo.setAttribute('position', new THREE.Float32BufferAttribute(bgPositions, 3));
        const bgMat = new THREE.PointsMaterial({ color: 0xffffff, size: .03, transparent: true, opacity: .4 });
        decorativeBackgroundGroup.add(new THREE.Points(bgGeo, bgMat)); disposables.push(bgGeo, bgMat);

        const nodePositions: number[] = [];
        for (let i = 0; i < 120; i++) { const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1); nodePositions.push(4.5 * Math.sin(phi) * Math.cos(theta), 4.5 * Math.sin(phi) * Math.sin(theta), 4.5 * Math.cos(phi)); }
        const nodeArray = new Float32Array(nodePositions);
        const nodeGeo = new THREE.BufferGeometry(); nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodeArray, 3));
        const nodeMat = new THREE.PointsMaterial({ color: 0xDFB76C, size: .12, transparent: true, opacity: .9 });
        const starNodes = new THREE.Points(nodeGeo, nodeMat); decorativeConstellationGroup.add(starNodes); disposables.push(nodeGeo, nodeMat);
        const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(nodeArray, 3));
        const indices: number[] = [];
        for (let i = 0; i < 120; i++) for (let j = i + 1; j < 120; j++) { const a = new THREE.Vector3(nodeArray[i*3], nodeArray[i*3+1], nodeArray[i*3+2]); const b = new THREE.Vector3(nodeArray[j*3], nodeArray[j*3+1], nodeArray[j*3+2]); if (a.distanceTo(b) < 1.6 && Math.random() > .4) indices.push(i, j); }
        lineGeo.setIndex(indices); const lineMat = new THREE.LineBasicMaterial({ color: 0x8A2BE2, transparent: true, opacity: .25 });
        const constellationLines = new THREE.LineSegments(lineGeo, lineMat); decorativeConstellationGroup.add(constellationLines); disposables.push(lineGeo, lineMat);

        const stars = FALLBACK_STARS;
        const starMeshes = stars.map((star) => {
          const geometry = new THREE.SphereGeometry(.08, 16, 16); const material = new THREE.MeshBasicMaterial({ color: STAR_COLORS[star.name] });
          const mesh = new THREE.Mesh(geometry, material); const scale = 4.5;
          mesh.position.set(star.vector.x * scale, star.vector.y * scale, star.vector.z * scale); verifiedStarGroup.add(mesh); disposables.push(geometry, material);
          return { name: star.name, mesh };
        });
        const markerMeshes = new Map<string, any>();
        const selectionRings = new Map<string, any>();
        const supportsSprites = !!(THREE.TextureLoader && THREE.Sprite && THREE.SpriteMaterial);
        const textureLoader = supportsSprites ? new THREE.TextureLoader() : null;
        const textureCache = new Map<string, any>();
        textureLoader?.load(SELECTION_RING_ASSET, (texture: any) => {
          textureCache.set(SELECTION_RING_ASSET, texture);
          markerMeshes.forEach((mesh: any, key: string) => {
            if (selectionRings.has(key)) return;
            const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false }));
            ring.scale.setScalar(MARKER_SCALE * 1.55); ring.userData = { bodyKey: key, selectionRing: true };
            ring.position.copy(mesh.position); selectionRings.set(key, ring); natalMarkerGroup.add(ring);
          });
        }, undefined, () => textureCache.set(SELECTION_RING_ASSET, false));
        const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
        const hit = (event: PointerEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / (rect.width || width)) * 2 - 1; pointer.y = -((event.clientY - rect.top) / (rect.height || height)) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          return raycaster.intersectObjects([...markerMeshes.values()], false)[0]?.object?.userData?.bodyKey ?? null;
        };
        const onMove = ((event: PointerEvent) => setHoveredKey(hit(event))) as EventListener;
        const onLeave = (() => setHoveredKey(null)) as EventListener;
        let pointerStart: { x: number; y: number; key: string | null; pointerId: number | undefined } | null = null;
        const onDown = ((event: PointerEvent) => {
          if (event.button !== 0 || event.isPrimary === false) { pointerStart = null; return; }
          pointerStart = { x: event.clientX, y: event.clientY, key: hit(event), pointerId: event.pointerId };
        }) as EventListener;
        const onUp = ((event: PointerEvent) => {
          const start = pointerStart; pointerStart = null;
          if (!start || event.button !== 0 || event.isPrimary === false || event.pointerId !== start.pointerId ||
              Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
          const key = hit(event);
          if (key && key === start.key) selectBody(key, renderer.domElement);
        }) as EventListener;
        const onCancel = (() => { pointerStart = null; }) as EventListener;
        renderer.domElement.addEventListener('pointermove', onMove); renderer.domElement.addEventListener('pointerleave', onLeave);
        renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp);
        renderer.domElement.addEventListener('pointercancel', onCancel);
        listeners.push(['pointermove', onMove], ['pointerleave', onLeave], ['pointerdown', onDown], ['pointerup', onUp], ['pointercancel', onCancel]);
        const runtime = {
          THREE, scene, camera, renderer, controls, verifiedStarGroup, natalMarkerGroup,
          astronomicalGroup, constellationLines, starMeshes, markerMeshes, selectionRings, textureLoader, textureCache,
        };
        runtimeRef.current = runtime;
        sceneDisposablesRef.current = disposables;
        syncAstronomicalData(runtime, dataRef.current, additionalRef.current, disposables);

        const temp = new THREE.Vector3(); let lastLabelUpdate = 0;
        const animate = (time = 0) => {
          if (cancelled) return;
          raf = requestAnimationFrame(animate);
          const increment = (sceneControls.current.speed / 100) * .01;
          decorativeConstellationGroup.rotation.y += increment; astronomicalGroup.rotation.y += increment;
          constellationLines.visible = sceneControls.current.linesVisible;
          markerMeshes.forEach((mesh: any) => {
            const key = mesh.userData.bodyKey;
            const selectedMarker = key === selectedKeyRef.current;
            const focusedMarker = key === hoveredKeyRef.current || selectedMarker;
            const target = selectedMarker ? 1.25 + Math.sin(time * .0012) * .025 : focusedMarker ? 1.12 : 1;
            mesh.scale.setScalar(MARKER_SCALE * target);
            if (mesh.material) mesh.material.opacity = selectedMarker || focusedMarker ? 1 : .86;
            const ring = selectionRings.get(key);
            if (ring) {
              ring.position.copy(mesh.position); ring.rotation.z += .0025;
              ring.material.opacity = selectedMarker ? .72 + Math.sin(time * .0012) * .08 : 0;
            }
          });
          controls.update(); renderer.render(scene, camera);
          if (time - lastLabelUpdate > 80 && sceneControls.current.labelsVisible) {
            lastLabelUpdate = time; const rect = container.getBoundingClientRect();
            setLabels(starMeshes.map((star) => { star.mesh.getWorldPosition(temp).project(camera); return { name: star.name, x: (temp.x*.5+.5)*rect.width, y: (-temp.y*.5+.5)*rect.height }; }));
          }
        };
        animate();
        resizeObserver = new ResizeObserver((entries) => { const rect = entries[0]?.contentRect; const w = rect?.width || container.clientWidth || width; const h = rect?.height || container.clientHeight || height; camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h); renderer.setPixelRatio(window.devicePixelRatio || 1); });
        resizeObserver.observe(container); setMapState('ready');
      } catch { setMapState('webgl'); }
    };
    timeoutTimer = setTimeout(() => { const three = (window as any).THREE; if ((!three || !three.OrbitControls) && !cancelled) { if (retryTimer) clearTimeout(retryTimer); setMapState('cdn'); } }, 5000);
    boot();
    return () => {
      cancelled = true; if (retryTimer) clearTimeout(retryTimer); if (timeoutTimer) clearTimeout(timeoutTimer); if (raf) cancelAnimationFrame(raf);
      resizeObserver?.disconnect(); controls?.dispose?.();
      if (renderer) { listeners.forEach(([name, fn]) => renderer.domElement.removeEventListener(name, fn)); if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement); renderer.dispose?.(); }
      const runtime = runtimeRef.current;
      runtimeRef.current = null; sceneDisposablesRef.current = [];
      disposables.forEach((item) => item.dispose?.());
      runtime?.markerMeshes.forEach((mesh: any) => disposeMarker(mesh));
      runtime?.selectionRings.forEach((ring: any) => disposeMarker(ring));
      runtime?.textureCache.forEach((texture: any) => texture?.dispose?.());
      setLabels([]);
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) syncAstronomicalData(runtime, data, additional, sceneDisposablesRef.current);
  }, [data, additional]);

  useEffect(() => {
    if (additional) return;
    if (selectedKey && ADDITIONAL_KEYS.includes(selectedKey as typeof ADDITIONAL_KEYS[number])) {
      selectionTriggerRef.current = additionalToggleRef.current;
      restoreSelectionFocusRef.current = true;
      setSelectedKey(null);
    }
    if (hoveredKey && ADDITIONAL_KEYS.includes(hoveredKey as typeof ADDITIONAL_KEYS[number])) setHoveredKey(null);
  }, [additional, hoveredKey, selectedKey]);

  return (
    <section className="py-20 lg:py-24 relative z-10 constellation-map">
      <div className="max-w-[1650px] mx-auto px-5 sm:px-6 xl:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-10 items-start">
          <div className="lg:col-span-3 space-y-5">
            <span className="text-xs uppercase tracking-[0.4em] text-gold block">Cosmic Navigator</span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">Interactive <br />Celestial Map</h2>
            <p className="text-gray-300 text-sm font-light leading-relaxed">Drag to orbit the celestial vault, scroll to zoom, and explore the named stars. Your verified natal sky shares their astronomical frame.</p>
            <div className="space-y-4 pt-2">
              <div className="glass-panel p-4 rounded-2xl"><label htmlFor="star-speed" className="block text-sm font-semibold text-white">Celestial Speed</label><input aria-label="Celestial speed" type="range" id="star-speed" min="0" max="100" value={speed} onChange={(event) => setSpeed(event.currentTarget.valueAsNumber)} className="w-32 accent-gold" /></div>
              <div className="glass-panel p-4 rounded-2xl"><span className="block text-sm font-semibold text-white">Constellation Lines</span><button aria-label={`${linesVisible ? 'Hide' : 'Show'} constellation lines`} aria-pressed={linesVisible} onClick={() => setLinesVisible((value) => !value)} className="text-xs bg-gold text-cosmic-950 px-3 py-1 rounded-md font-semibold mt-1 uppercase">{linesVisible ? 'Hide Lines' : 'Show Lines'}</button></div>
              <div className="glass-panel p-4 rounded-2xl"><span className="block text-sm font-semibold text-white">Named-star Labels</span><button aria-label={`${labelsVisible ? 'Hide' : 'Show'} named star labels`} aria-pressed={labelsVisible} onClick={() => setLabelsVisible((value) => !value)} className="text-xs bg-gold text-cosmic-950 px-3 py-1 rounded-md font-semibold mt-1 uppercase">{labelsVisible ? 'Hide Labels' : 'Show Labels'}</button></div>
            </div>
            {personalization !== 'known' && <div role="status" className="glass-panel p-4 rounded-2xl text-sm text-gray-200"><p>{statusMessage(personalization)}</p>{personalization === 'signed-out' && <a href="/login" className="text-gold">Sign in</a>}{personalization === 'no-chart' && <a href="/birth-chart" className="text-gold">Create chart</a>}{personalization === 'unknown-time' && <a href="/profile" className="text-gold">Update chart</a>}</div>}
            {personalization === 'known' && data && <>
              {(mapState === 'webgl' || mapState === 'cdn') && <p role="status" className="text-sm text-amber-200">Your verified natal data is available below, but personalized markers could not be rendered in the 3D view.</p>}
              <button ref={additionalToggleRef} onClick={() => setAdditional((value) => !value)} aria-expanded={additional} className="text-sm border border-gold/40 px-4 py-2 rounded-full text-gold">{additional ? 'Hide Additional bodies' : 'Show Additional bodies'}</button>
              {data.bodies.filter((body) => body.category === 'additional' && body.status === 'unavailable').map((body) => <p role="status" key={body.key} className="text-xs text-gray-400">{body.label} is unavailable for this chart.</p>)}
              <div role="region" aria-label="Natal body legend" className="grid grid-cols-2 gap-2">
                {visibleBodies.map((body) => { const highlighted = hoveredKey === body.key || selectedKey === body.key; return <button key={body.key} aria-label={`${body.label}, select for details`} aria-pressed={selectedKey === body.key} data-highlighted={highlighted ? 'true' : 'false'} onPointerEnter={() => setHoveredKey(body.key)} onPointerLeave={() => setHoveredKey(null)} onFocus={() => setHoveredKey(body.key)} onBlur={() => setHoveredKey(null)} onClick={(event) => selectBody(body.key, event.currentTarget)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectBody(body.key, event.currentTarget); } }} className={`text-left px-3 py-2 rounded-lg border ${highlighted ? 'border-gold bg-gold/20' : 'border-white/10'}`}><span aria-hidden="true">{body.glyph} </span>{body.label}</button>; })}
              </div>
            </>}
          </div>
          <div className="lg:col-span-9 h-[460px] sm:h-[500px] md:h-[620px] lg:h-[clamp(700px,72vh,820px)] relative rounded-[32px] lg:rounded-[40px] overflow-hidden glass-panel border border-gold/30 glow-border-purple">
            <div ref={containerRef} id="interactive-canvas-container" role="img" aria-label="Interactive celestial map" className="w-full h-full touch-none" />
            {mapState === 'loading' && <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 pointer-events-none">Loading celestial view…</div>}
            {(mapState === 'webgl' || mapState === 'cdn') && <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 space-y-3"><p className="text-sm text-gray-300">{mapState === 'webgl' ? 'The interactive 3D map needs WebGL. Your browser or device has it disabled.' : 'We could not load the 3D map from Three.js. Please try again.'}</p><p className="text-xs text-gray-400">The named stars of the celestial vault are listed below.</p><div className="flex flex-wrap gap-2 justify-center">{FALLBACK_STARS.map((star) => <span key={star.name} className="px-3 py-1 text-[11px] text-white/90">{star.name}</span>)}</div></div>}
            {labelsVisible && mapState === 'ready' && <div className="absolute inset-0 pointer-events-none overflow-hidden">{labels.map((label) => <span key={label.name} className="absolute -translate-x-1/2 -translate-y-1/2 text-[11px] text-white/90" style={{ left: label.x, top: label.y, textShadow: '0 0 6px #000' }}>{label.name}</span>)}</div>}
            {mapState === 'ready' && <div className="absolute bottom-6 left-6 pointer-events-none glass-panel px-4 py-2.5 rounded-full text-xs text-gray-300">Left Click + Drag to rotate celestial sphere</div>}
            {selected && <div role="dialog" aria-label={`${selected.label} details`} onKeyDown={(event) => { if (event.key === 'Escape') closeDetails(); }} className="absolute right-4 top-4 w-[calc(100%-2rem)] max-w-72 glass-panel bg-cosmic-950/95 border border-gold/40 rounded-2xl p-4 text-sm text-white"><button ref={closeDetailsRef} aria-label="Close details" onClick={closeDetails} className="absolute right-3 top-2 text-xl">×</button><h3 className="text-lg font-semibold text-gold"><span aria-hidden="true">{selected.glyph} </span>{selected.label}</h3><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><dt>Right ascension</dt><dd>{selected.rightAscensionDeg!.toFixed(2)}°</dd><dt>Declination</dt><dd>{selected.declinationDeg! < 0 ? '−' : ''}{Math.abs(selected.declinationDeg!).toFixed(2)}°</dd><dt>Zodiac</dt><dd>{selected.signLabel} {selected.degreeInSign!.toFixed(2)}°</dd><dt>House</dt><dd>{selected.house == null ? 'Unavailable' : `House ${selected.house}`}</dd><dt>Motion</dt><dd>{selected.retrograde ? 'Retrograde' : 'Direct'}</dd></dl></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
