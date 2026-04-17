# MatMul Visualizer — Project Context for Claude Code

## What this is

An interactive 3D visualization of matrix multiplication using Three.js (r128). The goal is to help people doing Karpathy's *nn-zero-to-hero* course (and similar) develop deep geometric intuition for matrix multiplication — not just the algorithm, but the underlying structure that matters for understanding attention, backprop, and linear layers. The perspective of einsum notation should be a guiding thread throughout the application.

## Running locally

```bash
npm start          # serves on http://localhost:3000
# open http://localhost:3000/matmul-3d.html
```

ES modules require a local server — `file://` won't work due to CORS.

## Building for deployment

```bash
npm run build      # produces matrix.html (~717 KB)
```

`build.js` bundles everything into a single self-contained `matrix.html`:
- Bundles all ES modules into one minified IIFE via esbuild
- Fetches Three.js r128 from CDN and inlines it
- Minifies inline CSS
- No external dependencies — the output file works standalone

## File structure

```
matmul-3d.html          HTML + CSS (no inline JS)
js/
  shared.js             Global state (I,J,K, A,B,Cube,Res, labelA,labelB, buildComplete), dimensions, utilities, callback registry
  scene.js              Three.js scene, camera, custom orbit controls, render loop
  cube-manager.js       3D box mesh management, paint functions, plus planes
  presets.js            11 named matrix multiply examples (identity, row selection, one-hot lookup, etc.)
  einsum-spec.js        Einsum parser and tensor contraction engine
  embed-data.js         Embedding data generation (tokens, one-hots, gradients, forward/backward compute)
  tab-inner.js          Inner Product tab: a · b step-through (2D, Vector Operations tier)
  tab-intro.js          Outer Product tab: a ⊗ b broadcast animation (2D, Vector Operations tier)
  tab-matmul.js         Matrix Multiply: unified build (outer product / dot product toggle) + exploration + collapse (3D)
  tab-embed-fwd.js      Embedding Forward: btv,vc→btc row-selection visualization (2D, Embeddings tier)
  tab-embed-bwd.js      Embedding Backward: btv,btc→vc gradient accumulation (2D, Embeddings tier)
  app.js                Entry point: three-tier nav, preset system, mode switching, rebuild, einsum badge, window globals
package.json            Dev server (serve), test scripts
vitest.config.js        Vitest config (jsdom environment, excludes e2e/)
playwright.config.js    Playwright config (chromium, webServer on :3000)
tests/
  setup.js              DOM stubs, THREE.js mock, canvas mock
  shared.test.js        computeData correctness tests
  embed-data.test.js    Embedding data generation tests
  einsum-spec.test.js   Einsum parser and compute tests
  tab-inner.test.js     Inner product tab tests (step, resize, render)
  tab-intro.test.js     Outer product tab tests (double-play bug)
  tab-matmul.test.js    MatMul tab tests (highlight timer, build modes, exploration, hover)
  tab-embed-fwd.test.js Embedding forward tests (rendering, detail mode, tensors)
  tab-embed-bwd.test.js Embedding backward tests (accumulator, stepping)
  e2e/
    smoke.spec.js       Core smoke tests (page load, tabs, presets, build modes)
    presets.spec.js     Preset loading, switching, state reset, exploration
    qa-explore.spec.js  OP/DP step-through, exploration, collapse slider
    embed-fwd.spec.js   Embedding forward: pills, tensors, detail mode
build.js                Build script: bundles everything into a single matrix.html
.gitignore              node_modules/
DEVELOPER_GUIDE.md      Comprehensive developer reference (architecture, DOM IDs, adding tabs, etc.)
```

### Import graph (no circular dependencies)

```
shared.js        ← scene.js, cube-manager.js, presets.js, tab-inner.js, tab-intro.js, tab-matmul.js, tab-embed-fwd.js, tab-embed-bwd.js, app.js
scene.js         ← cube-manager.js, tab-matmul.js, app.js
cube-manager.js  ← tab-matmul.js, app.js
presets.js       ← app.js
einsum-spec.js   ← tab-embed-fwd.js, tab-embed-bwd.js
embed-data.js    ← tab-embed-fwd.js, tab-embed-bwd.js
tab-inner.js     ← app.js
tab-intro.js     ← app.js
tab-matmul.js    ← app.js
tab-embed-fwd.js ← app.js
tab-embed-bwd.js ← app.js
```

