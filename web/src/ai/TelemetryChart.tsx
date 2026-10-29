import React, { useMemo, useRef, useState } from 'react';
import { AISessionBoundary } from './aiTypes';
import { useContainerSize } from './useContainerWidth';

export interface TelemetrySeries {
  id: string;
  label: string;
  shortLabel?: string;
  color: string;
  values: (number | null)[];
  unit?: string;
  decimals?: number;
  dashed?: boolean;
  fillArea?: boolean;
  bandMin?: (number | null)[];
  bandMax?: (number | null)[];
  defaultHidden?: boolean;
}

export interface TelemetryReferenceLine {
  value: number;
  label: string;
  color: string;
  dashed?: boolean;
}

export interface TelemetryChartProps {
  id: string;
  title: string;
  subtitle?: string;
  episodes: number[];
  episodeMeta?: Array<{ army?: string; village?: string; stars?: number; pct?: number }>;
  series: TelemetrySeries[];
  smoothing: number;
  zoomRange: [number, number] | null;
  onZoomChange: (nextRange: [number, number] | null) => void;
  defaultFitY?: boolean;
  defaultYDomain?: [number, number];
  allowSplitLanes?: boolean;
  defaultSplitLanes?: boolean;
  referenceLines?: TelemetryReferenceLine[];
  sessionBoundaries?: AISessionBoundary[];
  headerExtra?: React.ReactNode;
  footerExtra?: React.ReactNode;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  minHeight?: number;
}

interface DownsampledBucket {
  ep: number;
  epStart: number;
  epEnd: number;
  origIdx: number;
  rawValues: Record<string, number | null>;
  smoothValues: Record<string, number | null>;
  minValues: Record<string, number | null>;
  maxValues: Record<string, number | null>;
}

function computeEMA(values: (number | null)[], weight: number): (number | null)[] {
  if (weight <= 0.001) return values;
  const alpha = Math.max(0.01, Math.min(0.99, 1 - weight));
  const out: (number | null)[] = new Array(values.length);
  let last: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined || Number.isNaN(v)) {
      out[i] = last;
      continue;
    }
    if (last === null) {
      last = v;
    } else {
      last = last * weight + v * alpha;
    }
    out[i] = last;
  }
  return out;
}

function computeNiceTicks(minVal: number, maxVal: number, maxTicks = 5): {
  domainMin: number;
  domainMax: number;
  ticks: number[];
} {
  let lo = minVal;
  let hi = maxVal;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return { domainMin: 0, domainMax: 100, ticks: [0, 25, 50, 75, 100] };
  }
  if (Math.abs(hi - lo) < 1e-6) {
    const pad = Math.max(0.5, Math.abs(hi) * 0.12 || 1);
    lo -= pad;
    hi += pad;
  }

  const rawRange = hi - lo;
  const roughStep = rawRange / Math.max(2, maxTicks - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, roughStep))));
  const residual = roughStep / mag;

  let niceMultiple = 1;
  if (residual > 5) niceMultiple = 10;
  else if (residual > 2.5) niceMultiple = 5;
  else if (residual > 2) niceMultiple = 2.5;
  else if (residual > 1) niceMultiple = 2;

  const step = niceMultiple * mag;
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  const count = Math.min(8, Math.round((niceMax - niceMin) / step) + 1);
  for (let i = 0; i < count; i++) {
    const t = Number((niceMin + i * step).toPrecision(10));
    ticks.push(t);
  }
  return {
    domainMin: ticks[0] ?? lo,
    domainMax: ticks[ticks.length - 1] ?? hi,
    ticks,
  };
}

