'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface FxHandle {
    /** Particle burst at viewport coordinates. */
    burst: (x: number, y: number, color: number, count?: number) => void;
    /** Firework show across the screen. */
    fireworks: (colors?: number[]) => void;
}

/** Transparent Phaser canvas laid over the page, used only for particle effects. */
const FxLayer = forwardRef<FxHandle>(function FxLayer(_, ref) {
    const host = useRef<HTMLDivElement>(null);
    const scene = useRef<any>(null);
    const queue = useRef<Array<() => void>>([]);

    useImperativeHandle(ref, () => ({
        burst: (x, y, color, count = 18) => {
            const run = () => {
                const s = scene.current;
                const e = s.add.particles(x, y, 'spark', {
                    speed: { min: 60, max: 260 }, angle: { min: 0, max: 360 }, scale: { start: 1, end: 0 },
                    alpha: { start: 1, end: 0 }, lifespan: { min: 350, max: 750 }, gravityY: 220,
                    tint: color, blendMode: 'ADD', emitting: false,
                });
                e.explode(count);
                s.time.delayedCall(900, () => e.destroy());
            };
            scene.current ? run() : queue.current.push(run);
        },
        fireworks: (palette) => {
            const run = () => {
                const s = scene.current;
                const colors = palette && palette.length ? palette : [0x22d3ee, 0xf472b6, 0xa78bfa, 0xfacc15, 0x34d399];
                for (let i = 0; i < 14; i++) {
                    s.time.delayedCall(i * 260, () => {
                        const x = Math.random() * s.scale.width * 0.8 + s.scale.width * 0.1;
                        const y = Math.random() * s.scale.height * 0.5 + s.scale.height * 0.1;
                        const e = s.add.particles(x, y, 'spark', {
                            speed: { min: 80, max: 340 }, angle: { min: 0, max: 360 }, scale: { start: 1.4, end: 0 },
                            alpha: { start: 1, end: 0 }, lifespan: 1300, gravityY: 160,
                            tint: colors[i % colors.length], blendMode: 'ADD', emitting: false,
                        });
                        e.explode(70);
                        s.time.delayedCall(1500, () => e.destroy());
                    });
                }
            };
            scene.current ? run() : queue.current.push(run);
        },
    }));

    useEffect(() => {
        let game: any;
        let disposed = false;
        (async () => {
            const Phaser = (await import('phaser')).default;
            if (disposed || !host.current) return;
            class FxScene extends Phaser.Scene {
                create() {
                    const g = this.add.graphics();
                    g.fillStyle(0xffffff, 1);
                    g.fillCircle(6, 6, 6);
                    g.generateTexture('spark', 12, 12);
                    g.destroy();
                    scene.current = this;
                    queue.current.splice(0).forEach((fn) => fn());
                }
            }
            game = new Phaser.Game({
                type: Phaser.AUTO,
                parent: host.current,
                transparent: true,
                scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
                scene: FxScene,
                banner: false,
                audio: { noAudio: true },
            });
        })();
        return () => { disposed = true; scene.current = null; game?.destroy(true); };
    }, []);

    return <div ref={host} className="fx-layer" aria-hidden="true" />;
});

export default FxLayer;
