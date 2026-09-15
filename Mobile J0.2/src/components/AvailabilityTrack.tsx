import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { haptic } from "../lib/telegram";

const KNOB = 44;
const PAD = 4;
const FALLBACK_WIDTH = 274;

export function AvailabilityTrack() {
  const { availability, setAvailability } = useApp();
  const trackRef = useRef<HTMLDivElement>(null);
  const [innerWidth, setInnerWidth] = useState(FALLBACK_WIDTH);
  const [drag, setDrag] = useState<{ startX: number; x: number; origin: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setInnerWidth(el.clientWidth - PAD * 2 - KNOB);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const restX = availability.available ? innerWidth : 0;
  const knobX = drag ? Math.max(0, Math.min(innerWidth, drag.x)) : restX;

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ startX: e.clientX, x: restX, origin: restX, moved: false });
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    setDrag({ ...drag, x: drag.origin + dx, moved: drag.moved || Math.abs(dx) > 4 });
  };
  const onUp = () => {
    if (!drag) return;
    const next = !drag.moved ? !availability.available : knobX > innerWidth / 2;
    setDrag(null);
    if (next !== availability.available) {
      haptic("selection");
      void setAvailability(next);
    }
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{
        position: "relative",
        height: 52,
        borderRadius: 999,
        background: "var(--color-surface)",
        touchAction: "none",
        cursor: "grab",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--color-neutral-500)",
          pointerEvents: "none",
        }}
      >
        <span>Off</span>
        <span>On</span>
      </div>
      <div
        style={{
          position: "absolute",
          top: PAD,
          left: PAD,
          width: KNOB,
          height: KNOB,
          borderRadius: 999,
          background: availability.available || drag ? "var(--color-accent)" : "var(--color-neutral-400)",
          boxShadow: "var(--shadow-sm)",
          transform: `translateX(${knobX}px)`,
          transition: drag ? "none" : "transform .22s cubic-bezier(.2,.8,.2,1), background .2s",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
