'use client';

import { useEffect, useRef } from 'react';
import type * as THREE_NS from 'three';
import { getTheme } from '../lib/themes';
import { useTheme } from './ThemeProvider';

/** 3D backdrop whose scene (planets, forest, waves, petals...) follows the selected theme. */
export default function ThreeBackground() {
    const mount = useRef<HTMLDivElement>(null);
    const { theme, mode } = useTheme();

    useEffect(() => {
        const el = mount.current;
        if (!el) return;
        let disposed = false;
        let cleanup = () => {};

        (async () => {
            // The backdrop is decoration: it waits until the page has loaded and the browser is idle, so it never delays the game.
            await new Promise<void>((r) => {
                const go = () => { const w = window as unknown as { requestIdleCallback?: (cb: () => void, o: { timeout: number }) => void }; if (w.requestIdleCallback) w.requestIdleCallback(() => r(), { timeout: 3000 }); else setTimeout(r, 1500); };
                if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
            });
            await new Promise((r) => setTimeout(r, 2000)); // a little longer, so the first seconds belong to the game
            if (disposed) return;
            const [THREE, { buildScene }] = await Promise.all([import('three'), import('../lib/scenes3d')]);
            if (disposed) return;
            const th = getTheme(theme, mode);
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setSize(window.innerWidth, window.innerHeight);
            el.appendChild(renderer.domElement);

            const scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(new THREE.Color(th.page[0] / 255, th.page[1] / 255, th.page[2] / 255), 0.012);
            const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 250);
            camera.position.set(0, 0, 14);
            const update = buildScene(THREE, scene, th);

            let mx = 0, my = 0;
            const onMove = (e: PointerEvent) => { mx = (e.clientX / window.innerWidth - 0.5) * 2; my = (e.clientY / window.innerHeight - 0.5) * 2; };
            const onResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('resize', onResize);

            let raf = 0, last = performance.now();
            const t0 = last;
            const frame = (now: number) => {
                const dt = Math.min((now - last) / 1000, 0.1);
                last = now;
                update(reduce ? 0 : (now - t0) / 1000, reduce ? 0 : dt);
                if (!reduce) {
                    camera.position.x += (mx * 1.6 - camera.position.x) * 0.03;
                    camera.position.y += (-my * 1.0 - camera.position.y) * 0.03;
                    camera.lookAt(0, 0, 0);
                }
                renderer.render(scene, camera);
                raf = requestAnimationFrame(frame);
            };
            raf = requestAnimationFrame(frame);

            cleanup = () => {
                cancelAnimationFrame(raf);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('resize', onResize);
                scene.traverse((o) => {
                    const obj = o as THREE_NS.Object3D & { geometry?: THREE_NS.BufferGeometry; material?: THREE_NS.Material | THREE_NS.Material[] };
                    obj.geometry?.dispose();
                    const m = obj.material;
                    (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { (x as THREE_NS.MeshBasicMaterial).map?.dispose(); x.dispose(); });
                });
                renderer.dispose();
                renderer.domElement.remove();
            };
        })();

        return () => { disposed = true; cleanup(); };
    }, [theme, mode]);

    return <div ref={mount} className="three-bg" aria-hidden="true" />;
}
