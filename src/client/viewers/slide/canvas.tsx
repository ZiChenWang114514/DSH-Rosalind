import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type SlideRectangle = { id: string; x: number; y: number; width: number; height: number; label?: string };
export type SlideTile = { dataUrl: string; x: number; y: number; width: number; height: number; sourceRevision: string };
export type SlideViewport = { zoom: number; panX: number; panY: number };

export interface LocalSlideCanvasProps {
  width: number;
  height: number;
  sourceRevision: string;
  tile: SlideTile | null;
  regions: readonly SlideRectangle[];
  onCreateRegion?: (region: Omit<SlideRectangle, "id">) => void;
  onViewportChange?: (viewport: SlideViewport) => void;
  ariaLabel?: string;
}

type Point = { x: number; y: number };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function baseScale(canvas: HTMLCanvasElement, width: number, height: number): { x: number; y: number } {
  return { x: Math.max(1, canvas.clientWidth) / Math.max(1, width), y: Math.max(1, canvas.clientHeight) / Math.max(1, height) };
}

function slidePoint(event: PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement, width: number, height: number, viewport: SlideViewport): Point {
  const box = canvas.getBoundingClientRect();
  const scale = { x: box.width / Math.max(1, width), y: box.height / Math.max(1, height) };
  return {
    x: clamp((((event.clientX - box.left) - (box.width / 2) - viewport.panX) / (scale.x * viewport.zoom)) + (width / 2), 0, width),
    y: clamp((((event.clientY - box.top) - (box.height / 2) - viewport.panY) / (scale.y * viewport.zoom)) + (height / 2), 0, height),
  };
}

/** A self-contained Canvas surface used by the DSH Slide Viewer. It draws only a
 * source tile supplied by the host and keeps ROI geometry in base-slide pixels. */
export function LocalSlideCanvas(props: LocalSlideCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originRef = useRef<Point | null>(null);
  const imageRef = useRef<{ key: string; image: HTMLImageElement | null } | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [origin, setOrigin] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<SlideViewport>({ zoom: 1, panX: 0, panY: 0 });
  const draft = useMemo(() => origin && cursor ? { x: Math.min(origin.x, cursor.x), y: Math.min(origin.y, cursor.y), width: Math.abs(cursor.x - origin.x), height: Math.abs(cursor.y - origin.y) } : null, [origin, cursor]);
  const tileKey = props.tile && props.tile.sourceRevision === props.sourceRevision ? `${props.sourceRevision}:${props.tile.x}:${props.tile.y}:${props.tile.width}:${props.tile.height}:${props.tile.dataUrl}` : null;

  const updateViewport = (change: (current: SlideViewport) => SlideViewport) => {
    setViewport((current) => {
      const next = change(current);
      props.onViewportChange?.(next);
      return next;
    });
  };

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
    const scale = baseScale(canvas, props.width, props.height);
    const project = (point: Point): Point => ({ x: cssWidth / 2 + ((point.x - props.width / 2) * scale.x * viewport.zoom) + viewport.panX, y: cssHeight / 2 + ((point.y - props.height / 2) * scale.y * viewport.zoom) + viewport.panY });
    const drawRect = (region: Omit<SlideRectangle, "id">, color: string, dash: number[] = []) => { const start = project(region); context.save(); context.strokeStyle = color; context.lineWidth = 2; context.setLineDash(dash); context.strokeRect(start.x, start.y, region.width * scale.x * viewport.zoom, region.height * scale.y * viewport.zoom); context.restore(); };
    const loaded = tileKey && imageRef.current?.key === tileKey ? imageRef.current.image : null;
    if (loaded && props.tile) { const start = project(props.tile); context.drawImage(loaded, start.x, start.y, props.tile.width * scale.x * viewport.zoom, props.tile.height * scale.y * viewport.zoom); }
    for (const region of props.regions) drawRect(region, "#f2c94c"); if (draft) drawRect(draft, "#4f8fab", [5, 4]);
  }, [canvasSize, draft, imageVersion, props.height, props.regions, props.tile, props.width, tileKey, viewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const wheel = (event: WheelEvent) => { event.preventDefault(); updateViewport((current) => ({ ...current, zoom: clamp(current.zoom * (event.deltaY > 0 ? .88 : 1.14), .5, 8) })); };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, []);

  const finish = (end?: Point) => { const start = originRef.current; const finalCursor = end ?? cursor; const region = start && finalCursor ? { x: Math.min(start.x, finalCursor.x), y: Math.min(start.y, finalCursor.y), width: Math.abs(finalCursor.x - start.x), height: Math.abs(finalCursor.y - start.y) } : null; if (region && region.width >= 1 && region.height >= 1) props.onCreateRegion?.(region); originRef.current = null; setOrigin(null); setCursor(null); };
  const keyboard = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const pan = event.shiftKey ? 48 : 20;
    if (event.key === "Escape") { originRef.current = null; setOrigin(null); setCursor(null); }
    else if (event.key === "Home" || event.key === "0") { event.preventDefault(); updateViewport(() => ({ zoom: 1, panX: 0, panY: 0 })); }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); updateViewport((current) => ({ ...current, zoom: clamp(current.zoom * 1.2, .5, 8) })); }
    else if (event.key === "-" || event.key === "_") { event.preventDefault(); updateViewport((current) => ({ ...current, zoom: clamp(current.zoom / 1.2, .5, 8) })); }
    else if (event.key.startsWith("Arrow")) { event.preventDefault(); updateViewport((current) => ({ ...current, panX: current.panX + (event.key === "ArrowLeft" ? -pan : event.key === "ArrowRight" ? pan : 0), panY: current.panY + (event.key === "ArrowUp" ? -pan : event.key === "ArrowDown" ? pan : 0) })); }
    else if (event.key === "Enter" && draft) { event.preventDefault(); finish(); }
  };
  return <canvas data-slide-pan-x={viewport.panX} data-slide-pan-y={viewport.panY} data-slide-zoom={viewport.zoom} ref={canvasRef} className="sv-slide-canvas" tabIndex={0} role="img" aria-label={props.ariaLabel ?? "Local slide tile preview. Drag to create a rectangular region. Use arrow keys to pan, plus or minus to zoom, and Home to reset the view."} onKeyDown={keyboard} onPointerDown={(event) => { const canvas = canvasRef.current; if (!canvas) return; canvas.setPointerCapture?.(event.pointerId); const point = slidePoint(event, canvas, props.width, props.height, viewport); originRef.current = point; setOrigin(point); setCursor(point); }} onPointerMove={(event) => { const canvas = canvasRef.current; if (originRef.current && canvas) setCursor(slidePoint(event, canvas, props.width, props.height, viewport)); }} onPointerUp={(event) => { const canvas = canvasRef.current; finish(canvas ? slidePoint(event, canvas, props.width, props.height, viewport) : undefined); }} />;
}