### Key patterns

- **ES module live bindings**: `export let I, J, K` in shared.js — importers always see current values. Only shared.js can reassign; other modules use `setData()` for bulk updates.
- **Callback registry**: shared.js fires `tabCallbacks.onDimChange()` / `tabCallbacks.onRecompute()` without importing tab modules. app.js registers the handlers via `registerCallbacks()`.
- **Window globals**: HTML onclick handlers call `window.functionName`. app.js assigns ~50 functions to `window`.
- **Three.js as global**: Loaded via `<script>` tag before the ES module. Accessed as `THREE` (global).

## Workflow rules

- **Always commit after any non-trivial change** before telling the user you're done. Don't leave uncommitted work.
- **Run all tests before committing**: `npm test` (unit) AND `npm run test:e2e` (browser). The pre-commit hook runs unit tests and syntax checks, but you should also run e2e tests yourself.
- **Visually verify changes using `playwright-cli`** before considering a task complete. Open the page, navigate to affected tabs, take screenshots, and confirm the UI looks correct. This catches layout issues, rendering bugs, and visual regressions that automated tests miss.
- **Run syntax checks** before committing — the pre-commit hook will catch JS errors, but verify manually if making broad changes.

## Testing

### Unit tests (Vitest)

```bash
npm test           # runs vitest (155 tests across 8 files)
```

- **Framework**: Vitest with jsdom environment
- **Setup**: `tests/setup.js` mocks THREE.js, canvas context, and builds all required DOM elements
- **Key rule**: Never import `app.js` in tests — it runs `rebuild(true)` + `setMode('intro')` at module init. Import individual modules directly.
- **Testable exports**: Functions marked `/* @testable */` are exported primarily for testing (e.g., `getOpHiTm`, `getMmState`, `getBuildMode`, `introAnimDuration`)
- **Writing new tests**: Add regression tests for bugs, put them in `tests/tab-*.test.js`
- **Exclusion**: `vitest.config.js` excludes `tests/e2e/**` so Playwright tests don't conflict

### Browser tests (Playwright)

```bash
npm run test:e2e   # runs playwright test (111 tests across 4 spec files, chromium)
```

- **Framework**: Playwright with chromium
- **Config**: `playwright.config.js` — starts dev server via `npm start` on port 3000
- **Scope**: Smoke tests, preset loading/switching, OP/DP step-through, exploration mode, collapse slider, embedding forward
- **WebGL limitation**: Headless chromium lacks WebGL, so 3D-dependent tests (cube building, collapse animation) use `page.evaluate()` with error handling or test only 2D aspects. WebGL errors are filtered from error assertions.
- **Writing new e2e tests**: Add to `tests/e2e/`. Use `page.evaluate(() => window.fnName())` to call app functions directly when button selectors are fragile.

### Interactive browser testing (playwright-cli)

For ad-hoc browser exploration and visual verification, use `playwright-cli` (NOT the MCP Playwright server):

```bash
playwright-cli open http://localhost:3000/matmul-3d.html
playwright-cli snapshot          # get accessible DOM tree
playwright-cli click e5          # click element by ref
playwright-cli eval "window.setBuildMode('dot')"   # run JS
playwright-cli screenshot --filename=check.png
playwright-cli close
```

- **Use for**: visual verification of changes before committing, debugging UI state, checking layout
- **Do not use**: as a substitute for `npm run test:e2e` — the test runner provides isolation, assertions, and structured reporting that playwright-cli cannot replicate
- **Typical verification flow**: open page → navigate to affected tab → take screenshot → check layout/content → test interaction (click, hover) → close

### Task completion checklist

Before considering any task complete:

