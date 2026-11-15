import type * as THREE_NS from 'three';
import type { RGB } from './palette';
import type { Theme } from './themes';

type T3 = typeof THREE_NS;
export type SceneUpdate = (t: number, dt: number) => void;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Builds the 3D backdrop that matches the chosen theme and returns its per-frame update. */
export function buildScene(T: T3, scene: THREE_NS.Scene, th: Theme): SceneUpdate {
    const col = (c: RGB, k = 1) => new T.Color((c[0] / 255) * k, (c[1] / 255) * k, (c[2] / 255) * k);
    const mixc = (a: RGB, b: RGB, f: number) => col([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
    const dark = th.page[0] + th.page[1] + th.page[2] < 300;
    const white: RGB = [255, 255, 255];

    scene.add(new T.AmbientLight(0xffffff, dark ? 1.1 : 1.6));
    const sun = new T.DirectionalLight(0xffffff, dark ? 1.6 : 1.4);
    sun.position.set(-6, 10, 8);
    scene.add(sun);

    const solid = (c: THREE_NS.Color, opacity = 1) => new T.MeshLambertMaterial({ color: c, flatShading: true, transparent: opacity < 1, opacity });
    // Translucent layers never write depth, and stacked layers are ordered explicitly, so coplanar discs cannot z-fight.
    const basic = (c: THREE_NS.Color, opacity = 1, side: THREE_NS.Side = T.FrontSide) => new T.MeshBasicMaterial({ color: c, transparent: opacity < 1, opacity, side, depthWrite: opacity >= 1 });

    /** Particle cloud helper. */
    const points = (n: number, place: (i: number) => [number, number, number], color: THREE_NS.Color | THREE_NS.Color[], size: number, opacity = 0.9) => {
        const pos = new Float32Array(n * 3), cols = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const p = place(i);
            pos.set(p, i * 3);
            const c = Array.isArray(color) ? pick(color) : color;
            cols.set([c.r, c.g, c.b], i * 3);
        }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3));
        g.setAttribute('color', new T.BufferAttribute(cols, 3));
        const pts = new T.Points(g, new T.PointsMaterial({ size, vertexColors: true, transparent: true, opacity, sizeAttenuation: true, depthWrite: false }));
        scene.add(pts);
        return pts;
    };

    /** Moves points downwards/sideways, wrapping around, for snow, petals, dust... */
    const drift = (pts: THREE_NS.Points, vx: number, vy: number, sway: number, bounds: { x: number; y: number }): SceneUpdate => (t, dt) => {
        const a = pts.geometry.attributes.position as THREE_NS.BufferAttribute;
        for (let i = 0; i < a.count; i++) {
            let x = a.getX(i) + (vx + Math.sin(t * 0.8 + i) * sway) * dt, y = a.getY(i) + vy * dt;
            if (y < -bounds.y) y = bounds.y;
            if (y > bounds.y) y = -bounds.y;
            if (x > bounds.x) x = -bounds.x;
            if (x < -bounds.x) x = bounds.x;
            a.setXYZ(i, x, y, a.getZ(i));
        }
        a.needsUpdate = true;
    };

    const wavePlane = (w: number, d: number, segX: number, segY: number, material: THREE_NS.Material, y: number, z: number, amp: number, speed: number, tilt = -Math.PI / 2.15): SceneUpdate => {
        const g = new T.PlaneGeometry(w, d, segX, segY);
        const m = new T.Mesh(g, material);
        m.rotation.x = tilt; m.position.set(0, y, z);
        scene.add(m);
        const pos = g.attributes.position as THREE_NS.BufferAttribute;
        return (t) => {
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i), yy = pos.getY(i);
                pos.setZ(i, Math.sin(x * 0.22 + t * speed) * amp + Math.cos(yy * 0.3 + t * speed * 0.8) * amp * 0.7);
            }
            pos.needsUpdate = true;
        };
    };

    const treeCone = (c: THREE_NS.Color, h: number, r: number, layers = 3) => {
        const g = new T.Group();
        const trunk = new T.Mesh(new T.CylinderGeometry(r * 0.12, r * 0.15, h * 0.25, 6), solid(col([110, 72, 48])));
        trunk.position.y = h * 0.12; g.add(trunk);
        for (let i = 0; i < layers; i++) {
            const k = 1 - i / (layers + 0.5);
            const cone = new T.Mesh(new T.ConeGeometry(r * k, h * 0.5, 7), solid(c));
            cone.position.y = h * 0.28 + i * h * 0.22;
            g.add(cone);
        }
        return g;
    };

    const digitTexture = (n: number, color: string) => {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const x = c.getContext('2d')!;
        x.fillStyle = color; x.font = 'bold 96px Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(n), 64, 70);
        const tex = new T.CanvasTexture(c);
        return tex;
    };
    const css = (c: RGB) => `rgb(${c.join(',')})`;
    const updaters: SceneUpdate[] = [];

    switch (th.motif) {
        // ------------------------------------------------------------------ space
        case 'cosmos': {
            const stars = points(1400, () => [rnd(-60, 60), rnd(-40, 40), rnd(-90, 10)], [col(th.primary), col(th.accent), col(th.filled), col(white)], 0.16);
            const planet = new T.Group();
            planet.add(new T.Mesh(new T.SphereGeometry(3, 28, 20), solid(col(th.accent))));
            const ring = new T.Mesh(new T.RingGeometry(4.3, 6.2, 56), basic(col(th.primary), 0.6, T.DoubleSide));
            ring.rotation.x = Math.PI / 2.3; planet.add(ring);
            planet.position.set(-13, 5, -14); scene.add(planet);
            const p2 = new T.Mesh(new T.SphereGeometry(1.7, 24, 16), solid(col(th.primary))); p2.position.set(14, -4, -9); scene.add(p2);
            const moon = new T.Mesh(new T.SphereGeometry(0.5, 16, 12), solid(col(white))); scene.add(moon);
            const orbit = new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({ length: 90 }, (_, i) => new T.Vector3(Math.cos((i / 90) * Math.PI * 2) * 22, 0, Math.sin((i / 90) * Math.PI * 2) * 22))), new T.LineBasicMaterial({ color: col(th.primary), transparent: true, opacity: 0.25 }));
            orbit.rotation.x = 0.35; orbit.position.z = -22; scene.add(orbit);
            updaters.push((t) => {
                stars.rotation.y = t * 0.012; planet.rotation.y = t * 0.1; planet.position.y = 5 + Math.sin(t * 0.4) * 0.5;
                p2.position.y = -4 + Math.cos(t * 0.5) * 0.5;
                moon.position.set(p2.position.x + Math.cos(t) * 3, p2.position.y + Math.sin(t) * 1, p2.position.z + Math.sin(t) * 3);
            });
            break;
        }
        // ------------------------------------------------------------------ forest
        case 'forest': {
            const greens = [mixc(th.primary, white, 0.0), mixc(th.primary, th.filled, 0.5), mixc(th.primary, white, 0.25)];
            for (let i = 0; i < 46; i++) {
                const side = i % 2 ? 1 : -1;
                const tree = treeCone(pick(greens), rnd(4, 9), rnd(1.2, 2.2));
                tree.position.set(side * rnd(7, 34), -11 + rnd(-1, 1), rnd(-45, -4));
                scene.add(tree);
            }
            const hills = new T.Mesh(new T.PlaneGeometry(200, 80), basic(mixc(th.page, th.primary, 0.22)));
            hills.rotation.x = -Math.PI / 2; hills.position.set(0, -12, -20); scene.add(hills);
            const flies = points(60, () => [rnd(-22, 22), rnd(-9, 7), rnd(-30, 4)], col([250, 204, 21]), 0.35, 0.95);
            const leaves = new T.InstancedMesh(new T.PlaneGeometry(0.6, 0.35), basic(mixc(th.accent, th.primary, 0.3), 0.9, T.DoubleSide), 50);
            const ld = Array.from({ length: 50 }, () => ({ x: rnd(-22, 22), y: rnd(-10, 10), z: rnd(-20, 3), s: rnd(0.4, 1.2), p: rnd(0, 6) }));
            scene.add(leaves);
            const dummy = new T.Object3D();
            updaters.push((t, dt) => {
                const fp = flies.geometry.attributes.position as THREE_NS.BufferAttribute;
                for (let i = 0; i < fp.count; i++) fp.setXYZ(i, fp.getX(i) + Math.sin(t * 0.7 + i) * 0.01, fp.getY(i) + Math.cos(t * 0.9 + i * 2) * 0.01, fp.getZ(i));
                fp.needsUpdate = true;
                (flies.material as THREE_NS.PointsMaterial).opacity = 0.6 + Math.sin(t * 2) * 0.35;
                ld.forEach((l, i) => {
                    l.y -= l.s * dt; l.x += Math.sin(t + l.p) * 0.4 * dt;
                    if (l.y < -11) l.y = 11;
                    dummy.position.set(l.x, l.y, l.z); dummy.rotation.set(t * l.s + l.p, t * 0.6, t * 0.8 + l.p); dummy.updateMatrix();
                    leaves.setMatrixAt(i, dummy.matrix);
                });
                leaves.instanceMatrix.needsUpdate = true;
            });
            break;
        }
        // ------------------------------------------------------------------ ocean
        case 'ocean': {
            updaters.push(wavePlane(140, 90, 70, 45, new T.MeshLambertMaterial({ color: col(th.primary), flatShading: true, transparent: true, opacity: 0.85 }), -9, -18, 0.9, 0.9));
            updaters.push(wavePlane(140, 90, 70, 45, new T.MeshBasicMaterial({ color: col(th.accent), wireframe: true, transparent: true, opacity: 0.12 }), -8.2, -18, 0.9, 0.9));
            const bubbles = points(120, () => [rnd(-24, 24), rnd(-12, 12), rnd(-25, 4)], col(white), 0.3, 0.7);
            updaters.push(drift(bubbles, 0, 1.1, 0.25, { x: 26, y: 12 }));
            const fish: Array<{ m: THREE_NS.Group; s: number; y: number; p: number }> = [];
            for (let i = 0; i < 9; i++) {
                const g = new T.Group();
                const body = new T.Mesh(new T.ConeGeometry(0.55, 1.6, 8), solid(i % 2 ? col(th.accent) : mixc(th.accent, white, 0.4)));
                body.rotation.z = Math.PI / 2; g.add(body);
                const tail = new T.Mesh(new T.ConeGeometry(0.5, 0.7, 6), solid(col(th.accent)));
                tail.rotation.z = -Math.PI / 2; tail.position.x = -1.1; g.add(tail);
                const y = rnd(-6, 7);
                g.position.set(rnd(-24, 24), y, rnd(-22, -3)); g.scale.setScalar(rnd(0.7, 1.5)); scene.add(g);
                fish.push({ m: g, s: rnd(0.8, 2.2) * (i % 2 ? 1 : -1), y, p: rnd(0, 6) });
            }
            updaters.push((t, dt) => fish.forEach((f) => {
                f.m.position.x += f.s * dt; f.m.position.y = f.y + Math.sin(t + f.p) * 0.5; f.m.rotation.y = f.s > 0 ? Math.PI : 0;
                if (f.m.position.x > 26) f.m.position.x = -26; if (f.m.position.x < -26) f.m.position.x = 26;
            }));
            break;
        }
        // ------------------------------------------------------------------ sunset
        case 'sunset': {
            const sunG = new T.Group();
            for (let i = 0; i < 5; i++) { const h = new T.Mesh(new T.CircleGeometry(9 + i * 2.2, 48), basic(mixc(th.accent, th.page, 0.5 + i * 0.1), 0.35 - i * 0.05)); h.position.z = -0.4 - i * 0.4; h.renderOrder = i; sunG.add(h); }
            const core = new T.Mesh(new T.CircleGeometry(8, 48), basic(mixc(th.accent, th.primary, 0.3))); core.position.z = 0.4; core.renderOrder = 10; sunG.add(core);
            sunG.position.set(0, 1, -45); sunG.scale.setScalar(1.3); scene.add(sunG);
            [[0.55, -10, -38, 3], [0.35, -11, -26, 2.2], [0.15, -12, -14, 1.5]].forEach(([f, y, z, amp], li) => {
                const shape = new T.Shape(); shape.moveTo(-80, -20);
                for (let x = -80; x <= 80; x += 4) shape.lineTo(x, Math.abs(Math.sin(x * (0.06 + li * 0.03) + li * 2)) * (amp as number) * 3);
                shape.lineTo(80, -20); shape.closePath();
                const m = new T.Mesh(new T.ShapeGeometry(shape), basic(mixc(th.primary, th.page, 1 - (f as number) * 1.4)));
                m.position.set(0, y as number, z as number); scene.add(m);
            });
            const clouds: THREE_NS.Group[] = [];
            for (let i = 0; i < 7; i++) {
                const c = new T.Group();
                for (let k = 0; k < 4; k++) { const s = new T.Mesh(new T.SphereGeometry(rnd(1, 1.8), 12, 8), basic(mixc(th.page, white, 0.6), 0.75)); s.position.set(k * 1.5 - 2, rnd(-0.3, 0.5), 0); s.scale.y = 0.6; c.add(s); }
                c.position.set(rnd(-30, 30), rnd(1, 9), rnd(-35, -12)); scene.add(c); clouds.push(c);
            }
            const birds: Array<{ g: THREE_NS.Line; s: number; y: number; p: number }> = [];
            for (let i = 0; i < 6; i++) {
                const g = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-0.8, 0.3, 0), new T.Vector3(0, 0, 0), new T.Vector3(0.8, 0.3, 0)]), new T.LineBasicMaterial({ color: col(th.ink) }));
                g.position.set(rnd(-20, 20), rnd(2, 9), rnd(-25, -8)); scene.add(g); birds.push({ g, s: rnd(1, 2), y: g.position.y, p: rnd(0, 6) });
            }
            updaters.push((t, dt) => {
                clouds.forEach((c, i) => { c.position.x += (0.25 + (i % 3) * 0.1) * dt; if (c.position.x > 34) c.position.x = -34; });
                birds.forEach((b) => { b.g.position.x += b.s * dt; b.g.position.y = b.y + Math.sin(t * 0.8 + b.p) * 0.6; b.g.scale.y = 0.6 + Math.abs(Math.sin(t * 5 + b.p)); if (b.g.position.x > 24) b.g.position.x = -24; });
                sunG.scale.setScalar(1.3 + Math.sin(t * 0.5) * 0.03);
            });
            break;
        }
        // ------------------------------------------------------------------ classic: drifting numbers + big grid
        case 'classic': {
            const grid = new T.Group();
            const lm = (w: number, o: number) => new T.LineBasicMaterial({ color: col(th.accent), transparent: true, opacity: o, linewidth: w });
            const S = 27;
            for (let i = 0; i <= 9; i++) {
                const a = -S / 2 + (i * S) / 9, major = i % 3 === 0;
                grid.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(a, -S / 2, 0), new T.Vector3(a, S / 2, 0)]), lm(1, major ? 0.55 : 0.2)));
                grid.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-S / 2, a, 0), new T.Vector3(S / 2, a, 0)]), lm(1, major ? 0.55 : 0.2)));
            }
            grid.position.set(0, 0, -22); scene.add(grid);
            const sprites: Array<{ s: THREE_NS.Sprite; v: number; p: number; x0: number }> = [];
            for (let i = 0; i < 38; i++) {
                const s = new T.Sprite(new T.SpriteMaterial({ map: digitTexture(1 + (i % 9), css(i % 3 ? th.accent : th.primary)), transparent: true, opacity: rnd(0.15, 0.5), depthWrite: false }));
                const sc = rnd(1.5, 3.8); s.scale.set(sc, sc, 1);
                s.position.set(rnd(-26, 26), rnd(-12, 12), rnd(-30, 0)); scene.add(s);
                sprites.push({ s, v: rnd(0.2, 0.7), p: rnd(0, 6), x0: s.position.x });
            }
            updaters.push((t, dt) => {
                grid.rotation.y = Math.sin(t * 0.15) * 0.35; grid.rotation.x = Math.sin(t * 0.11) * 0.12;
                sprites.forEach((d) => { d.s.position.y += d.v * dt; d.s.position.x = d.x0 + Math.sin(t * 0.5 + d.p) * 0.8; if (d.s.position.y > 13) d.s.position.y = -13; });
            });
            break;
        }
        // ------------------------------------------------------------------ arctic
        case 'arctic': {
            const snow = points(700, () => [rnd(-30, 30), rnd(-14, 14), rnd(-35, 8)], col(white), 0.22, 0.95);
            updaters.push(drift(snow, 0.15, -0.9, 0.35, { x: 32, y: 14 }));
            [[mixc(th.primary, th.page, 0.6), 12, -44], [mixc(th.primary, th.page, 0.35), 9, -32]].forEach(([c, h, z], li) => {
                for (let i = 0; i < 6; i++) {
                    const hh = (h as number) * rnd(0.7, 1.3), x = -42 + i * 17 + rnd(-4, 4) + li * 8;
                    const m = new T.Mesh(new T.ConeGeometry(hh * 0.75, hh, 5), solid(c as THREE_NS.Color)); m.position.set(x, -13 + hh / 2, z as number); scene.add(m);
                    const cap = new T.Mesh(new T.ConeGeometry(hh * 0.28, hh * 0.34, 5), solid(col(white))); cap.position.set(x, -13 + hh * 0.84, z as number); scene.add(cap);
                }
            });
            const crystals: THREE_NS.Mesh[] = [];
            for (let i = 0; i < 12; i++) {
                const m = new T.Mesh(new T.OctahedronGeometry(1, 0), solid(mixc(th.accent, white, 0.35), 0.75));
                m.scale.set(rnd(0.6, 1.1), rnd(1.4, 2.8), rnd(0.6, 1.1));
                m.position.set((i % 2 ? 1 : -1) * rnd(8, 22), rnd(-6, 9), rnd(-24, -4)); scene.add(m); crystals.push(m);
            }
            const aurora = new T.Mesh(new T.PlaneGeometry(90, 14, 60, 1), basic(col(th.accent), 0.14, T.DoubleSide));
            aurora.position.set(0, 11, -40); scene.add(aurora);
            const ap = aurora.geometry.attributes.position as THREE_NS.BufferAttribute;
            updaters.push((t) => {
                crystals.forEach((c, i) => { c.rotation.y = t * 0.3 + i; c.position.y += Math.sin(t * 0.6 + i) * 0.004; });
                for (let i = 0; i < ap.count; i++) ap.setZ(i, Math.sin(ap.getX(i) * 0.15 + t * 0.6) * 2.5 + (ap.getY(i) > 0 ? Math.sin(ap.getX(i) * 0.3 + t) : 0));
                ap.needsUpdate = true;
            });
            break;
        }
        // ------------------------------------------------------------------ cyber
        case 'cyber': {
            const sunD = new T.Mesh(new T.CircleGeometry(11, 48), basic(col(th.primary), 0.9)); sunD.position.set(0, 3, -55); sunD.renderOrder = 2; scene.add(sunD);
            const halo = new T.Mesh(new T.CircleGeometry(16, 48), basic(col(th.primary), 0.15)); halo.position.set(0, 3, -57); halo.renderOrder = 1; scene.add(halo);
            const grid = new T.GridHelper(160, 80, col(th.accent), col(th.filled));
            grid.position.y = -9; (grid.material as THREE_NS.Material).transparent = true; (grid.material as THREE_NS.Material).opacity = 0.6; scene.add(grid);
            for (let i = 0; i < 40; i++) {
                const w = rnd(2, 5), h = rnd(5, 26), x = -45 + i * 2.4 + rnd(-1, 1), z = rnd(-48, -30);
                const m = new T.Mesh(new T.BoxGeometry(w, h, w), solid(mixc(th.page, [70, 30, 120], 0.55)));
                m.position.set(x, -9 + h / 2, z); scene.add(m);
                const e = new T.LineSegments(new T.EdgesGeometry(m.geometry), new T.LineBasicMaterial({ color: col(i % 2 ? th.accent : th.primary), transparent: true, opacity: 0.8 }));
                e.position.copy(m.position); scene.add(e);
            }
            const rain = points(220, () => [rnd(-30, 30), rnd(-12, 14), rnd(-30, 6)], col(th.accent), 0.14, 0.7);
            updaters.push((t, dt) => { grid.position.z = (t * 3) % 2; drift(rain, 0, -9, 0, { x: 32, y: 14 })(t, dt); halo.scale.setScalar(1 + Math.sin(t * 1.5) * 0.04); });
            break;
        }
        // ------------------------------------------------------------------ sakura
        case 'sakura': {
            const fuji = new T.Mesh(new T.ConeGeometry(16, 14, 5), solid(mixc(th.primary, th.page, 0.7))); fuji.position.set(-6, -11 + 7, -48); scene.add(fuji);
            const cap = new T.Mesh(new T.ConeGeometry(5, 4.6, 5), solid(col(white))); cap.position.set(-6, -11 + 11.8, -48); scene.add(cap);
            const sunD = new T.Mesh(new T.CircleGeometry(4, 40), basic(mixc(th.accent, th.page, 0.2))); sunD.position.set(14, 8, -50); scene.add(sunD);
            const curve = new T.CatmullRomCurve3([new T.Vector3(26, 9, -4), new T.Vector3(19, 7, -3), new T.Vector3(13, 8.5, -4), new T.Vector3(7, 6, -5)]);
            scene.add(new T.Mesh(new T.TubeGeometry(curve, 30, 0.22, 6), solid(mixc(th.ink, [120, 80, 60], 0.4))));
            for (let i = 0; i < 26; i++) {
                const p = curve.getPoint(i / 25);
                const b = new T.Mesh(new T.IcosahedronGeometry(rnd(0.35, 0.7), 0), solid(mixc(th.primary, white, rnd(0.3, 0.65)))); b.position.set(p.x + rnd(-0.7, 0.7), p.y + rnd(-0.8, 0.8), p.z + rnd(-0.5, 0.5)); scene.add(b);
            }
            const N = 140;
            const petals = new T.InstancedMesh(new T.CircleGeometry(0.28, 5), basic(mixc(th.primary, white, 0.5), 0.9, T.DoubleSide), N);
            const pd = Array.from({ length: N }, () => ({ x: rnd(-26, 26), y: rnd(-12, 12), z: rnd(-25, 4), s: rnd(0.5, 1.3), p: rnd(0, 6) }));
            scene.add(petals);
            const dummy = new T.Object3D();
            updaters.push((t, dt) => {
                pd.forEach((d, i) => {
                    d.y -= d.s * dt; d.x += (0.5 + Math.sin(t * 0.7 + d.p) * 0.6) * dt;
                    if (d.y < -12) { d.y = 12; d.x = rnd(-26, 26); } if (d.x > 27) d.x = -27;
                    dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(t * d.s + d.p, t * 0.8 + d.p, t * 0.5); dummy.updateMatrix();
                    petals.setMatrixAt(i, dummy.matrix);
                });
                petals.instanceMatrix.needsUpdate = true;
            });
            break;
        }
        // ------------------------------------------------------------------ desert
        case 'desert': {
            const sunG = new T.Group();
            for (let i = 0; i < 4; i++) { const h = new T.Mesh(new T.CircleGeometry(6 + i * 2.5, 48), basic(mixc(th.accent, th.page, 0.75), 0.28)); h.position.z = -0.4 - i * 0.4; h.renderOrder = i; sunG.add(h); }
            const core = new T.Mesh(new T.CircleGeometry(5.5, 48), basic(mixc(th.primary, th.page, 0.2))); core.position.z = 0.4; core.renderOrder = 10; sunG.add(core);
            sunG.position.set(12, 8, -45); scene.add(sunG);
            [[0.3, -12, -40, 6], [0.5, -12.5, -28, 4.5], [0.7, -13, -16, 3]].forEach(([f, y, z, amp], li) => {
                const shape = new T.Shape(); shape.moveTo(-90, -25);
                for (let x = -90; x <= 90; x += 3) shape.lineTo(x, (Math.sin(x * 0.045 + li * 1.7) * 0.5 + 0.5) * (amp as number) * 2);
                shape.lineTo(90, -25); shape.closePath();
                const m = new T.Mesh(new T.ShapeGeometry(shape), basic(mixc(th.page, th.primary, f as number))); m.position.set(0, y as number, z as number); scene.add(m);
            });
            const cactus = (x: number, z: number, h: number) => {
                const g = new T.Group(), m = solid(col(th.accent));
                const body = new T.Mesh(new T.CylinderGeometry(h * 0.09, h * 0.09, h, 8), m); body.position.y = h / 2; g.add(body);
                for (const side of [-1, 1]) {
                    const arm = new T.Mesh(new T.CylinderGeometry(h * 0.06, h * 0.06, h * 0.3, 8), m); arm.position.set(side * h * 0.22, h * (side > 0 ? 0.55 : 0.68), 0); g.add(arm);
                    const link = new T.Mesh(new T.CylinderGeometry(h * 0.06, h * 0.06, h * 0.22, 8), m); link.rotation.z = Math.PI / 2; link.position.set(side * h * 0.11, h * (side > 0 ? 0.42 : 0.55), 0); g.add(link);
                }
                g.position.set(x, -12.5, z); scene.add(g); return g;
            };
            const cacti = [cactus(-15, -12, 7), cactus(13, -16, 9), cactus(-26, -22, 6), cactus(24, -10, 5)];
            const dust = points(160, () => [rnd(-30, 30), rnd(-12, 10), rnd(-30, 4)], mixc(th.primary, th.page, 0.4), 0.2, 0.6);
            updaters.push((t, dt) => { drift(dust, 1.4, 0.05, 0.3, { x: 32, y: 12 })(t, dt); sunG.scale.setScalar(1 + Math.sin(t * 0.6) * 0.03); cacti.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.8 + i) * 0.01; }); });
            break;
        }
        // ------------------------------------------------------------------ candy
        case 'candy': {
            const palette = [col(th.primary), col(th.accent), col([250, 204, 21]), col([167, 139, 250]), col([255, 140, 90]), col([96, 165, 250])];
            const items: Array<{ g: THREE_NS.Object3D; y: number; p: number; s: number }> = [];
            for (let i = 0; i < 26; i++) {
                const c = palette[i % palette.length], g = new T.Group(), kind = i % 3;
                if (kind === 0) { // lollipop
                    g.add(new T.Mesh(new T.SphereGeometry(1.1, 20, 14), solid(c)));
                    const stick = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 2.4, 6), solid(col(white))); stick.position.y = -1.9; g.add(stick);
                    const swirl = new T.Mesh(new T.TorusGeometry(0.6, 0.12, 6, 20), solid(col(white))); swirl.position.z = 1.0; g.add(swirl);
                } else if (kind === 1) { // donut
                    g.add(new T.Mesh(new T.TorusGeometry(1, 0.45, 12, 24), solid(c)));
                    const icing = new T.Mesh(new T.TorusGeometry(1, 0.5, 12, 24), solid(mixc(th.page, white, 0.5), 0.9)); icing.scale.z = 0.5; icing.position.z = 0.1; g.add(icing);
                } else { // gumdrop
                    g.add(new T.Mesh(new T.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.7), solid(c)));
                }
                g.position.set((i % 2 ? 1 : -1) * rnd(6, 26), rnd(-9, 10), rnd(-26, -2)); g.scale.setScalar(rnd(0.8, 1.6));
                scene.add(g); items.push({ g, y: g.position.y, p: rnd(0, 6), s: rnd(0.3, 0.9) });
            }
            const confetti = points(200, () => [rnd(-26, 26), rnd(-13, 13), rnd(-25, 4)], palette, 0.28, 0.9);
            updaters.push((t, dt) => {
                items.forEach((it) => { it.g.rotation.x = t * it.s * 0.6; it.g.rotation.y = t * it.s; it.g.position.y = it.y + Math.sin(t * 0.7 + it.p) * 0.8; });
                drift(confetti, 0.1, -0.5, 0.3, { x: 28, y: 14 })(t, dt);
            });
            break;
        }
    }

    return (t, dt) => updaters.forEach((u) => u(t, dt));
}
