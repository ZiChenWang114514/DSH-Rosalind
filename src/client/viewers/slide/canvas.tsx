import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type SlideRectangle = { id: string; x: number; y: number; width: number; height: number; label?: string };
export type SlideTile = { dataUrl: string; x: number; y: number; width: number; height: number; sourceRevision: string };

export interface LocalSlideCanvasProps {
  width: number;
  height: number;
  sourceRevision: string;
  tile: SlideTile | null;
  regions: readonly SlideRectangle[];
  onCreateRegion?: (region: Omit<SlideRectangle, "id">) => void;
  onViewportChange?: (region: Omit<SlideRectangle, "id">) => void;
  ariaLabel?: string;
}

type Point = { x: number; y: number };

function slidePoint(event: PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement, width: number, height: number): Point {
  const box = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(width, ((event.clientX - box.left) / box.width) * width)), y: Math.max(0, Math.min(height, ((event.clientY - box.top) / box.height) * height)) };
}

/** A self-contained Canvas surface used by the DSH Slide Viewer. It draws only a
 * source tile supplied by the host and keeps ROI geometry in base-slide pixels. */
export function LocalSlideCanvas(props: LocalSlideCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null); const originRef = useRef<Point | null>(null); const imageRef = useRef<{ key: string; image: HTMLImageElement | null } | null>(null); const [imageVersion, setImageVersion] = useState(0); const [origin, setOrigin] = useState<Point | null>(null); const [cursor, setCursor] = useState<Point | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const draft = useMemo(() => origin && cursor ? { x: Math.min(origin.x, cursor.x), y: Math.min(origin.y, cursor.y), width: Math.abs(cursor.x - origin.x), height: Math.abs(cursor.y - origin.y) } : null, [origin, cursor]);
  const tileKey = props.tile && props.tile.sourceRevision === props.sourceRevision ? `${props.sourceRevision}:${props.tile.x}:${props.tile.y}:${props.tile.width}:${props.tile.height}:${props.tile.dataUrl}` : null;

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
    if (!tileKey || !props.tile) { imageRef.current = null; setImageVersion((version) => version + 1); return undefined; }
    let active = true;
    const image = new Image(); image.decoding = "async"; image.loading = "eager"; imageRef.current = { key: tileKey, image: null };
    image.onload = () => { if (active && imageRef.current?.key === tileKey) { imageRef.current = { key: tileKey, image }; setImageVersion((version) => version + 1); } };
    image.onerror = () => { if (active && imageRef.current?.key === tileKey) { imageRef.current = { key: tileKey, image: null }; setImageVersion((version) => version + 1); } };
    image.src = props.tile.dataUrl;
    return () => { active = false; image.onload = null; image.onerror = null; };
  }, [tileKey]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; const context = canvas.getContext("2d"); if (!context) return;
    const ratio = window.devicePixelRatio || 1; const cssWidth = Math.max(1, canvas.clientWidth); const cssHeight = Math.max(1, canvas.clientHeight); canvas.width = Math.round(cssWidth * ratio); canvas.height = Math.round(cssHeight * ratio); context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, cssWidth, cssHeight);
    context.fillStyle = "#f1e7e9"; context.fillRect(0, 0, cssWidth, cssHeight);
    const drawRect = (region: Omit<SlideRectangle, "id">, color: string, dash: number[] = []) => { context.save(); context.strokeStyle = color; context.lineWidth = 2; context.setLineDash(dash); context.strokeRect(region.x / props.width * cssWidth, region.y / props.height * cssHeight, region.width / props.width * cssWidth, region.height / props.height * cssHeight); context.restore(); };
    const loaded = tileKey && imageRef.current?.key === tileKey ? imageRef.current.image : null;
    if (loaded && props.tile) context.drawImage(loaded, props.tile.x / props.width * cssWidth, props.tile.y / props.height * cssHeight, props.tile.width / props.width * cssWidth, props.tile.height / props.height * cssHeight);
    for (const region of props.regions) drawRect(region, "#f2c94c"); if (draft) drawRect(draft, "#4f8fab", [5, 4]);
  }, [canvasSize, draft, imageVersion, props.height, props.regions, props.tile, props.width, tileKey]);
  const finish = (end?: Point) => { const start = originRef.current; const finalCursor = end ?? cursor; const region = start && finalCursor ? { x: Math.min(start.x, finalCursor.x), y: Math.min(start.y, finalCursor.y), width: Math.abs(finalCursor.x - start.x), height: Math.abs(finalCursor.y - start.y) } : null; if (region && region.width >= 1 && region.height >= 1) { props.onCreateRegion?.(region); props.onViewportChange?.(region); } originRef.current = null; setOrigin(null); setCursor(null); };
  const keyboard = (event: KeyboardEvent<HTMLCanvasElement>) => { if (event.key === "Escape") { originRef.current = null; setOrigin(null); setCursor(null); } if (event.key === "Enter" && draft) { event.preventDefault(); finish(); } };
  return <canvas ref={canvasRef} className="sv-slide-canvas" tabIndex={0} role="application" aria-label={props.ariaLabel ?? "Local slide tile canvas. Drag to create a rectangular region in base slide pixels."} onKeyDown={keyboard} onPointerDown={(event) => { const canvas = canvasRef.current; if (!canvas) return; canvas.setPointerCapture?.(event.pointerId); const point = slidePoint(event, canvas, props.width, props.height); originRef.current = point; setOrigin(point); setCursor(point); }} onPointerMove={(event) => { const canvas = canvasRef.current; if (originRef.current && canvas) setCursor(slidePoint(event, canvas, props.width, props.height)); }} onPointerUp={(event) => { const canvas = canvasRef.current; finish(canvas ? slidePoint(event, canvas, props.width, props.height) : undefined); }} />;
}