1. **`npm test`** — all unit tests pass
2. **`npm run test:e2e`** — all browser tests pass
3. **`playwright-cli`** — visually verify affected tabs look correct (screenshot + snapshot)
4. **Commit** — don't leave uncommitted work

### Persistent memory (Engram)

We use [Engram](https://github.com/Gentleman-Programming/engram) for persistent memory across sessions. It's a local CLI tool backed by SQLite (`~/.engram/engram.db`).

```bash
engram save "title" "content" --type TYPE --project matmult2
engram search "query" --project matmult2
engram context matmult2              # recent context from previous sessions
engram stats                         # overview of stored memories
```

- **Types**: `architecture`, `decision`, `bugfix`, `lesson`, `workflow`, etc.
- **Always use** `--project matmult2` to scope memories to this project
- **Use for**: decisions, lessons learned, gotchas, architectural context that should survive across conversations
- **Not a replacement for** CLAUDE.md (project instructions) or git history (code changes)

### Shared notes (Obsidian vault)

A shared Obsidian vault at `~/obsidian-vault/` serves as the knowledge base between Jeff and Claude Code.

- **`Projects/matmult2/`** — project overview, lessons learned, decisions
- **`Lessons/`** — cross-project insights
- Claude Code writes markdown notes there; Jeff reviews and organizes in Obsidian
- Use `[[wiki links]]` for cross-references between notes

## Pre-commit hook

`.git/hooks/pre-commit` validates all `js/*.js` files with `node --input-type=module --check` and runs `npm test`. Catches syntax errors and regressions before commit.

## How to add a new tab

1. Create `js/tab-newtab.js` — import from `shared.js`, `scene.js`, `cube-manager.js` as needed
2. Export render/reset/pause/step functions
3. In `app.js`: import the new tab's exports, add to `setMode()` switch, register any callbacks, assign window globals
4. In `matmul-3d.html`: add a tier2 tab button, a `ctrl-newtab` controls div, and a canvas host div if it uses 3D
5. See `DEVELOPER_GUIDE.md` for detailed step-by-step instructions and HTML templates

## Architecture

### Four-tier navigation

```
Tier 1:  [Vector Operations]  [Matrix Multiply]  [Embeddings]  [Quantum]
Tier 2a: [Inner Product]  [Outer Product]              ← when Vector Operations active
Tier 2b: (no sub-tabs — preset bar + build-mode toggle) ← when Matrix Multiply active
Tier 2c: [Forward]  [Backward]                          ← when Embeddings active
Tier 2d: [Gates]                                        ← when Quantum active
```

Build mode toggle (radio buttons within the matmul tab):
```
(●) Outer Product    ( ) Dot Product    ☐ Element by element / Term by term
```

- `setTier(tier)` toggles tier1 active states, shows/hides tier2 rows and preset bar
- `setMode(m)` handles per-tab rendering and pausing, auto-selects correct tier
- `setBuildMode(mode)` switches between outer/dot build, triggers full reset
- Each tier remembers its last-used sub-tab

### Preset system

- `js/presets.js` exports `PRESETS` array (11 examples), `loadPreset(id)`, `clearPreset()`, `fullClearPreset()`
- `shared.js` exports `labelA`/`labelB` — dynamic matrix labels used by rendering code
- `shared.js` exports `presetFillA`/`presetFillB` — functions that produce correct values when dimensions change via +/- after preset load
- Selecting a preset loads its matrices via `setData()` + `recomputeFromMatrices()`
- Randomize, dim change, or manual cell edit calls `clearPreset()` (clears active pill + resets labels)

### Tabs

- **Inner Product** (2D, Vector Operations): `a · b = Σ a[i]×b[i]`, editable vectors, step-through. Einsum: `i,i→`
- **Outer Product** (2D, Vector Operations): `a ⊗ b` broadcast animation, hover interaction. Einsum: `i,k→ik`
- **Matrix Multiply** (3D): unified tab with build-mode toggle (outer product / dot product), shared exploration mode, collapse slider. Einsum: `ij,jk→ik`
- **Embed Forward** (2D, Embeddings): `Y = X @ W` where X is one-hot encoded tokens, with detail mode checkbox. Einsum: `btv,vc→btc`
- **Embed Backward** (2D, Embeddings): `dW = Xᵀ @ G` gradient accumulation, shows outer-product contributions per position. Einsum: `btv,btc→vc`
- **Quantum Gates** (2D, Quantum): single-qubit state evolution under I/X/Z gates. Matrix-vector view shows column mixing `U|ψ⟩ = α·U[:,0] + β·U[:,1]`. Circuit history + Dirac reference panel. Einsum: `ij,j→i`

### 3D

- **Single canvas / single Three.js scene** shared across 3D tabs
- All 3D state lives in `boxes[i][j][k]` — mesh, edges, value sprite per cell
- Collapse animation driven by `collapseT ∈ [0,1]` — pure function `applyCollapse(t)` so it's scrubable and reversible
- **Build modes** (radio toggle in matmul tab):
  - **Outer Product mode**: steps through j-slices, opDisplay shows broadcast animation. Detail checkbox = "Element by element"
  - **Dot Product mode**: steps through (i,k) cells, sub-viz shows row·column breakdown. Detail checkbox = "Term by term"
  - Toggling build mode mid-animation triggers full reset
- **Exploration mode** (post-build): click any result cell → sub-viz shows row·column breakdown, cube highlights selected column, hover A/B cells to inspect individual j-factors
- **`buildComplete` flag** (shared.js): tracks whether a full computation has finished. Set true by `mmBuildDone()`. Reset on `resetMmBuildState()` and `rebuild()`.

## Key design decisions made so far

- **Three-tier navigation**: Vector Operations (Inner/Outer Product), Matrix Multiply (single unified tab with build-mode toggle + 11 presets), Embeddings (Forward/Backward)
- One Three.js scene — single canvas, single `mmCanvasHost`
- Speed slider: left = slow, right = fast (not reversed)
- Detail checkbox applies to ALL steps, not just the first (label updates per build mode)
- **mmPhase state machine** (`'build'` → `'collapse'` → `'done'`). Both build modes end at `mmBuildDone()`.
- Collapse slider (labeled "stacked" / "summed") enabled after build completes, scrubs collapse position
- Step dots: one per j-slice (outer product mode) or one per (i,k) cell (dot product mode)
- Max dimensions: I, J, K ∈ [1, 5] to keep performance smooth
- Inner product tab has its own vector size (n=1..8), independent of matmul I/J/K
- **3D axis mapping**: k→X (horizontal), j→Y (vertical/collapse axis), i→Z (depth). This makes the 3D cube slices visually align with the 2D outer product grid below (k=columns left-to-right, i=rows top-to-bottom from the overhead camera angle)
- **`tab-dotprod.js` was deleted** — all dot product functionality merged into `tab-matmul.js` via `buildMode` toggle. Single `collapseT`, single collapse slider, unified step decoding.

## The full taxonomy of views to build toward

These are listed in rough narrative order — mechanics → geometry → deep learning relevance.

### 0. Matrix-vector view (NEW — should be the true entry point)
`y = A @ x` where x is a single vector with adjustable sliders.

This is the conceptual primitive that all the matrix-matrix views build on, and it's the clearest window into information flow. x is a vector of coefficients; A's columns are the available directions; the output is a weighted blend of those columns. Dialing one component of x up or down lights up the corresponding column of A and shows its contribution to the output in real time.

**Why this before everything else:** matrix-matrix multiplication is just "run this J times in parallel." If the user truly internalizes `A @ x` as "x mixes A's columns," dot products, outer products, and attention all follow naturally.

**Visualization:** Show A as a grid with columns distinctly colored. Show x as a vertical vector with live sliders. Show the output vector y assembling as a weighted sum — each column of A scales and accumulates into y as the user drags. When slider j is moved, column j of A brightens/dims proportionally and its contribution to y updates live.

**Deep learning payoff:** In a transformer, x is a token embedding and W is a weight matrix. `W @ x` is the token selecting a combination of W's columns. Attention decides *which* x to use — but the linear algebra is always this. Understanding `A @ x` as column mixing is the foundation for understanding why residual streams work, why weight initialization matters, and what a linear layer is actually doing to token representations.

**Implementation note:** This is 2D only — no Three.js needed. Pure HTML/CSS/JS with smooth slider interactions. Keep it visually consistent with the rest of the app (same colors: orange for A, blue for x/output).

### 1. Dot product view (standard, tab ③ — restore this)
Row of A · column of B for each result cell. The matrixmultiplication.xyz view.
Good for: "what is the algorithm," entry point for new learners.
Implementation note: already coded, just commented out. Should probably be the *first* tab.

### 2.5. Rank-1 sum view (NEW — explicit accumulation of outer product terms)
`Result = Σⱼ A[:,j] ⊗ B[j,:]` shown as J separate 2D heatmap panels that accumulate into the result.

This is distinct from the 3D cube view. The cube makes the *structure* vivid (J layers stacked in 3D space) but the collapse animation is somewhat abstract and the numbers get crowded. This view keeps everything in 2D and makes the *additive accumulation* the hero — you watch the result matrix being assembled one rank-1 contribution at a time.

**Visualization:** J panels arranged horizontally, each showing one `A[:,j] ⊗ B[j,:]` as a colored I×K heatmap with values. Beside them sits a running "accumulator" grid initialized to zeros. Stepping forward: highlight slice j, show its values, then animate those values "pouring" into the accumulator — each cell increments visibly and you can watch `Result[i,k]` grow from 0 toward its final value across J steps.

**What it adds that the cube doesn't:** The cube view emphasizes spatial structure; this view emphasizes arithmetic accumulation. You can read the actual numbers at every step. The additive story — that each rank-1 term is an independent contribution and they simply add — is much more legible in 2D.

**Why "rank-1":** Each panel `A[:,j] ⊗ B[j,:]` is a rank-1 matrix — the simplest possible matrix, expressible as the outer product of two vectors. Its entire column space is a single line (all columns are scalar multiples of A[:,j]). Matrix multiplication is the sum of J such rank-1 matrices. The rank of the result is at most J — you can't get more "information dimensions" out than the number of rank-1 terms you summed.

**Connection to gradients:** If you replaced `A[:,j]` with upstream gradient `δL/δy[:,j]` and `B[j,:]` with input activations `x[j,:]`, you'd be watching a weight gradient accumulate across a batch. The weight update `δL/δW = Σ (input ⊗ grad_output)` is exactly this same rank-1 sum structure. Worth noting in the label text when this tab is built.

**Connection to LoRA:** The low-rank approximation idea (keep only the largest rank-1 terms) is immediately visible — if two of the J panels have very small values, dropping them barely changes the accumulator. That's LoRA.

**Implementation note:** Pure 2D, no Three.js. J panels as CSS grids with color-coded values. Accumulator panel updates with smooth number transitions. Use the same shared `Cube[i][j][k]` data already computed. Step dots = one per j-slice.

### 3. Outer product / rank-1 sum view (tab ① — current, build + collapse merged)
`Result = Σⱼ A[:,j] ⊗ B[j,:]` — J rank-1 matrices summed.
3D cube where Cube[i,j,k] = A[i,j]×B[j,k], then sum out j.
Good for: low-rank structure, LoRA intuition, attention heads as outer products.

### 3. Column scaling view
`Result[:,k] = Σⱼ B[j,k] · A[:,j]`
Each column of the result is a **linear combination of columns of A**, with coefficients from the corresponding column of B.
Visualization idea: show columns of A as vectors, B's column as coefficient weights, animate the weighted sum building up result column k.
Good for: "what does a linear layer do to embeddings" — this is the view that makes people understand that a weight matrix *mixes* columns.

### 4. Row scaling view (symmetric to above)
`Result[i,:] = Σⱼ A[i,j] · B[j,:]`
Each row of result is a linear combination of rows of B, coefficients from A.
Good for: understanding how A "selects" and mixes B's rows.

### 5. Linear transformation / geometric view
Visualize A and B as linear maps. Show what happens to the unit square/circle under B, then AB. 2D version most practical.
Good for: rotation, scaling, shear intuition; composition of transforms; eigenvectors.
Note: 3Blue1Brown covers this well — don't duplicate, but link to it conceptually.

### 6. Bilinear form / attention score view
`score = xᵀ A y` — every entry of AB is a dot-product score between transformed vectors.
This is exactly Q·Kᵀ in attention. Visualize as a heatmap of affinities.
Good for: the bridge from matmul to attention.

### 7. Full attention view (stretch goal)
Score (Q·Kᵀ) → softmax → weighted sum of V.
Matmul appears at every step. Shows why the outer product structure of OV circuit matters.

## Current tab layout (four-tier)

```
Vector Operations:
  Inner Product — a · b              (DONE — 2D step-through)
  Outer Product — a ⊗ b              (DONE — 2D broadcast animation, carries over to matmul)

Matrix Multiply (+ 11 presets):
  Single tab with build-mode toggle:
    Outer Product build → j-slices     (DONE — 3D cube build + collapse)
    Dot Product build → (i,k) cells    (DONE — 3D cell-by-cell build)
    Shared exploration mode post-build (DONE — sub-viz, hover, collapse slider)

Embeddings:
  Forward — btv,vc→btc               (DONE — 2D one-hot row selection, detail mode)
  Backward — btv,btc→vc              (DONE — 2D gradient accumulation)

Quantum:
  Gates — U|ψ⟩ for I, X, Z           (DONE — 2D matrix-vector column mixing, Dirac reference)

Future tabs (not yet in nav):
  Matrix-vector: y = A @ x           (column mixing, sliders)
  Rank-1 sum: accumulating outer products   (2D heatmap panels)
  Bilinear scores → attention              (stretch goal)
```

The narrative arc: *what a dot product is → what an outer product is → how matmul builds and collapses a cube of them → the standard algorithm → presets show real operations → embeddings show real deep learning use → quantum gates as column mixing.*

Note: Inner Product, Outer Product, Embeddings, Quantum are pure 2D (no Three.js). 3D is isolated to the Matrix Multiply tier.

## Middle ground with matrixmultiplication.xyz

That site is excellent for the dot-product view but hides all structure. The insight this app adds:
- The xyz view shows the **reduction** (final summation) but never the 3D object being reduced
- Starting with the xyz-style 2D view and then "lifting" it into 3D to reveal the cube is a compelling transition
- A future dot-product tab could literally extrude into the 3D cube as an animation — the 2D view is a projection of the 3D reality

## Known issues / things to keep in mind

- `jLbl` span bug was fixed — don't re-introduce separate span IDs inside innerHTML strings that get overwritten
- `tm1` is used for both build tick timeouts AND the 600ms build→collapse transition timeout — `mmPauseBuild()` / `mmPauseAll()` cancel it via `clearTimeout(tm1)`
- `colAnimId` is a `requestAnimationFrame` id — cancelled via `cancelAnimationFrame(colAnimId)` in `stopColAnim()`
- **rAF first-frame fix**: `runColAnim` skips the first frame (`if(!last){ last=now; ... return; }`) because dt=0 would trigger the boundary check and stop immediately
- When rebuilding, always call `removePlusPlanes()` before `rebuildBoxes()` to avoid orphaned scene objects
- The orbit controls share one `orb` object — resetting theta/phi in `rebuildBoxes()` is intentional
- Three.js r128 from cdnjs — don't upgrade without testing, OrbitControls not used (custom drag implementation)
- `lastOpJ` tracks the last displayed j-slice in the outer product display to avoid re-triggering broadcast animations on same-j re-renders — reset it whenever build state resets (`mmReset`, `rebuild`)
- `mmBuildDone` uses `mmStopBuildTimer()` (not `mmPauseBuild()`) to preserve highlight timers
- `setBuildMode()` triggers full `mmReset()` — no mid-build mode switching
- Single `collapseT` — no separate DP collapse state. One slider, one state variable.
- `detailMode()` reads `#chkDetail` checkbox; label updates per build mode ("Element by element" / "Term by term")

## TODO

