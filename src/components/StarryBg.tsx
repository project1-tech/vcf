// Cream theme — soft warm radial backdrop instead of starfield.
export function StarryBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.06_65/0.6),_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_oklch(0.9_0.05_80/0.5),_transparent_60%)]" />
    </div>
  );
}
