'use client';

import { useEffect, useRef } from 'react';
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
            const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 250);
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
                scene.traverse((o: any) => {
                    o.geometry?.dispose?.();
                    const m = o.material;
                    (Array.isArray(m) ? m : m ? [m] : []).forEach((x: any) => { x.map?.dispose?.(); x.dispose?.(); });
                });
                renderer.dispose();
                renderer.domElement.remove();
            };
        })();

        return () => { disposed = true; cleanup(); };
    }, [theme, mode]);

    return <div ref={mount} className="three-bg" aria-hidden="true" />;
}
