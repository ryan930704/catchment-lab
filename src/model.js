export const STEP_MINUTES = 5;
export const MAX_GARDEN = 500;

export const PRESETS = {
  school: { roof: 400, paving: 240, rain: 42, duration: 120, pattern: 'peak', area: 85, depth: 120, soil: 16 },
  library: { roof: 240, paving: 100, rain: 32, duration: 90, pattern: 'steady', area: 45, depth: 100, soil: 24 },
  courtyard: { roof: 130, paving: 410, rain: 55, duration: 60, pattern: 'early', area: 70, depth: 120, soil: 35 },
};

const ROOF_COEFFICIENT = 0.95;
const PAVING_COEFFICIENT = 0.80;

function rainWeights(count, pattern) {
  return Array.from({ length: count }, (_, i) => {
    const position = (i + 0.5) / count;
    if (pattern === 'peak') return 0.15 + 1 - Math.abs(2 * position - 1);
    if (pattern === 'early') return 0.005 + Math.max(0, 1 - Math.abs(position - 0.18) / 0.40);
    return 1;
  });
}

export function simulate({ roof, paving, rain, duration, pattern, area, depth, soil }) {
  const count = duration / STEP_MINUTES;
  const weights = rainWeights(count, pattern);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const effectiveArea = roof * ROOF_COEFFICIENT + paving * PAVING_COEFFICIENT;
  const capacity = area * depth;
  const soilLimit = area * soil * STEP_MINUTES / 60;
  let stored = 0;
  let totalInfiltrated = 0;
  let totalOverflow = 0;
  let totalRunoff = 0;
  let firstOverflow = null;
  const rows = weights.map((weight, index) => {
    const end = (index + 1) * STEP_MINUTES;
    const rainMm = rain * weight / weightSum;
    const runoff = rainMm * effectiveArea;
    const available = stored + runoff;
    const infiltrated = Math.min(available, soilLimit);
    const overflow = Math.max(0, available - infiltrated - capacity);
    stored = Math.min(capacity, available - infiltrated);
    totalRunoff += runoff;
    totalInfiltrated += infiltrated;
    totalOverflow += overflow;
    if (overflow > 1e-8 && firstOverflow === null) firstOverflow = end;
    return { end, rainMm, runoff, infiltrated, stored, overflow };
  });
  return {
    rows, capacity, firstOverflow, duration,
    runoff: totalRunoff, infiltrated: totalInfiltrated, stored, overflow: totalOverflow,
    capture: totalRunoff > 0 ? Math.min(1, (totalInfiltrated + stored) / totalRunoff) : 0,
  };
}

export function findGardenArea(scenario, target) {
  if (simulate(scenario).runoff === 0) return null;
  const reaches = (area) => simulate({ ...scenario, area }).capture + 1e-10 >= target;
  if (!reaches(MAX_GARDEN)) return null;
  let low = 0;
  let high = MAX_GARDEN;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (reaches(mid)) high = mid;
    else low = mid + 1;
  }
  return low;
}
