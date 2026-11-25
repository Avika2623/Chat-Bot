export function Starfield({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="cosmic-backdrop" aria-hidden="true">
      <div
        className="star-layer star-layer-far"
        style={reducedMotion ? { animation: 'none' } : undefined}
      />
      <div
        className="star-layer star-layer-near"
        style={reducedMotion ? { animation: 'none' } : undefined}
      />
    </div>
  );
}