function formatTickValue(v: number, decimals = 1, unit = ''): string {
  if (Math.abs(v) >= 1000) {
    return `${(v / 1000).toFixed(1)}k${unit}`;
  }
  if (Math.abs(v) < 0.0001 && v !== 0) {
    return `${v.toExponential(1)}${unit}`;
  }
  if (Number.isInteger(v) && decimals <= 2) {
    return `${v}${unit}`;
  }
  return `${v.toFixed(decimals)}${unit}`;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  title,
  subtitle,
  episodes,
  episodeMeta,
  series,
  smoothing,
  zoomRange,
  onZoomChange,
  defaultFitY = true,
  defaultYDomain,
  allowSplitLanes = false,
  defaultSplitLanes = false,
  referenceLines = [],
  sessionBoundaries = [],
  headerExtra,
  footerExtra,
  isExpanded = false,
  onToggleExpand,
  minHeight = 250,
}) => {
  const [fitY, setFitY] = useState<boolean>(defaultFitY);
  const [splitLanes, setSplitLanes] = useState<boolean>(defaultSplitLanes);
  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of series) {
      if (s.defaultHidden) init[s.id] = true;
    }
    return init;
  });

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [dragStartFrac, setDragStartFrac] = useState<number | null>(null);
  const [dragCurrFrac, setDragCurrFrac] = useState<number | null>(null);

  const targetHeight = isExpanded ? Math.max(360, minHeight + 110) : minHeight;
  const [containerRef, svgWidth, svgHeight] = useContainerSize<HTMLDivElement>(
    560,
    targetHeight
  );
  const svgRef = useRef<SVGSVGElement | null>(null);

  const visibleSeries = useMemo(() => {
    const filtered = series.filter((s) => !hiddenIds[s.id]);
    return filtered.length > 0 ? filtered : series.slice(0, 1);
  }, [series, hiddenIds]);

  // Precompute EMA across the full episode array so zooming has zero boundary artifacts
  const fullSmoothedMap = useMemo(() => {
    const map: Record<string, (number | null)[]> = {};
    for (const s of series) {
      map[s.id] = computeEMA(s.values, smoothing);
    }
    return map;
  }, [series, smoothing]);

  // Slice to zoomRange and downsample to <= 260 buckets for crisp 60fps rendering
  const buckets = useMemo<DownsampledBucket[]>(() => {
    const n = episodes.length;
    if (n === 0) return [];

    let startIdx = 0;
    let endIdx = n - 1;
    if (zoomRange) {
      const [zMin, zMax] = zoomRange;
      const sFound = episodes.findIndex((ep) => ep >= zMin);
      startIdx = sFound >= 0 ? sFound : 0;
      let eFound = n - 1;
      for (let i = n - 1; i >= startIdx; i--) {
        if (episodes[i] <= zMax) {
          eFound = i;
          break;
        }
      }
      endIdx = Math.max(startIdx, eFound);
    }

    const sliceLen = endIdx - startIdx + 1;
    const maxPts = isExpanded ? 360 : 220;
    const binSize = Math.max(1, Math.ceil(sliceLen / maxPts));
    const result: DownsampledBucket[] = [];

    for (let i = startIdx; i <= endIdx; i += binSize) {
      const bEnd = Math.min(endIdx, i + binSize - 1);
      const midIdx = Math.floor((i + bEnd) / 2);

      const rawValues: Record<string, number | null> = {};
      const smoothValues: Record<string, number | null> = {};
      const minValues: Record<string, number | null> = {};
      const maxValues: Record<string, number | null> = {};

      for (const s of series) {
        const smArr = fullSmoothedMap[s.id] ?? s.values;
        let rawSum = 0;
        let rawCnt = 0;
        let smSum = 0;
        let smCnt = 0;
        let localMin = Infinity;
        let localMax = -Infinity;

        for (let k = i; k <= bEnd; k++) {
          const rv = s.values[k];
          const sv = smArr[k];
          if (rv !== null && rv !== undefined && !Number.isNaN(rv)) {
            rawSum += rv;
            rawCnt++;
            if (rv < localMin) localMin = rv;
            if (rv > localMax) localMax = rv;
          }
          if (sv !== null && sv !== undefined && !Number.isNaN(sv)) {
            smSum += sv;
            smCnt++;
          }
          if (s.bandMin?.[k] != null && s.bandMin[k]! < localMin) {
            localMin = s.bandMin[k]!;
          }
          if (s.bandMax?.[k] != null && s.bandMax[k]! > localMax) {
            localMax = s.bandMax[k]!;
          }
        }

        rawValues[s.id] = rawCnt > 0 ? rawSum / rawCnt : null;
        smoothValues[s.id] = smCnt > 0 ? smSum / smCnt : null;
        minValues[s.id] = localMin !== Infinity ? localMin : null;
        maxValues[s.id] = localMax !== -Infinity ? localMax : null;
      }

      result.push({
        ep: episodes[bEnd],
        epStart: episodes[i],
        epEnd: episodes[bEnd],
        origIdx: midIdx,
        rawValues,
        smoothValues,
        minValues,
        maxValues,
      });
    }

    return result;
  }, [episodes, series, fullSmoothedMap, zoomRange, isExpanded]);

  const padL = 48;
  const padR = 14;
  const padT = 14;
  const padB = 24;
  const plotW = Math.max(80, svgWidth - padL - padR);
  const plotH = Math.max(60, svgHeight - padT - padB);

  const computeDomainForSeriesList = (targetSeries: TelemetrySeries[]) => {
    if (!fitY && defaultYDomain) {
      return computeNiceTicks(defaultYDomain[0], defaultYDomain[1], 5);
    }
    let minV = Infinity;
    let maxV = -Infinity;

    for (const b of buckets) {
      for (const s of targetSeries) {
        const sv = b.smoothValues[s.id];
        const rv = b.rawValues[s.id];
        if (sv !== null && sv !== undefined) {
          if (sv < minV) minV = sv;
          if (sv > maxV) maxV = sv;
        }
        if (rv !== null && rv !== undefined) {
          // Include raw excursions with gentle weight so extreme single-step spikes don't crush the EMA curve
          const blendedMin = sv !== null ? sv * 0.35 + rv * 0.65 : rv;
          const blendedMax = sv !== null ? sv * 0.35 + rv * 0.65 : rv;
          if (blendedMin < minV) minV = blendedMin;
          if (blendedMax > maxV) maxV = blendedMax;
        }
      }
    }

    for (const ref of referenceLines) {
      if (ref.value < minV) minV = ref.value;
      if (ref.value > maxV) maxV = ref.value;
    }

    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) {
      const [d0, d1] = defaultYDomain ?? [0, 100];
      return computeNiceTicks(d0, d1, 5);
    }

    const span = Math.max(1e-5, maxV - minV);
    let paddedMin = minV - span * 0.06;
    let paddedMax = maxV + span * 0.06;

    if (defaultYDomain) {
      if (minV >= 0 && defaultYDomain[0] === 0 && paddedMin < 0) {
        paddedMin = 0;
      }
      if (defaultYDomain[1] === 100 && maxV <= 100 && paddedMax > 100) {
        paddedMax = 100;
      }
    }

    return computeNiceTicks(paddedMin, paddedMax, svgHeight > 290 ? 6 : 5);
  };

  const sharedAxis = useMemo(
    () => computeDomainForSeriesList(visibleSeries),
    [buckets, visibleSeries, fitY, defaultYDomain, svgHeight, referenceLines]
  );

  const clientXToFrac = (clientX: number): number => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const relX = clientX - rect.left - padL;
    return Math.max(0, Math.min(1, relX / Math.max(1, plotW)));
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0 || buckets.length < 2) return;
    const frac = clientXToFrac(e.clientX);
    setDragStartFrac(frac);
    setDragCurrFrac(frac);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (buckets.length === 0) return;
    const frac = clientXToFrac(e.clientX);
    if (dragStartFrac !== null) {
      setDragCurrFrac(frac);
    }
    const idx = Math.min(
      buckets.length - 1,
      Math.max(0, Math.round(frac * (buckets.length - 1)))
    );
    setHoverIdx(idx);
  };

  const handleMouseUp = () => {
    if (dragStartFrac !== null && dragCurrFrac !== null && buckets.length >= 2) {
      const f0 = Math.min(dragStartFrac, dragCurrFrac);
      const f1 = Math.max(dragStartFrac, dragCurrFrac);
      if ((f1 - f0) * plotW > 8) {
        const i0 = Math.max(0, Math.floor(f0 * (buckets.length - 1)));
        const i1 = Math.min(buckets.length - 1, Math.ceil(f1 * (buckets.length - 1)));
        const ep0 = buckets[i0].epStart;
        const ep1 = buckets[i1].epEnd;
        if (ep1 > ep0) {
          onZoomChange([ep0, ep1]);
        }
      }
    }
    setDragStartFrac(null);
    setDragCurrFrac(null);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (episodes.length < 6) return;
    if (!e.shiftKey && zoomRange === null) return;
    e.preventDefault();
    const fullMin = episodes[0];
    const fullMax = episodes[episodes.length - 1];
    const [curMin, curMax] = zoomRange ?? [fullMin, fullMax];
    const span = Math.max(4, curMax - curMin);
    const frac = clientXToFrac(e.clientX);
    const centerEp = curMin + frac * span;
    const factor = e.deltaY < 0 ? 0.75 : 1.35;
    const newSpan = Math.min(fullMax - fullMin, Math.max(5, Math.round(span * factor)));
    if (newSpan >= fullMax - fullMin) {
      onZoomChange(null);
      return;
    }
    let nextMin = Math.round(centerEp - frac * newSpan);
    let nextMax = nextMin + newSpan;
    if (nextMin < fullMin) {
      nextMin = fullMin;
      nextMax = Math.min(fullMax, fullMin + newSpan);
    }
    if (nextMax > fullMax) {
      nextMax = fullMax;
      nextMin = Math.max(fullMin, fullMax - newSpan);
    }
    onZoomChange([nextMin, nextMax]);
  };

  const toggleSeries = (id: string) => {
    setHiddenIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const remaining = series.filter((s) => !next[s.id]);
      if (remaining.length === 0) return prev;
      return next;
    });
  };

  const buildPolyline = (
    vals: (number | null)[],
    yMin: number,
    yMax: number,
    laneTop: number,
    laneHeight: number
  ): string => {
    if (vals.length === 0) return '';
    const span = Math.max(1e-6, yMax - yMin);
    const pts: string[] = [];
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      const x =
        vals.length === 1
          ? padL + plotW / 2
          : padL + (i / (vals.length - 1)) * plotW;
      const norm = Math.max(0, Math.min(1, (v - yMin) / span));
      const y = laneTop + laneHeight - norm * laneHeight;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const buildAreaPolygon = (
    vals: (number | null)[],
    yMin: number,
    yMax: number,
    laneTop: number,
    laneHeight: number
  ): string => {
    const linePts = buildPolyline(vals, yMin, yMax, laneTop, laneHeight);
    if (!linePts) return '';
    const baselineY = (laneTop + laneHeight).toFixed(1);
    const firstX = vals.length === 1 ? (padL + plotW / 2).toFixed(1) : padL.toFixed(1);
    const lastX =
      vals.length === 1
        ? (padL + plotW / 2).toFixed(1)
        : (padL + plotW).toFixed(1);
    return `${firstX},${baselineY} ${linePts} ${lastX},${baselineY}`;
  };

  const buildBandPts = (
    mins: (number | null)[],
    maxs: (number | null)[],
    yMin: number,
    yMax: number,
    laneTop: number,
    laneHeight: number
  ): string => {
    if (mins.length < 2) return '';
    const span = Math.max(1e-6, yMax - yMin);
    const top: string[] = [];
    const bot: string[] = [];
    for (let i = 0; i < mins.length; i++) {
      const lo = mins[i];
      const hi = maxs[i];
      if (lo === null || hi === null) continue;
      const x = padL + (i / (mins.length - 1)) * plotW;
      const nHi = Math.max(0, Math.min(1, (hi - yMin) / span));
      const nLo = Math.max(0, Math.min(1, (lo - yMin) / span));
      top.push(`${x.toFixed(1)},${(laneTop + laneHeight - nHi * laneHeight).toFixed(1)}`);
      bot.unshift(`${x.toFixed(1)},${(laneTop + laneHeight - nLo * laneHeight).toFixed(1)}`);
    }
    return [...top, ...bot].join(' ');
  };

  const hoveredBucket = hoverIdx !== null ? buckets[hoverIdx] ?? null : null;
  const hoveredMeta =
    hoveredBucket && episodeMeta ? episodeMeta[hoveredBucket.origIdx] : undefined;

  const isMultiLane = allowSplitLanes && splitLanes && visibleSeries.length > 1;

  return (
    <section
      className={`tb-chart-card ${isExpanded ? 'tb-chart-expanded' : ''}`}
      style={{ minHeight: targetHeight + 62 }}
    >
      <div className="tb-chart-header">
        <div className="tb-chart-title-wrap">
          <h4>{title}</h4>
          {subtitle && <span className="tb-chart-subtitle">{subtitle}</span>}
        </div>

        <div className="tb-chart-controls">
          {headerExtra}

          {allowSplitLanes && visibleSeries.length > 1 && (
            <button
              type="button"
              className={`tb-mini-btn ${splitLanes ? 'active' : ''}`}
              onClick={() => setSplitLanes((v) => !v)}
              title="Split each contribution into its own auto-scaled horizontal track or overlay them"
            >
              {splitLanes ? '☰ Split Lanes' : '重ね Overlay'}
            </button>
          )}

          <button
            type="button"
            className={`tb-mini-btn ${fitY ? 'active' : ''}`}
            onClick={() => setFitY((v) => !v)}
            title="Toggle automatic Y-axis data fitting vs full baseline range"
          >
            {fitY ? '↕ Fit Data' : '↕ Full Scale'}
          </button>

          {zoomRange && (
            <button
              type="button"
              className="tb-mini-btn zoom-reset"
              onClick={() => onZoomChange(null)}
              title="Reset zoom (or double-click chart)"
            >
              🔍 Ep {zoomRange[0]}–{zoomRange[1]} ✕
            </button>
          )}

          {onToggleExpand && (
            <button
              type="button"
              className={`tb-mini-btn ${isExpanded ? 'active' : ''}`}
              onClick={onToggleExpand}
              title={isExpanded ? 'Restore standard grid size' : 'Expand chart to full width'}
            >
              {isExpanded ? '⤡ Compact' : '⤢ Expand'}
            </button>
          )}
        </div>
      </div>

      {/* Interactive Series Toggle Bar */}
      <div className="tb-series-pills">
        {series.map((s) => {
          const isHidden = Boolean(hiddenIds[s.id]);
          const latestVal =
            buckets.length > 0 ? buckets[buckets.length - 1].smoothValues[s.id] : null;
          return (
            <button
              key={s.id}
              type="button"
              className={`tb-series-pill ${isHidden ? 'muted' : 'active'}`}
              style={
                !isHidden
                  ? {
                      borderColor: `${s.color}88`,
                      background: `${s.color}14`,
                    }
                  : undefined
              }
              onClick={() => toggleSeries(s.id)}
              title="Click to toggle series visibility and re-fit Y-axis"
            >
              <i className="tb-series-dot" style={{ background: s.color }} />
              <span>{s.shortLabel ?? s.label}</span>
              {latestVal !== null && latestVal !== undefined && (
                <strong style={{ color: s.color }}>
                  {formatTickValue(latestVal, s.decimals ?? 1, s.unit ?? '')}
                </strong>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Responsive SVG Stage */}
      <div
        ref={containerRef}
        className="tb-svg-stage"
        style={{ height: targetHeight }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="tb-svg-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoverIdx(null);
            setDragStartFrac(null);
            setDragCurrFrac(null);
          }}
          onDoubleClick={() => onZoomChange(null)}
          onWheel={handleWheel}
        >
          {buckets.length === 0 ? (
            <text
              x={svgWidth / 2}
              y={svgHeight / 2}
              textAnchor="middle"
              fill="#64748b"
              fontSize="12"
            >
              No episode data in range
            </text>
          ) : isMultiLane ? (
            /* SPLIT HORIZONTAL LANES MODE (EACH CONTRIBUTION GETS ITS OWN AUTO-FITTED LANE) */
            <>
              {visibleSeries.map((s, laneIdx) => {
                const laneGap = 10;
                const availH = plotH - laneGap * (visibleSeries.length - 1);
                const laneH = Math.max(32, availH / visibleSeries.length);
                const laneTop = padT + laneIdx * (laneH + laneGap);
                const laneAxis = computeDomainForSeriesList([s]);
                const laneTicks = [
                  laneAxis.domainMin,
                  (laneAxis.domainMin + laneAxis.domainMax) / 2,
                  laneAxis.domainMax,
                ];

                const rawVals = buckets.map((b) => b.rawValues[s.id]);
                const smVals = buckets.map((b) => b.smoothValues[s.id]);

                return (
                  <g key={s.id}>
                    <rect
                      x={padL}
                      y={laneTop}
                      width={plotW}
                      height={laneH}
                      rx={4}
                      fill="#070d19"
                      stroke="#1e293b"
                      strokeWidth={1}
                    />
                    {laneTicks.map((tv, tIdx) => {
                      const norm =
                        (tv - laneAxis.domainMin) /
                        Math.max(1e-6, laneAxis.domainMax - laneAxis.domainMin);
                      const y = laneTop + laneH - norm * laneH;
                      return (
                        <g key={tIdx}>
                          <line
                            x1={padL}
                            y1={y}
                            x2={padL + plotW}
                            y2={y}
                            stroke="#1e293b"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={padL - 5}
                            y={y + 3}
                            textAnchor="end"
                            fill="#64748b"
                            fontSize="9"
                          >
                            {formatTickValue(tv, s.decimals ?? 1, s.unit ?? '')}
                          </text>
                        </g>
                      );
                    })}

                    <polygon
                      points={buildAreaPolygon(
                        smVals,
                        laneAxis.domainMin,
                        laneAxis.domainMax,
                        laneTop,
                        laneH
                      )}
                      fill={s.color}
                      fillOpacity={0.12}
                    />
                    {smoothing > 0.02 && (
                      <polyline
                        fill="none"
                        stroke={s.color}
                        strokeOpacity={0.25}
                        strokeWidth={1.1}
                        points={buildPolyline(
                          rawVals,
                          laneAxis.domainMin,
                          laneAxis.domainMax,
                          laneTop,
                          laneH
                        )}
                      />
                    )}
                    <polyline
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2.1}
                      points={buildPolyline(
                        smVals,
                        laneAxis.domainMin,
                        laneAxis.domainMax,
                        laneTop,
                        laneH
                      )}
                    />
                    <text
                      x={padL + 8}
                      y={laneTop + 13}
                      fill={s.color}
                      fontSize="9.5"
                      fontWeight={800}
                    >
                      {s.label}
                    </text>
                  </g>
                );
              })}
            </>
          ) : (
            /* UNIFIED OVERLAY MODE WITH AUTO-FIT Y-AXIS */
            <>
              {/* Y-Axis Gridlines & Nice Labels */}
              {sharedAxis.ticks.map((tv) => {
                const span = Math.max(1e-6, sharedAxis.domainMax - sharedAxis.domainMin);
                const norm = (tv - sharedAxis.domainMin) / span;
                if (norm < -0.02 || norm > 1.02) return null;
                const y = padT + plotH - norm * plotH;
                const primaryUnit = visibleSeries[0]?.unit ?? '';
                const primaryDec = visibleSeries[0]?.decimals ?? 1;
                return (
                  <g key={tv}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={padL + plotW}
                      y2={y}
                      stroke={tv === 0 ? '#334155' : '#162238'}
                      strokeDasharray={tv === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={padL - 6}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="9.5"
                    >
                      {formatTickValue(tv, primaryDec, primaryUnit)}
                    </text>
                  </g>
                );
              })}

              {/* Reference Threshold Lines (e.g., Target KL = 0.03) */}
              {referenceLines.map((ref) => {
                const span = Math.max(1e-6, sharedAxis.domainMax - sharedAxis.domainMin);
                const norm = (ref.value - sharedAxis.domainMin) / span;
                if (norm < 0 || norm > 1) return null;
                const y = padT + plotH - norm * plotH;
                return (
                  <g key={ref.label}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={padL + plotW}
                      y2={y}
                      stroke={ref.color}
                      strokeWidth={1.3}
                      strokeDasharray={ref.dashed !== false ? '5 3' : undefined}
                    />
                    <text
                      x={padL + plotW - 6}
                      y={y - 4}
                      textAnchor="end"
                      fill={ref.color}
                      fontSize="8.8"
                      fontWeight={700}
                    >
                      {ref.label}
                    </text>
                  </g>
                );
              })}

              {/* Resumed Session Boundary Vertical Lines */}
              {sessionBoundaries.map((sb) => {
                const firstEp = buckets[0].epStart;
                const lastEp = buckets[buckets.length - 1].epEnd;
                if (sb.start_ep <= firstEp || sb.start_ep >= lastEp) return null;
                const bIdx = buckets.findIndex((b) => b.epEnd >= sb.start_ep);
                if (bIdx < 0) return null;
                const x = padL + (bIdx / Math.max(1, buckets.length - 1)) * plotW;
                return (
                  <g key={`sb-${sb.session_id}-${sb.start_ep}`}>
                    <line
                      x1={x}
                      y1={padT}
                      x2={x}
                      y2={padT + plotH}
                      stroke="#38bdf8"
                      strokeWidth={1.4}
                      strokeDasharray="4 3"
                    />
                    <text
                      x={x + 4}
                      y={padT + 11}
                      fill="#38bdf8"
                      fontSize="8.5"
                      fontWeight={700}
                    >
                      ↻ Session #{sb.session_id} (Ep {sb.start_ep})
                    </text>
                  </g>
                );
              })}

              {/* Series Bands, Raw Traces, and Smoothed EMA Curves */}
              {visibleSeries.map((s) => {
                const rawVals = buckets.map((b) => b.rawValues[s.id]);
                const smVals = buckets.map((b) => b.smoothValues[s.id]);
                const minVals = buckets.map((b) => b.minValues[s.id]);
                const maxVals = buckets.map((b) => b.maxValues[s.id]);

                return (
                  <g key={s.id}>
                    {s.bandMin && s.bandMax && buckets.length > 1 && (
                      <polygon
                        fill={s.color}
                        fillOpacity={0.11}
                        points={buildBandPts(
                          minVals,
                          maxVals,
                          sharedAxis.domainMin,
                          sharedAxis.domainMax,
                          padT,
                          plotH
                        )}
                      />
                    )}
                    {s.fillArea && (
                      <polygon
                        fill={s.color}
                        fillOpacity={0.1}
                        points={buildAreaPolygon(
                          smVals,
                          sharedAxis.domainMin,
                          sharedAxis.domainMax,
                          padT,
                          plotH
                        )}
                      />
                    )}
                    {smoothing > 0.02 && (
                      <polyline
                        fill="none"
                        stroke={s.color}
                        strokeOpacity={0.22}
                        strokeWidth={1.15}
                        points={buildPolyline(
                          rawVals,
                          sharedAxis.domainMin,
                          sharedAxis.domainMax,
                          padT,
                          plotH
                        )}
                      />
                    )}
                    <polyline
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2.25}
                      strokeDasharray={s.dashed ? '5 3' : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={buildPolyline(
                        smVals,
                        sharedAxis.domainMin,
                        sharedAxis.domainMax,
                        padT,
                        plotH
                      )}
                    />
                  </g>
                );
              })}

              {/* Highlighted Dots on Hovered Episode */}
              {hoverIdx !== null &&
                hoveredBucket &&
                visibleSeries.map((s) => {
                  const v = hoveredBucket.smoothValues[s.id];
                  if (v === null || v === undefined) return null;
                  const x =
                    buckets.length === 1
                      ? padL + plotW / 2
                      : padL + (hoverIdx / (buckets.length - 1)) * plotW;
                  const span = Math.max(
                    1e-6,
                    sharedAxis.domainMax - sharedAxis.domainMin
                  );
                  const norm = Math.max(
                    0,
                    Math.min(1, (v - sharedAxis.domainMin) / span)
                  );
                  const y = padT + plotH - norm * plotH;
                  return (
                    <circle
                      key={`dot-${s.id}`}
                      cx={x}
                      cy={y}
                      r={4}
                      fill={s.color}
                      stroke="#0f172a"
                      strokeWidth={1.5}
                    />
                  );
                })}
            </>
          )}

          {/* X-Axis Episode Labels */}
          {buckets.length > 0 &&
            [0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
              const bIdx = Math.min(
                buckets.length - 1,
                Math.floor(frac * (buckets.length - 1))
              );
              const b = buckets[bIdx];
              const x = padL + frac * plotW;
              return (
                <text
                  key={idx}
                  x={x}
                  y={svgHeight - 6}
                  textAnchor={idx === 0 ? 'start' : idx === 4 ? 'end' : 'middle'}
                  fill="#64748b"
                  fontSize="9.5"
                >
                  Ep {b.ep}
                </text>
              );
            })}

          {/* Hover Vertical Crosshair Line */}
          {hoverIdx !== null && buckets.length > 0 && (
            <line
              x1={
                buckets.length === 1
                  ? padL + plotW / 2
                  : padL + (hoverIdx / (buckets.length - 1)) * plotW
              }
              y1={padT}
              x2={
                buckets.length === 1
                  ? padL + plotW / 2
                  : padL + (hoverIdx / (buckets.length - 1)) * plotW
              }
              y2={padT + plotH}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Drag-to-Zoom Brush Selection Box */}
          {dragStartFrac !== null && dragCurrFrac !== null && (
            <rect
              x={padL + Math.min(dragStartFrac, dragCurrFrac) * plotW}
              y={padT}
              width={Math.max(2, Math.abs(dragCurrFrac - dragStartFrac) * plotW)}
              height={plotH}
              fill="rgba(56, 189, 248, 0.18)"
              stroke="#38bdf8"
              strokeWidth={1.5}
            />
          )}
        </svg>

        {/* Floating Crosshair Readout Tooltip */}
        {hoverIdx !== null && hoveredBucket && dragStartFrac === null && (
          <div
            className="tb-hover-tooltip"
            style={
              hoverIdx > buckets.length * 0.55
                ? { left: padL + 10, right: 'auto' }
                : { right: 16, left: 'auto' }
            }
          >
            <div className="tb-tooltip-head">
              <strong>
                {hoveredBucket.epStart === hoveredBucket.epEnd
                  ? `Episode #${hoveredBucket.ep}`
                  : `Episodes ${hoveredBucket.epStart}–${hoveredBucket.epEnd}`}
              </strong>
              {hoveredMeta?.army && hoveredMeta?.village && (
                <span>
                  {hoveredMeta.army} vs {hoveredMeta.village}
                </span>
              )}
            </div>
            {visibleSeries.map((s) => {
              const sm = hoveredBucket.smoothValues[s.id];
              const rw = hoveredBucket.rawValues[s.id];
              if (sm === null && rw === null) return null;
              return (
                <div key={s.id} className="tb-tooltip-row">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <i className="tb-series-dot" style={{ background: s.color }} />
                    {s.shortLabel ?? s.label}
                  </span>
                  <span>
                    <strong style={{ color: s.color }}>
                      {sm !== null
                        ? formatTickValue(sm, s.decimals ?? 2, s.unit ?? '')
                        : '—'}
                    </strong>
                    {smoothing > 0.02 && rw !== null && (
                      <small style={{ color: '#64748b', marginLeft: 4 }}>
                        (raw {formatTickValue(rw, s.decimals ?? 2, s.unit ?? '')})
                      </small>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {footerExtra && <div className="tb-chart-footer">{footerExtra}</div>}
    </section>
  );
};
