const COLORS = [
  "#C7F000",
  "#E8B547",
  "#5B7BD5",
  "#16845B",
  "#8FA0CC",
  "#C83C48",
];

export function Spark({
  data,
  height = 230,
  up = true,
}: {
  data: number[];
  height?: number;
  up?: boolean;
}) {
  if (data.length < 2) return null;
  const width = 640;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const sx = width / (data.length - 1);
  const sy = (v: number) =>
    height - 4 - ((v - min) / (max - min || 1)) * (height - 8);
  const path = data
    .map((v, i) => `${i ? "L" : "M"}${(i * sx).toFixed(1)} ${sy(v).toFixed(1)}`)
    .join("");
  const color = up ? "#16845B" : "#C83C48";
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Illustrative price chart, ${up ? "up" : "down"} over the period`}
    >
      <path
        d={`${path}L${width} ${height}L0 ${height}Z`}
        fill={color}
        opacity={0.12}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Donut({
  items,
}: {
  items: { label: string; value: number }[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const R = 60;
  const r = 38;
  const c = 75;
  const pt = (radius: number, angle: number) =>
    `${c + radius * Math.cos(angle)} ${c + radius * Math.sin(angle)}`;
  const starts = items.map(
    (_, index) =>
      -Math.PI / 2 +
      (items.slice(0, index).reduce((sum, item) => sum + item.value, 0) /
        total) *
        2 *
        Math.PI,
  );
  const slices = items.map((item, index) => {
    const share = item.value / total;
    const start = starts[index];
    const end = start + share * 2 * Math.PI;
    const large = share > 0.5 ? 1 : 0;
    const color = COLORS[index % COLORS.length];
    const node =
      share > 0.9999 ? (
        <circle
          key={item.label}
          cx={c}
          cy={c}
          r={49}
          fill="none"
          stroke={color}
          strokeWidth={22}
        />
      ) : share > 0 ? (
        <path
          key={item.label}
          d={`M${pt(R, start)}A${R} ${R} 0 ${large} 1 ${pt(R, end)}L${pt(r, end)}A${r} ${r} 0 ${large} 0 ${pt(r, start)}Z`}
          fill={color}
        />
      ) : null;
    return node;
  });
  return (
    <div className="row" style={{ gap: 18 }}>
      <svg
        width="150"
        height="150"
        viewBox="0 0 150 150"
        role="img"
        aria-label="Allocation"
      >
        {slices}
      </svg>
      <div className="sm">
        {items.map((item, index) => (
          <div key={item.label}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 3,
                background: COLORS[index % COLORS.length],
                marginRight: 6,
              }}
            />
            {item.label} {((item.value / total) * 100).toFixed(1)}%
          </div>
        ))}
      </div>
    </div>
  );
}

export function Bar({ used, max }: { used: number; max: number }) {
  return (
    <div className="bar" role="presentation">
      <i style={{ width: `${Math.min(100, (used / (max || 1)) * 100)}%` }} />
    </div>
  );
}
