import { findGardenArea, MAX_GARDEN, PRESETS, simulate, STEP_MINUTES } from './model.js';

const byId = (id) => document.getElementById(id);
const form = byId('scenario');
const inputs = [...form.querySelectorAll('input, select')];
const presetButtons = [...document.querySelectorAll('[data-preset]')];
const chartButtons = [...document.querySelectorAll('[data-chart]')];
const canvas = byId('chart');
const target = byId('target');
const dialog = byId('method');
const integer = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const liters = (value) => `${integer.format(value)} L`;
const percent = (value) => `${decimal.format(value * 100)}%`;
const elapsed = (minutes) => `${minutes} min`;
let currentPreset = 'school';
let currentScenario = { ...PRESETS.school };
let result = simulate(currentScenario);
let proposedArea = null;
let chartMode = 'drain';

function setPressed(buttons, key, selection) {
  buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset[key] === selection)));
}

function loadPreset(key) {
  for (const input of inputs) input.value = PRESETS[key][input.name];
  currentPreset = key;
  update();
}

function readScenario() {
  const invalid = inputs.find((input) => !input.validity.valid);
  for (const input of inputs) input.setAttribute('aria-invalid', String(!input.validity.valid));
  const notice = byId('validation');
  notice.hidden = !invalid;
  if (invalid) {
    const label = invalid.closest('label').firstChild.textContent.trim();
    notice.textContent = `${label} must be between ${invalid.min} and ${invalid.max} in steps of ${invalid.step}. Showing the last valid scenario.`;
    return null;
  }
  return Object.fromEntries(inputs.map((input) => [input.name, input.name === 'pattern' ? input.value : Number(input.value)]));
}

function renderOutcome() {
  const { runoff, overflow, capture, infiltrated, stored, firstOverflow } = result;
  byId('scenario-name').textContent = currentPreset ? currentPreset.toUpperCase() : 'CUSTOM';
  byId('summary').textContent = runoff > 0
    ? `${decimal.format(currentScenario.rain)} mm of rain over ${elapsed(result.duration)}.`
    : 'No runoff for these inputs. Increase rainfall or catchment area.';
  byId('runoff').textContent = liters(runoff);
  byId('capture').textContent = runoff > 0 ? percent(capture) : '—';
  byId('captured-volume').textContent = `${liters(infiltrated + stored)} kept from the drain`;
  byId('overflow').textContent = liters(overflow);
  byId('overflow-time').textContent = firstOverflow === null ? 'No overflow' : `First overflow by ${elapsed(firstOverflow)}`;
  const volumes = { infiltrated, stored, spill: overflow };
  for (const [key, value] of Object.entries(volumes)) {
    byId(`${key}-total`).textContent = liters(value);
    byId('balance').querySelector(`.${key}`).style.width = runoff > 0 ? `${value / runoff * 100}%` : '0%';
  }
  byId('announcement').textContent = runoff > 0
    ? `${percent(capture)} of runoff captured. ${liters(overflow)} discharged.`
    : 'No runoff for these inputs.';
}

function renderPlanner() {
  proposedArea = findGardenArea(currentScenario, Number(target.value));
  byId('suggestion').textContent = proposedArea === null ? '—' : `${integer.format(proposedArea)} m²`;
  byId('use-area').disabled = proposedArea === null || proposedArea === currentScenario.area || !form.matches(':valid');
  const note = byId('plan-note');
  if (result.runoff === 0) {
    note.textContent = 'Add runoff to estimate an area.';
    return;
  }
  if (proposedArea === null) {
    note.textContent = `Target exceeds what the model can capture with up to ${MAX_GARDEN} m².`;
    return;
  }
  note.textContent = proposedArea === currentScenario.area
    ? 'The current garden already matches this modeled area.'
    : `Based on ${currentScenario.depth} mm of ponding and ${decimal.format(currentScenario.soil)} mm/h of infiltration.`;
}

function renderTable() {
  const rows = result.rows.map(({ end, rainMm, runoff, overflow, stored, infiltrated }) => {
    const row = document.createElement('tr');
    for (const value of [end, rainMm, runoff, overflow, stored, infiltrated]) {
      const cell = row.insertCell();
      cell.textContent = decimal.format(value);
    }
    return row;
  });
  byId('intervals').replaceChildren(...rows);
}

