import type { jsPDF } from 'jspdf';
import type { RGB } from './palette';

export type PDF = jsPDF;
export type { RGB } from './palette';
export type { Theme } from './themes';
export { mix } from './palette';

export function rng(seed: number) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const fill = (pdf: PDF, c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
export const stroke = (pdf: PDF, c: RGB) => pdf.setDrawColor(c[0], c[1], c[2]);
export const textc = (pdf: PDF, c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);

export function opacity(pdf: PDF, o: number) {
    const p = pdf as any;
    p.setGState(new p.GState({ opacity: o, 'stroke-opacity': o }));
}
