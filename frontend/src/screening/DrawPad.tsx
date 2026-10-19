import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface DrawPadHandle {
  clear: () => void;
  toFile: (name: string) => Promise<File | null>;
}

const SIZE = 560; // backing resolution; the server resizes to 224

// The models were trained on scanned pen drawings, so the pad imitates them:
// a thick-enough stroke (thin strokes read as "abnormal" after the 224 resize),
// and the export is cropped to the drawing so it fills the frame like a scan.
// An optional template (unit coordinates) is printed in black for tracing,
// matching the meander dataset where people trace a printed square spiral.
export const DrawPad = forwardRef<
  DrawPadHandle,
  { onChange?: (empty: boolean) => void; template?: [number, number][]; ink?: string; width?: number }
>(function DrawPad({ onChange, template, ink = "#111", width = 8 }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  const paintBackground = () => {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (template) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 6;
      ctx.lineJoin = "miter";
      ctx.beginPath();
      template.forEach(([x, y], i) => (i ? ctx.lineTo(x * SIZE, y * SIZE) : ctx.moveTo(x * SIZE, y * SIZE)));
      ctx.stroke();
    }
  };

  useEffect(paintBackground, []);

  const setEmptyState = (v: boolean) => {
    setEmpty(v);
    onChange?.(v);
  };

  useImperativeHandle(ref, () => ({
    clear() {
      paintBackground();
      setEmptyState(true);
    },
    toFile(name) {
      const src = canvasRef.current!;
      const { data } = src.getContext("2d")!.getImageData(0, 0, SIZE, SIZE);
      let x0 = SIZE, y0 = SIZE, x1 = 0, y1 = 0;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const i = (y * SIZE + x) * 4;
          if (data[i] + data[i + 1] + data[i + 2] < 600) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.06);
      x0 = Math.max(0, x0 - pad);
      y0 = Math.max(0, y0 - pad);
      x1 = Math.min(SIZE - 1, x1 + pad);
      y1 = Math.min(SIZE - 1, y1 + pad);
      const out = document.createElement("canvas");
      out.width = Math.max(1, x1 - x0 + 1);
      out.height = Math.max(1, y1 - y0 + 1);
      out.getContext("2d")!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      return new Promise((resolve) =>
        out.toBlob((b) => resolve(b ? new File([b], name, { type: "image/png" }) : null), "image/png")
      );
    },
  }));

  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmptyState(false);
  };

  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="drawpad"
      aria-label="Drawing area"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
    />
  );
});
