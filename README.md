# Catchment Lab

Catchment Lab is a browser-based stormwater simulator for STEM classes, campus facilities teams, and students exploring rain gardens. Open the school demo to see how much roof and pavement runoff reaches a drain with and without a garden. Try the library and courtyard examples, change the rainfall pattern, or enter your own scenario. The tool shows capture, overflow timing, and end-of-storm storage, estimates the smallest modeled garden area for a capture target, and exports interval data as CSV.

## Run locally

From this `app` folder, with Node.js 22 or later:

```sh
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. Building and serving require only Node.js. For tests:

```sh
npm ci
npm test
npm run test:e2e
```

The browser test uses a local Chrome, Edge, or Playwright Chromium installation. Set `CHROMIUM_PATH` to a custom executable if needed, or run `npx playwright install chromium`. The test launches its own local server and writes 1920 × 1080 screenshots to `../shots`.

For Cloudflare Pages, publish `app/dist` as static assets. For repository-based builds, use `app` as the root directory, `npm run build` as the build command, and `dist` as the output directory. Keep the repository-root `LICENSE` alongside `app` so the build can copy it. No Functions, API keys, runtime packages, or user accounts are required to run the app.

## Model and technology

- Plain HTML, CSS, and native JavaScript modules run the simulation in the browser. Canvas renders the two charts. A native HTML table exposes the underlying data, and CSV export stays local.
- The model distributes the selected storm total over five-minute intervals. Runoff per interval is rainfall depth in mm times `0.95 × roof area + 0.80 × paved area` in m², giving liters. The coefficients are fixed illustrative assumptions. In each interval, water infiltrates up to the soil rate times area, then fills the ponding volume, with excess routed to the drain.
- Captured runoff includes water infiltrated during the storm and water still stored at storm end. A bounded binary search finds the smallest whole-square-meter area that reaches the specified target while holding the other inputs fixed.
- Each scenario starts with an empty basin. The model omits direct rainfall on the garden, soil saturation over time, travel lag, groundwater, drainage pipes, and underdrains. Preset sites and storm profiles are synthetic. Use this for scenario exploration and classroom discussion. Construction decisions require field measurements and qualified site review. [U.S. EPA rain garden background](https://www.epa.gov/soakuptherain/soak-rain-rain-gardens)

## AI disclosure and license

The solo entrant directed the project. OpenAI Codex, an AI coding agent, wrote the application code, tests, and copy under that direction. OpenAI image generation produced the illustrative rain garden image. The contest implementation, examples, and documentation were created during the November 2026 competition period. Playwright is development tooling.

The project source is available under the MIT License. See [`LICENSE`](../LICENSE).
