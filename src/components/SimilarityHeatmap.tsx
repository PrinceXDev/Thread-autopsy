"use client";

import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HeatmapCell {
  x: number;
  y: number;
  similarity: number;
}

interface SimilarityHeatmapProps {
  matrix: number[][];
}

function cellColor(similarity: number, isDiagonal: boolean): string {
  if (isDiagonal) return "#1a1a1a";
  return `rgba(255, 68, 68, ${similarity * 0.9})`;
}

export default function SimilarityHeatmap({ matrix }: SimilarityHeatmapProps) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);
  const n = matrix.length;

  const data = useMemo(() => {
    const cells: HeatmapCell[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        cells.push({ x: i + 1, y: n - j, similarity: matrix[i][j] });
      }
    }
    return cells;
  }, [matrix, n]);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={Math.max(320, n * 28 + 80)}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
          <XAxis
            type="number"
            dataKey="x"
            name="Tweet"
            domain={[0.5, n + 0.5]}
            ticks={Array.from({ length: n }, (_, i) => i + 1)}
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            tickLine={{ stroke: "#333" }}
            label={{
              value: "Tweet #",
              position: "bottom",
              fill: "#888",
              fontSize: 12,
              offset: 0,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Tweet"
            domain={[0.5, n + 0.5]}
            ticks={Array.from({ length: n }, (_, i) => i + 1)}
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            tickLine={{ stroke: "#333" }}
            label={{
              value: "Tweet #",
              angle: -90,
              position: "insideLeft",
              fill: "#888",
              fontSize: 12,
            }}
          />
          <ZAxis type="number" dataKey="similarity" range={[0, 400]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "#666" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const cell = payload[0].payload as HeatmapCell;
              const row = n - cell.y;
              const col = cell.x - 1;
              if (row === col) return null;
              return (
                <div className="bg-bg-elevated border border-border px-3 py-2 rounded-lg text-xs shadow-lg">
                  Tweet {col + 1} ↔ {row + 1}:{" "}
                  <span className="text-accent-red font-semibold">
                    {Math.round(cell.similarity * 100)}%
                  </span>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            shape={(props) => {
              const { cx, cy, payload } = props as {
                cx?: number;
                cy?: number;
                payload?: HeatmapCell;
              };
              if (cx == null || cy == null || !payload) return <g />;
              const row = n - payload.y;
              const col = payload.x - 1;
              const isDiagonal = row === col;
              const size = Math.min(22, Math.max(14, 280 / n));
              const isHovered =
                hovered?.x === payload.x && hovered?.y === payload.y;

              return (
                <rect
                  x={cx - size / 2}
                  y={cy - size / 2}
                  width={size}
                  height={size}
                  rx={2}
                  fill={cellColor(payload.similarity, isDiagonal)}
                  stroke={isHovered ? "#fff" : "transparent"}
                  strokeWidth={isHovered ? 2 : 0}
                  onMouseEnter={() => setHovered(payload)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: isDiagonal ? "default" : "pointer" }}
                />
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>

      {hovered && hovered.x - 1 !== n - hovered.y && (
        <p className="text-center text-sm text-text-secondary mt-2">
          Tweet {hovered.x - 1} ↔ {n - hovered.y}:{" "}
          <span className="text-accent-red font-semibold">
            {Math.round(hovered.similarity * 100)}% similar
          </span>
        </p>
      )}

      <div className="flex items-center gap-3 mt-4 text-xs text-text-secondary justify-center">
        <span>0%</span>
        <div className="flex h-3 flex-1 max-w-[200px] rounded overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1"
              style={{
                backgroundColor: `rgba(255, 68, 68, ${(i / 20) * 0.9})`,
              }}
            />
          ))}
        </div>
        <span>100%</span>
      </div>
    </div>
  );
}
