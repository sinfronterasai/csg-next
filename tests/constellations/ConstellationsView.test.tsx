/** @jest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConstellationsView from '@/app/constellations/ConstellationsView';
import { NAVIGATOR_FRAME_BASE, raDecToSceneVector } from '@/lib/constellations/coordinates';
import { getNamedStarsAtEpoch } from '@/lib/constellations/starCatalog';

const PRIMARY = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const ADDITIONAL = ['Chiron', 'Juno', 'True North Node'];

const BODY_KEYS: Record<string, string> = { 'True North Node': 'northnode' };
const body = (label: string, category: 'primary' | 'additional' = 'primary', status: 'available' | 'unavailable' = 'available') => ({
  key: BODY_KEYS[label] ?? label.toLowerCase().replace(/ /g, '-'), label, glyph: label === 'Sun' ? '☉' : '•', category, status,
  ...(status === 'available' ? {
    rightAscensionDeg: 15, declinationDeg: -12, vector: raDecToSceneVector(15, -12),
    longitude: 31.25, sign: 'taurus', signLabel: 'Taurus', degreeInSign: 1.25,
    house: 2, retrograde: label === 'Mercury',
  } : { reason: 'ephemeris-unavailable' }),
  source: 'swiss-ephemeris',
});

const namedStars = getNamedStarsAtEpoch(2451545, '2000-01-01T12:00:00.000Z');
const payload = {
  schemaVersion: 'csg-natal-navigator-v1',
  frame: { ...NAVIGATOR_FRAME_BASE, epoch: '2000-01-01T12:00:00.000Z' },
  birthAnchor: { utc: '2000-01-01T12:00:00.000Z', timezone: 'UTC', source: 'saved-natal-chart' },
  bodies: [...PRIMARY.map((name) => body(name)), ...ADDITIONAL.map((name) => body(name, 'additional'))],
  namedStars,
  source: { engine: 'swiss-ephemeris', package: '@fusionstrings/swiss-eph', flags: NAVIGATOR_FRAME_BASE.swissFlags, calculationTime: 'UTC-derived Julian day supplied as tjd_ut' },
  availability: { primary: 'available', optionalUnavailable: [] as string[] },
};

const response = (status: number, value: unknown = {}) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => value } as Response);
const clonePayload = (): any => JSON.parse(JSON.stringify(payload));

class Obj {
  children: any[] = []; rotation = { x: 0, y: 0, z: 0 }; visible = true; userData: any = {};
  position = { x: 0, y: 0, z: 0, set: (x: number, y: number, z: number) => Object.assign(this.position, { x, y, z }) };
  scale = { x: 1, y: 1, z: 1, setScalar: (n: number) => Object.assign(this.scale, { x: n, y: n, z: n }) };
  add(...items: any[]) { this.children.push(...items); }
  remove(...items: any[]) { this.children = this.children.filter((item) => !items.includes(item)); }
  traverse(fn: (item: any) => void) { fn(this); this.children.forEach((item) => item.traverse ? item.traverse(fn) : fn(item)); }
  getWorldPosition(target: any) { return target.set(this.position.x, this.position.y, this.position.z); }
}

function installThree() {
  const scenes: any[] = [];
  const renderers: any[] = [];
  const controls: any[] = [];
  const cameras: any[] = [];
  let raycastHits = true;
  class Scene extends Obj { constructor() { super(); scenes.push(this); } }
  class Group extends Obj { name = ''; }
  class Mesh extends Obj { constructor(public geometry: any, public material: any) { super(); } }
  class Material { color = { set: jest.fn() }; opacity = 1; dispose = jest.fn(); constructor(values: any = {}) { Object.assign(this, values); } }
  class Geometry { setAttribute = jest.fn(); setIndex = jest.fn(); dispose = jest.fn(); }
  class Vector3 { constructor(public x = 0, public y = 0, public z = 0) {} distanceTo = () => 2; set(x: number, y: number, z: number) { Object.assign(this, { x, y, z }); return this; } project() { return this; } }

  class Renderer { domElement = document.createElement('canvas'); setSize = jest.fn(); setPixelRatio = jest.fn(); render = jest.fn(); dispose = jest.fn(); constructor() { renderers.push(this); } }
  class Camera { position = { z: 0 }; aspect = 1; updateProjectionMatrix = jest.fn(); constructor(..._args: any[]) { cameras.push(this); } }
  class Controls { enableDamping = false; dampingFactor = 0; enableZoom = false; maxDistance = 0; minDistance = 0; update = jest.fn(); dispose = jest.fn(); constructor(..._args: any[]) { controls.push(this); } }
  class Raycaster { setFromCamera = jest.fn(); intersectObjects = jest.fn((objects: any[]) => raycastHits && objects.length ? [{ object: objects[0] }] : []); }
  (window as any).THREE = {
    Scene, Group, Mesh, Points: Mesh, LineSegments: Mesh, BufferGeometry: Geometry, SphereGeometry: Geometry,
    BufferAttribute: class {}, Float32BufferAttribute: class {}, PointsMaterial: Material, LineBasicMaterial: Material,
    MeshBasicMaterial: Material, Vector3, Vector2: class { constructor(public x = 0, public y = 0) {} }, PerspectiveCamera: Camera,
    WebGLRenderer: Renderer, Raycaster, OrbitControls: Controls,
  };
  return { scenes, renderers, controls, cameras, setRaycastHits: (value: boolean) => { raycastHits = value; } };
}

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 500 });
  (global as any).ResizeObserver = class { observe() {} disconnect() {} };
  global.requestAnimationFrame = jest.fn(() => 1);
  global.cancelAnimationFrame = jest.fn();
  installThree();
});

afterEach(() => {
  cleanup(); jest.useRealTimers(); jest.restoreAllMocks(); delete (window as any).THREE;
});

async function renderWith(status: number, value?: unknown) {
  global.fetch = jest.fn(() => response(status, value)) as unknown as typeof fetch;
  render(<ConstellationsView />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('Cosmic Navigator personalization states', () => {
  it.each([
    [401, /sign in to place your natal sky/i],
    [404, /create your birth chart/i],
    [409, /add your exact birth time/i],
    [503, /natal sky is temporarily unavailable/i],
  ])('keeps the public map visible for HTTP %s', async (status, message) => {
    await renderWith(status);
    expect(screen.getByLabelText(/interactive celestial map/i)).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByRole('slider', { name: /celestial speed/i })).toBeTruthy();
  });

  it('shows loading without blocking the public controls', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<ConstellationsView />);
    expect(screen.getByText(/checking for your natal sky/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /hide constellation lines/i })).toBeTruthy();
  });

  it('requests only the same-origin natal endpoint without credentials in the payload', async () => {
    await renderWith(401);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/constellations/natal', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
    expect((global.fetch as jest.Mock).mock.calls[0][1]).not.toHaveProperty('body');
  });
});

describe('known natal sky', () => {
  it('renders exactly ten primary legend buttons by default and toggles only additional bodies', async () => {
    await renderWith(200, payload);
    const legend = await screen.findByRole('region', { name: /natal body legend/i });
    expect(legend.querySelectorAll('button')).toHaveLength(10);
    PRIMARY.forEach((name) => expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /show additional bodies/i }));
    expect(legend.querySelectorAll('button')).toHaveLength(13);
    ADDITIONAL.forEach((name) => expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /hide additional bodies/i }));
    expect(legend.querySelectorAll('button')).toHaveLength(10);
  });

  it('shows optional unavailability without suppressing primaries', async () => {
    const partial = {
      ...payload,
      bodies: payload.bodies.map((item) => item.label === 'Juno' ? body('Juno', 'additional', 'unavailable') : item),
      availability: { primary: 'available', optionalUnavailable: ['juno'] },
    };
    await renderWith(200, partial);
    expect(await screen.findByRole('button', { name: /^Sun/ })).toBeTruthy();
    expect(screen.getByText(/Juno is unavailable/i)).toBeTruthy();
  });

  it('opens complete details, changes selection, highlights focus, and closes', async () => {
    await renderWith(200, payload);
    const sun = await screen.findByRole('button', { name: /^Sun/ });
    fireEvent.focus(sun);
    expect(sun.getAttribute('data-highlighted')).toBe('true');
    fireEvent.click(sun);
    const panel = screen.getByRole('dialog', { name: /Sun details/i });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close details/i }));
    expect(panel.textContent).toMatch(/☉/);
    expect(panel.textContent).toMatch(/Right ascension.*15\.00°/s);
    expect(panel.textContent).toMatch(/Declination.*−12\.00°/s);
    expect(panel.textContent).toMatch(/Taurus 1\.25°/);
    expect(panel.textContent).toMatch(/House 2/);
    expect(panel.textContent).toMatch(/Direct/);
    const mercury = screen.getByRole('button', { name: /^Mercury/ });
    fireEvent.click(mercury);
    expect(screen.getByRole('dialog', { name: /Mercury details/i }).textContent).toMatch(/Retrograde/);
    fireEvent.keyDown(screen.getByRole('button', { name: /close details/i }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(mercury);
  });

  it('supports keyboard activation and canvas pointer selection', async () => {
    const three = installThree();
    await renderWith(200, payload);
    const moon = await screen.findByRole('button', { name: /^Moon/ });
    fireEvent.keyDown(moon, { key: 'Enter' });
    expect(screen.getByRole('dialog', { name: /Moon details/i })).toBeTruthy();
    const canvas = screen.getByLabelText(/interactive celestial map/i).querySelector('canvas')!;
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 10 });
    expect(screen.getByRole('button', { name: /^Sun/ }).getAttribute('data-highlighted')).toBe('true');
    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    expect(screen.getByRole('dialog', { name: /Sun details/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /close details/i }));
    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, clientX: 40, clientY: 40 }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, button: 2, clientX: 10, clientY: 10 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, button: 2, clientX: 10, clientY: 10 }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    fireEvent(canvas, new MouseEvent('pointercancel', { bubbles: true }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    expect(screen.queryByRole('dialog')).toBeNull();
    three.setRaycastHits(false);
    fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    fireEvent(canvas, new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['coordinate', { rightAscensionDeg: Number.NaN }],
    ['display placement', { longitude: Number.NaN }],
  ])('rejects malformed %s fields instead of rendering markers', async (_name, invalidFields) => {
    const malformed = { ...payload, bodies: payload.bodies.map((item) => item.label === 'Sun' ? { ...item, ...invalidFields } : item) };
    await renderWith(200, malformed);
    expect(screen.getByText(/natal sky data could not be verified/i)).toBeTruthy();
    expect(screen.queryByRole('region', { name: /natal body legend/i })).toBeNull();
  });

  it('rejects a named star whose frame or epoch differs from the natal frame', async () => {
    const malformed = {
      ...payload,
      namedStars: payload.namedStars.map((star, index) => index === 0
        ? { ...star, frame: { ...star.frame, epoch: '2001-01-01T00:00:00.000Z' } }
        : star),
    };
    await renderWith(200, malformed);
    expect(screen.getByText(/natal sky data could not be verified/i)).toBeTruthy();
    expect(screen.queryByRole('region', { name: /natal body legend/i })).toBeNull();
  });

  it.each([
    ['body vector inconsistent with RA/Dec', (value: any) => { value.bodies[0].vector = raDecToSceneVector(16, -12); }],
    ['star vector inconsistent with RA/Dec', (value: any) => { value.namedStars[0].vector = raDecToSceneVector(value.namedStars[0].rightAscensionDeg + 1, value.namedStars[0].declinationDeg); }],
    ['reordered bodies', (value: any) => { [value.bodies[0], value.bodies[1]] = [value.bodies[1], value.bodies[0]]; }],
    ['duplicate body key', (value: any) => { value.bodies[1].key = 'sun'; }],
    ['extra body', (value: any) => { value.bodies.push({ ...value.bodies[0], key: 'earth' }); }],
    ['reordered named stars', (value: any) => { [value.namedStars[0], value.namedStars[1]] = [value.namedStars[1], value.namedStars[0]]; }],
    ['duplicate named-star key', (value: any) => { value.namedStars[1].key = value.namedStars[0].key; }],
    ['extra named star', (value: any) => { value.namedStars.push({ ...value.namedStars[0], key: 'extra', name: 'Extra' }); }],
    ['false named-star identity', (value: any) => { value.namedStars[0].catalogId = 'HIP 999'; }],
    ['false named-star source', (value: any) => { value.namedStars[0].source = 'catalog'; }],
    ['false root source', (value: any) => { value.source.engine = 'browser-math'; }],
    ['availability omits unavailable optional', (value: any) => { value.bodies[10] = body('Chiron', 'additional', 'unavailable'); }],
    ['availability names an available optional', (value: any) => { value.availability.optionalUnavailable = ['chiron']; }],
    ['unavailable optional retains placement data', (value: any) => {
      value.bodies[10].status = 'unavailable'; value.availability.optionalUnavailable = ['chiron'];
    }],
  ])('fails closed for %s', async (_name, mutate) => {
    const malformed = clonePayload();
    mutate(malformed);
    await renderWith(200, malformed);
    expect(screen.getByText(/natal sky data could not be verified/i)).toBeTruthy();
    expect(screen.queryByRole('region', { name: /natal body legend/i })).toBeNull();
  });

  it('clears optional selection and hover when additional bodies are hidden', async () => {
    await renderWith(200, payload);
    fireEvent.click(await screen.findByRole('button', { name: /show additional bodies/i }));
    const chiron = screen.getByRole('button', { name: /^Chiron/ });
    fireEvent.pointerEnter(chiron);
    fireEvent.click(chiron);
    expect(screen.getByRole('dialog', { name: /Chiron details/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /hide additional bodies/i }));
    expect(screen.queryByRole('dialog', { name: /Chiron details/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show additional bodies/i }));
    expect(screen.getByRole('button', { name: /^Chiron/ }).getAttribute('data-highlighted')).toBe('false');
  });
});

describe('public Three.js behavior', () => {
  it('creates isolated named scene groups and synchronized astronomical children', async () => {
    const { scenes } = installThree();
    await renderWith(200, payload);
    await waitFor(() => expect(scenes.length).toBeGreaterThanOrEqual(1));
    const activeScene = scenes[scenes.length - 1];
    const names = activeScene.children.map((child: any) => child.name);
    expect(names).toEqual(expect.arrayContaining(['decorativeBackgroundGroup', 'decorativeConstellationGroup', 'astronomicalGroup']));
    const astro = activeScene.children.find((child: any) => child.name === 'astronomicalGroup');
    expect(astro.children.map((child: any) => child.name)).toEqual(expect.arrayContaining(['verifiedStarGroup', 'natalMarkerGroup']));
  });

  it('keeps renderer, controls, scene, decorative groups, and primary meshes across data resolution and optional toggles', async () => {
    const three = installThree();
    let resolveFetch!: (value: Response) => void;
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as unknown as typeof fetch;
    render(<ConstellationsView />);

    expect(three.scenes).toHaveLength(1);
    expect(three.renderers).toHaveLength(1);
    expect(three.controls).toHaveLength(1);
    expect(three.cameras).toHaveLength(1);
    const scene = three.scenes[0];
    const renderer = three.renderers[0];
    const orbitControls = three.controls[0];
    const camera = three.cameras[0];
    const background = scene.children.find((child: any) => child.name === 'decorativeBackgroundGroup');
    const constellations = scene.children.find((child: any) => child.name === 'decorativeConstellationGroup');
    const astro = scene.children.find((child: any) => child.name === 'astronomicalGroup');

    await act(async () => { resolveFetch(await response(200, payload)); await Promise.resolve(); await Promise.resolve(); });
    await screen.findByRole('region', { name: /natal body legend/i });
    const markerGroup = astro.children.find((child: any) => child.name === 'natalMarkerGroup');
    const primaryMeshes = markerGroup.children.slice();
    expect(primaryMeshes).toHaveLength(10);

    fireEvent.click(screen.getByRole('button', { name: /show additional bodies/i }));
    expect(markerGroup.children).toHaveLength(13);
    expect(markerGroup.children.slice(0, 10)).toEqual(primaryMeshes);
    fireEvent.click(screen.getByRole('button', { name: /hide additional bodies/i }));

    expect(three.scenes).toEqual([scene]);
    expect(three.renderers).toEqual([renderer]);
    expect(three.controls).toEqual([orbitControls]);
    expect(three.cameras).toEqual([camera]);
    expect(scene.children).toContain(background);
    expect(scene.children).toContain(constellations);
    expect(scene.children).toContain(astro);
    expect(markerGroup.children).toEqual(primaryMeshes);
    expect(renderer.dispose).not.toHaveBeenCalled();
    expect(orbitControls.dispose).not.toHaveBeenCalled();
  });

  it('applies resolved natal data when Three.js finishes booting later', async () => {
    const three = installThree();
    const Controls = (window as any).THREE.OrbitControls;
    delete (window as any).THREE.OrbitControls;
    await renderWith(200, payload);
    expect(await screen.findByRole('region', { name: /natal body legend/i })).toBeTruthy();
    expect(three.scenes).toHaveLength(0);

    (window as any).THREE.OrbitControls = Controls;
    act(() => { jest.advanceTimersByTime(50); });
    const astro = three.scenes[0].children.find((child: any) => child.name === 'astronomicalGroup');
    const markerGroup = astro.children.find((child: any) => child.name === 'natalMarkerGroup');
    expect(markerGroup.children).toHaveLength(10);
  });

  it('preserves the named-star catalog colors after personalized data resolves', async () => {
    const { scenes } = installThree();
    await renderWith(200, payload);
    const astro = scenes[0].children.find((child: any) => child.name === 'astronomicalGroup');
    const starGroup = astro.children.find((child: any) => child.name === 'verifiedStarGroup');
    expect(starGroup.children[0].material.color).toBe('#a3d1ff');
    expect(starGroup.children[1].material.color).toBe('#ffaa77');
  });

  it('uses committed catalog vectors rather than arbitrary fallback coordinates for public stars', async () => {
    const { scenes } = installThree();
    await renderWith(401);
    const activeScene = scenes[scenes.length - 1];
    const astro = activeScene.children.find((child: any) => child.name === 'astronomicalGroup');
    const starGroup = astro.children.find((child: any) => child.name === 'verifiedStarGroup');
    const sirius = getNamedStarsAtEpoch(2451545, '2000-01-01T12:00:00.000Z')[0].vector;
    expect(starGroup.children[0].position).toMatchObject({ x: sirius.x * 4.5, y: sirius.y * 4.5, z: sirius.z * 4.5 });
  });

  it('preserves speed, line-label controls, and their accessible state', async () => {
    await renderWith(401);
    const lines = screen.getByRole('button', { name: /hide constellation lines/i });
    fireEvent.click(lines);
    expect(screen.getByRole('button', { name: /show constellation lines/i })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /celestial speed/i }).getAttribute('min')).toBe('0');
    const labels = screen.getByRole('button', { name: /hide named star labels/i });
    fireEvent.click(labels);
    expect(screen.getByRole('button', { name: /show named star labels/i })).toBeTruthy();
  });

  it('shows a useful fallback when WebGL construction fails', async () => {
    (window as any).THREE.WebGLRenderer = class { constructor() { throw new Error('WebGL'); } };
    await renderWith(401);
    expect(screen.getByText(/interactive 3D map needs WebGL/i)).toBeTruthy();
    expect(screen.getByText('Sirius')).toBeTruthy();
  });

  it('keeps known natal data useful without claiming markers rendered after WebGL failure', async () => {
    (window as any).THREE.WebGLRenderer = class { constructor() { throw new Error('WebGL'); } };
    await renderWith(200, payload);
    expect(screen.getByText(/personalized markers could not be rendered/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Sun/ })).toBeTruthy();
    expect(screen.queryByText(/Left Click \+ Drag/)).toBeNull();
  });

  it('cancels rendering and aborts personalization on unmount', async () => {
    const { renderers } = installThree();
    let requestSignal: AbortSignal | undefined;
    global.fetch = jest.fn((_url, init) => { requestSignal = init?.signal as AbortSignal; return new Promise(() => {}); }) as unknown as typeof fetch;
    const view = render(<ConstellationsView />);
    await act(async () => { await Promise.resolve(); });
    expect(renderers).toHaveLength(1);
    view.unmount();
    expect(requestSignal?.aborted).toBe(true);
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
    expect(renderers[0].dispose).toHaveBeenCalled();
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('fails explicitly if the Three.js CDN never becomes available', async () => {
    delete (window as any).THREE.OrbitControls;
    global.fetch = jest.fn(() => response(401)) as unknown as typeof fetch;
    render(<ConstellationsView />);
    await act(async () => { jest.advanceTimersByTime(5001); });
    expect(screen.getByText(/could not load the 3D map/i)).toBeTruthy();
  });

  it('retains a data-only known natal state when the Three.js CDN fails', async () => {
    delete (window as any).THREE.OrbitControls;
    global.fetch = jest.fn(() => response(200, payload)) as unknown as typeof fetch;
    render(<ConstellationsView />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); jest.advanceTimersByTime(5001); });
    expect(screen.getByText(/personalized markers could not be rendered/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Sun/ })).toBeTruthy();
    expect(screen.queryByText(/Left Click \+ Drag/)).toBeNull();
  });
});