function downloadCsv() {
  const header = 'minute,rain_mm,baseline_l,overflow_l,stored_l,infiltrated_l,garden_area_m2,ponding_depth_mm,soil_rate_mm_h,roof_m2,pavement_m2,storm_pattern';
  const { area, depth, soil, roof, paving, pattern } = currentScenario;
  const rows = result.rows.map(({ end, rainMm, runoff, overflow, stored, infiltrated }) => [
    end, ...[rainMm, runoff, overflow, stored, infiltrated].map((value) => value.toFixed(6)), area, depth, soil, roof, paving, pattern,
  ].join(','));
  const url = URL.createObjectURL(new Blob([[header, ...rows].join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'catchment-lab-storm.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function chartScale(maximum) {
  const step = Math.max(1, maximum / 4);
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const increment = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= step) * magnitude;
  return { increment, top: Math.ceil(Math.max(maximum, 1) / increment) * increment };
}

function drawChart() {
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const density = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * density);
  canvas.height = Math.round(height * density);
  const ctx = canvas.getContext('2d');
  ctx.scale(density, density);
  const storageView = chartMode === 'storage';
  const { rows, capacity, duration } = result;
  const largest = storageView ? capacity : Math.max(...rows.map((row) => row.runoff));
  const { increment, top } = chartScale(largest);
  const left = width < 420 ? 42 : 56;
  const right = width - 11;
  const bottom = height - 24;
  const y = (value) => bottom - value / top * (bottom - 13);
  const x = (minute) => left + minute / duration * (right - left);
  ctx.font = '11px Segoe UI, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let tick = 0; tick <= top + increment / 100; tick += increment) {
    ctx.fillStyle = '#4f655e';
    ctx.fillText(tick >= 1000 ? `${decimal.format(tick / 1000)}k` : decimal.format(tick), left - 8, y(tick));
    ctx.strokeStyle = '#dbe3d8';
    ctx.beginPath();
    ctx.moveTo(left, y(tick));
    ctx.lineTo(right, y(tick));
    ctx.stroke();
  }
  ctx.fillStyle = '#4f655e';
  ctx.fillText('L', 13, 11);
  const divisions = width < 420 ? 3 : 6;
  for (let i = 0; i <= divisions; i++) {
    ctx.textAlign = i === divisions ? 'right' : i === 0 ? 'left' : 'center';
    ctx.fillText(`${duration * i / divisions}${i === divisions ? ' min' : ''}`, x(duration * i / divisions), height - 9);
  }

  if (!storageView) {
    const barWidth = Math.max(1, (right - left) / rows.length - 2);
    for (const { end, runoff, overflow } of rows) {
      const start = x(end - STEP_MINUTES) + 1;
      ctx.fillStyle = '#5b7974';
      ctx.fillRect(start, y(runoff), barWidth, bottom - y(runoff));
      ctx.fillStyle = '#ad5440';
      ctx.fillRect(start + (barWidth >= 4 ? 2 : 0), y(overflow), Math.max(1, barWidth - 4), bottom - y(overflow));
    }
    return;
  }

  function traceStorage() {
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    for (const { end, stored } of rows) ctx.lineTo(x(end), y(stored));
  }

  traceStorage();
  ctx.lineTo(right, bottom);
  ctx.closePath();
  ctx.fillStyle = '#dbeab9';
  ctx.fill();
  traceStorage();
  ctx.strokeStyle = '#277562';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#49604d';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(left, y(capacity));
  ctx.lineTo(right, y(capacity));
  ctx.stroke();
}

function selectChart(mode) {
  chartMode = mode;
  setPressed(chartButtons, 'chart', mode);
  byId('chart-title').textContent = mode === 'storage' ? 'Garden storage over time' : 'Runoff over time';
  byId('chart-subtitle').textContent = mode === 'storage'
    ? `Water stored at the end of each interval. Capacity ${liters(result.capacity)}.`
    : 'Runoff routed to the drain per 5-minute interval.';
  const legend = byId('chart-legend');
  legend.innerHTML = mode === 'storage'
    ? '<li><i class="infiltrated"></i> Stored water</li><li><i class="baseline"></i> Capacity (dashed)</li>'
    : '<li><i class="baseline"></i> Without garden</li><li><i class="spill"></i> With garden</li>';
  drawChart();
}

function update() {
  const scenario = readScenario();
  if (!scenario) {
    byId('use-area').disabled = true;
    return;
  }
  currentScenario = scenario;
  result = simulate(scenario);
  setPressed(presetButtons, 'preset', currentPreset);
  renderOutcome();
  renderPlanner();
  renderTable();
  selectChart(chartMode);
}

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', () => {
  currentPreset = null;
  update();
});
presetButtons.forEach((button) => button.addEventListener('click', () => loadPreset(button.dataset.preset)));
chartButtons.forEach((button) => button.addEventListener('click', () => selectChart(button.dataset.chart)));
byId('load-demo').addEventListener('click', () => {
  loadPreset('school');
  selectChart('drain');
  byId('lab').focus();
  byId('lab').scrollIntoView({ block: 'start' });
});
target.addEventListener('change', renderPlanner);
byId('use-area').addEventListener('click', () => {
  form.elements.area.value = proposedArea;
  currentPreset = null;
  update();
  target.focus();
});
byId('export').addEventListener('click', downloadCsv);
byId('open-method').addEventListener('click', () => dialog.showModal());
new ResizeObserver(drawChart).observe(canvas);
loadPreset('school');
