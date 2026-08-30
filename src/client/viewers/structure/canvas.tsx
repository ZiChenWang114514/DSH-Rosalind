import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";

export type StructureCanvasAtom = {
  atomId: string;
  element: string;
  x: number;
  y: number;
  z: number;
  objectId?: string;
};

export interface LocalStructureCanvasProps {
  atoms: readonly StructureCanvasAtom[];
  selectedAtomIds?: readonly string[];
  background?: "light" | "dark";
  onSelectAtom?: (atom: StructureCanvasAtom | null) => void;
  onRenderReady?: (detail: { renderedAtomCount: number }) => void;
  ariaLabel?: string;
}

type Viewport = { scale: number; x: number; y: number };
type Point = { x: number; y: number };
type DragState = { pointerId: number; origin: Point; previous: Point; moved: boolean };
const colorByElement: Record<string, string> = { C: "#4c5967", N: "#356dc1", O: "#d9534f", S: "#d1a619", P: "#da7e1d", H: "#eff4f8" };

function projected(atoms: readonly StructureCanvasAtom[], canvas: HTMLCanvasElement, viewport: Viewport): Array<{ atom: StructureCanvasAtom; x: number; y: number; radius: number }> {
  const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
  if (!atoms.length) return [];
  const xs = atoms.map((atom) => atom.x), ys = atoms.map((atom) => atom.y);
  const zs = atoms.map((atom) => atom.z), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const span = Math.max(1, maxX - minX, maxY - minY), fit = .8 * Math.min(width, height) / span * viewport.scale;
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  return atoms.map((atom) => ({ atom, x: width / 2 + (atom.x - centerX) * fit + viewport.x, y: height / 2 - (atom.y - centerY) * fit + viewport.y, radius: Math.max(2.2, Math.min(7, 2.5 + (atom.z - minZ) / Math.max(1, maxZ - minZ) * 3)) })).sort((left, right) => left.atom.z - right.atom.z);
}

/** A host-supplied coordinate canvas: pan with drag, zoom with wheel, and select an atom by click.
 * It deliberately renders only local coordinates already returned by structure.query. */
export function LocalStructureCanvas(props: LocalStructureCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null), dragRef = useRef<DragState | null>(null), reportedRenderRef = useRef<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const selected = useMemo(() => new Set(props.selectedAtomIds ?? []), [props.selectedAtomIds]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return undefined;
    const updateSize = () => {
      const next = { width: Math.max(1, canvas.clientWidth), height: Math.max(1, canvas.clientHeight) };
      setCanvasSize((current) => current.width === next.width && current.height === next.height ? current : next);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const context = canvas.getContext("2d"); if (!context) return;
    const ratio = window.devicePixelRatio || 1, width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
    if (props.background) { context.fillStyle = props.background === "dark" ? "#101827" : "#f7fafc"; context.fillRect(0, 0, width, height); }
    const dots = projected(props.atoms, canvas, viewport);
    for (const dot of dots) { context.beginPath(); context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2); context.fillStyle = colorByElement[dot.atom.element.toUpperCase()] ?? "#8d9aa8"; context.fill(); if (selected.has(dot.atom.atomId)) { context.lineWidth = 2; context.strokeStyle = "#f6c343"; context.stroke(); } }
    if (!dots.length) { context.fillStyle = props.background === "dark" ? "#d7e3f4" : props.background === "light" ? "#526170" : getComputedStyle(canvas).color; context.font = "14px system-ui"; context.textAlign = "center"; context.fillText("No queried coordinates are available for this view.", width / 2, height / 2); }
    const renderKey = `${dots.length}:${width}:${height}:${props.background ?? "light"}`;
    if (reportedRenderRef.current !== renderKey) { reportedRenderRef.current = renderKey; props.onRenderReady?.({ renderedAtomCount: dots.length }); }
  }, [canvasSize, props.atoms, props.background, selected, viewport]);
  const point = (event: PointerEvent<HTMLCanvasElement>): Point => { const canvas = canvasRef.current!, box = canvas.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top }; };
  const nearest = (event: PointerEvent<HTMLCanvasElement>) => { const canvas = canvasRef.current; if (!canvas) return null; const at = point(event); return projected(props.atoms, canvas, viewport).reduce<{ atom: StructureCanvasAtom; distance: number } | null>((best, dot) => { const distance = Math.hypot(dot.x - at.x, dot.y - at.y); return distance <= Math.max(10, dot.radius * 2) && (!best || distance < best.distance) ? { atom: dot.atom, distance } : best; }, null)?.atom ?? null; };
  const keyboard = (event: KeyboardEvent<HTMLCanvasElement>) => { if (event.key === "Home") { event.preventDefault(); setViewport({ scale: 1, x: 0, y: 0 }); } if (event.key === "Escape") props.onSelectAtom?.(null); };
  const wheel = (event: WheelEvent<HTMLCanvasElement>) => { event.preventDefault(); setViewport((current) => ({ ...current, scale: Math.max(.25, Math.min(8, current.scale * (event.deltaY > 0 ? .88 : 1.14))) })); };
  const finishPointer = (event: PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const drag = dragRef.current; dragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
    const end = point(event);
    if (!cancelled && !drag.moved && Math.hypot(end.x - drag.origin.x, end.y - drag.origin.y) < 4) props.onSelectAtom?.(nearest(event));
  };
  return <canvas data-view-scale={viewport.scale} ref={canvasRef} className="sv-structure-canvas" tabIndex={0} role="application" aria-label={props.ariaLabel ?? "Local molecular coordinate view. Drag to pan, use the mouse wheel to zoom, click an atom to select it, and press Home to reset the view."} onKeyDown={keyboard} onWheel={wheel} onPointerDown={(event) => { const canvas = canvasRef.current; if (!canvas) return; canvas.setPointerCapture?.(event.pointerId); const origin = point(event); dragRef.current = { pointerId: event.pointerId, origin, previous: origin, moved: false }; }} onPointerMove={(event) => { const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; const current = point(event); const deltaX = current.x - drag.previous.x, deltaY = current.y - drag.previous.y; if (Math.hypot(current.x - drag.origin.x, current.y - drag.origin.y) >= 4) drag.moved = true; setViewport((value) => ({ ...value, x: value.x + deltaX, y: value.y + deltaY })); drag.previous = current; }} onPointerUp={(event) => finishPointer(event, false)} onPointerCancel={(event) => finishPointer(event, true)} />;
}
