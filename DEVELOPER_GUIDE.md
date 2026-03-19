# MatMul Visualizer — Developer Guide

A comprehensive reference for humans and AI agents working on this codebase.

## Quick start

```bash
npm install        # one-time: installs `serve`
npm start          # starts local server on http://localhost:3000
```

Open `http://localhost:3000/matmul-3d.html` in a browser. ES modules require a local server — `file://` won't work.

A pre-commit hook validates JS syntax and runs unit tests on every commit. If it fails, fix the issue and commit again.

---

## File overview

| File | Lines | Role |
|------|------:|------|
| `matmul-3d.html` | ~1211 | HTML structure + CSS. No inline JS. |
| `js/shared.js` | ~162 | Global state, dimension management, utilities, callback registry |
| `js/scene.js` | ~112 | Three.js scene, camera, custom orbit controls, render loop |
| `js/cube-manager.js` | ~92 | 3D box meshes: create, paint, plus-sign sprites |
| `js/presets.js` | ~196 | 11 named matrix multiply examples |
| `js/einsum-spec.js` | ~119 | Einsum parser and tensor contraction engine |
| `js/embed-data.js` | ~95 | Embedding data generation (tokens, one-hots, gradients) |
| `js/tab-inner.js` | ~214 | Inner Product: a · b step-through (2D) |
| `js/tab-intro.js` | ~396 | Outer Product: a ⊗ b broadcast animation (2D) |
| `js/tab-matmul.js` | ~1238 | Matrix Multiply: unified build (outer/dot) + exploration + collapse (3D) |
| `js/tab-embed-fwd.js` | ~669 | Embedding Forward: btv,vc→btc (2D) |
| `js/tab-embed-bwd.js` | ~284 | Embedding Backward: btv,btc→vc (2D) |
| `js/app.js` | ~504 | Entry point: tier/tab nav, preset system, mode switching, rebuild, window globals |

### Import graph

Arrows show "is imported by." No circular dependencies.

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

---

## Data model

### Dimensions

```
I = rows of A / rows of Result      ∈ [1, 5]
J = cols of A / rows of B           ∈ [1, 5]   (shared/contraction dimension)
K = cols of B / cols of Result       ∈ [1, 5]
```

Adjustable via +/- buttons in the UI. Maximum 5 to keep 3D performance smooth.

### Core arrays (all in `shared.js`)

```
A[i][j]         I×J input matrix         (orange in UI)
B[j][k]         J×K input matrix         (blue in UI)
Cube[i][j][k]   I×J×K product cube       Cube[i][j][k] = A[i][j] * B[j][k]
Res[i][k]       I×K result matrix        Res[i][k] = Σⱼ Cube[i][j][k]
```

Values are integers 1–9 (randomized) or user-editable in range [-99, 99].

### ES module state sharing

Shared state uses `export let` — ES live bindings mean importers always read the current value. **Only shared.js can reassign** these variables. Other modules that need to update state in bulk call `setData({I, J, K, A, B, Cube, Res})`.

### Callback registry

To avoid circular imports (app.js imports tab modules, tab modules can't import app.js), `shared.js` maintains a callback registry:

```js
// shared.js
const tabCallbacks = {};
export function registerCallbacks(cbs) { Object.assign(tabCallbacks, cbs); }

// Fires when dimension changes, inline edits, etc:
if (tabCallbacks.onDimChange) tabCallbacks.onDimChange(oldI, oldJ, oldK);
if (tabCallbacks.onRecompute) tabCallbacks.onRecompute();
```

`app.js` registers the handlers at startup via `registerCallbacks({onDimChange, onRecompute})`.

### Preset system

`js/presets.js` exports `PRESETS` array with 11 named examples:

| ID | Name | Dims | Build mode |
|----|------|------|------------|
| `basic` | Basic 2×3 · 3×2 | 2×3×2 | outer |
| `identity` | Identity | 3×3×3 | dot |
| `row-select` | Row Selection | 3×3×3 | dot |
| `permute` | Permutation | 3×3×3 | dot |
| `sum-rows` | Sum Rows (1ᵀ @ B) | 1×3×2 | outer |
| `sum-cols` | Sum Columns (B @ 1) | 3×3×1 | outer |
| `average` | Average Rows | 1×3×2 | outer |
| `mask-upper` | Cumulative Sum | 4×4×2 | outer |
| `projection` | Projection | 3×3×1 | dot |
| `outer` | Outer Product (a ⊗ b) | 3×1×3 | outer |
| `roll` | Circular Shift | 4×4×1 | dot |

Selecting a preset loads matrices via `setData()` + `recomputeFromMatrices()`, sets labels (`labelA`, `labelB`), and may switch build mode. Randomize, dim change, or cell edit calls `clearPreset()`.

Presets also set `presetFillA`/`presetFillB` — functions that produce correct values when dimensions are changed via +/- buttons after preset load.

### URL deep linking

Query parameters on the page URL allow direct navigation to a specific tab, preset, and build mode. Useful for external links, documentation, and sharing.

```
/matmul-3d?tab=matmul&preset=identity&mode=dot
```

| Parameter | Values | Effect |
|-----------|--------|--------|
| `tab` | `inner`, `intro`, `matmul`, `embed-fwd`, `embed-bwd` | Navigate to tab (defaults to `inner`) |
| `preset` | Any preset ID (see table below) | Load preset, auto-navigates to matmul tab |
| `mode` | `outer`, `dot` | Set build mode; overrides preset default if both specified |

All parameters are optional and can be combined. If `preset` is specified without `tab`, the app auto-navigates to the matmul tab.

**Preset IDs for deep links:**

| ID | Example URL |
|----|-------------|
| `basic` | `?preset=basic` |
| `identity` | `?preset=identity` |
| `row-select` | `?preset=row-select` |
| `permute` | `?preset=permute` |
| `sum-rows` | `?preset=sum-rows` |
| `sum-cols` | `?preset=sum-cols` |
| `average` | `?preset=average` |
| `mask-upper` | `?preset=mask-upper` |
| `projection` | `?preset=projection` |
| `outer` | `?preset=outer` |
| `roll` | `?preset=roll` |

**Note**: The `serve` dev server uses clean URLs — use `/matmul-3d?...` (no `.html`) to avoid a redirect that may strip query parameters.

**Implementation**: `applyUrlParams()` runs at the end of `app.js` init, after `buildPresetBar()` and `rebuild(true)`. It wraps `setMode()` calls in try/catch for WebGL resilience and uses `setBuildMode(mode, { quiet: true })` to avoid triggering `mmReset()` on bare state.

---

## Three.js scene (`scene.js`)

### Setup

- Three.js **r128** loaded as a global `<script>` (not an ES module). Access via `THREE`.
- Single `<canvas id="mainCanvas">`, shared across 3D tabs via `moveCanvasTo(hostId)`.
- `WebGLRenderer` with antialiasing, pixelRatio capped at 2, clear color `#fafafa`.
- `PerspectiveCamera` with FOV 38. Distance auto-scales based on `max(I, J, K)`.
- Three lights: ambient (0.82), two directional (0.48, 0.18).

### Custom orbit controls

No `OrbitControls` library. A simple custom implementation in `scene.js`:

```
orb = { theta, phi, dragging, lx, ly }
```

- Mouse/touch drag rotates camera via spherical coordinates.
- `phi` clamped to `[0.08, π - 0.08]` to prevent flipping.
- `theta = 0.50`, `phi = 0.62` are the default "isometric-ish" angles.
- Camera position recalculated each frame from `(r, theta, phi)`.

### Render loop

Continuous `requestAnimationFrame` loop. Camera distance `r` recalculates every frame using live-bound `I, J, K` values so the view adjusts when dimensions change.

---

## 3D cube (`cube-manager.js`)

### `boxes[i][j][k]` structure

Each element of the 3D grid is an object:

```js
{
  mesh: THREE.Mesh,              // BoxGeometry(0.78, 0.78, 0.78) + MeshPhongMaterial
  mat:  THREE.MeshPhongMaterial, // for direct color/opacity control
  edges: THREE.LineSegments,     // wireframe edges
  em:   THREE.LineBasicMaterial, // edge material
  spr:  THREE.Sprite,            // value label (canvas texture)
  px, py, pz                     // "home" position
}
```

### Positioning constants

```
CELL = 0.78        box size
GAP  = 0.13        gap between boxes
STEP = 0.91        CELL + GAP
```

### 3D axis mapping

```
k → X   (horizontal, left-to-right)
j → Y   (vertical, collapse axis)
i → Z   (depth, front-to-back)
```

This makes 3D slices visually align with 2D grids: k = columns, i = rows from the default camera angle.

### Key functions

| Function | What it does |
|----------|-------------|
| `rebuildBoxes()` | Destroy old meshes, create new I×J×K grid. Resets orbit angles. |
| `paintBox(i,j,k, col, opacity, emissive, val)` | Set color, opacity, edge color, and sprite text for one box. |
| `paintSlice(j, state)` | Paint all boxes in slice j as `'empty'`, `'active'`, or `'done'`. |
| `ensureAllGreen()` | Set all slices to `'done'` (green). Used after build completes. |
| `packedY(j)` | Y coordinate of slice j. |
| `addPlusPlanes()` / `removePlusPlanes()` | Add/remove "+" sprites between slices. |
| `clearBoxes()` | Remove all 3D objects from the scene (used when switching to 2D tabs). |

---

## Navigation: Three-tier system

```
Tier 1:  [Vector Operations]  [Matrix Multiply]  [Embeddings]
Tier 2a: [Inner Product]  [Outer Product]              ← when Vector Operations active
Tier 2b: (no sub-tabs, preset bar + build mode toggle)  ← when Matrix Multiply active
Tier 2c: [Forward]  [Backward]                          ← when Embeddings active
```

- `setTier(tier)` toggles tier1 active states, shows/hides tier2 rows and preset bar
- `setMode(m)` handles per-tab rendering and pausing, auto-selects correct tier
- Each tier remembers its last-used sub-tab

---

## Inner Product (`tab-inner.js`)

Pure 2D. Demonstrates `a · b = Σᵢ a[i] × b[i]`. Einsum: `i,i→`

### State

```
ipA[n], ipB[n]   vectors (editable)
ipN              vector size ∈ [1, 8]   (independent of matmul I/J/K)
ipStep           -1 (overview) | 0..ipN-1 (highlighting term i)
ipPlaying        bool
```

Steps through each term, showing `a[i] × b[i]` highlighted with running sum.

---

## Outer Product (`tab-intro.js`)

Pure 2D. Demonstrates `a ⊗ b` (broadcast multiplication). Einsum: `i,k→ik`

### State

```
introA[i]        I-length vector (orange)
introB[k]        K-length vector (blue)
introStep        0 | 1 | 2 (3-step animation)
introPlaying     bool
```

### Steps

| Step | What happens |
|------|-------------|
| 0 | Show vectors `a` (column) and `b` (row). Formula explains broadcast. |
| 1 | **Broadcast animation**: a copies rightward, b copies downward. Result grid appears with staggered CSS animations. |
| 2 | Final outer product grid with **hover interaction**: hovering cell (i,k) highlights `a[i]` and `b[k]`. Cells cycle automatically when playing. |

### Carry-over to Matrix Multiply

When switching from intro to matmul, `carryIntroToMatmul(introA, introB)` fires — the outer product becomes the A matrix, creating a narrative connection.

---

## Matrix Multiply (`tab-matmul.js`)

The central 3D visualization. This single module handles both outer product and dot product build modes, exploration, and collapse. (The former `tab-dotprod.js` was merged here.)

### Build modes (radio toggle)

```
(●) Outer Product    ( ) Dot Product    ☐ Element by element / Term by term
```

`setBuildMode('outer'|'dot')` triggers a full `mmReset()` — no mid-build mode switching.

**Outer product mode**: Steps through j-slices. Each step shows `A[:,j] ⊗ B[j,:]` as a 2D sub-viz below the cube. Detail checkbox = "Element by element" (fills individual cells within each slice).

**Dot product mode**: Steps through (i,k) result cells. Each step computes `A[i,:] · B[:,k]`. Detail checkbox = "Term by term" (shows individual j-terms with partial sums).

### State machine: `mmPhase`

```
'build'  →  'collapse'  →  'done'
   ↑             |
   └─────────────┘  (if collapseT reaches 0 via ◀)
```

### Build phase

- `t1` = current step index, `-1` = idle.
- Step counts depend on build mode and detail:
  - Outer: `J` steps (or `J×I×K` if element-by-element)
  - Dot: `I×K` steps (or `I×K×J` if term-by-term)
- `applyStep(s)` dispatches to `applyS1(s)` (outer) or `applyDpStep(s)` (dot) based on `buildMode`.
- After the last step, 600ms pause, then auto-transitions to collapse.

### Collapse phase

**Pure function**: `applyCollapse(t)` where `t ∈ [0, 1]`.

```
t = 0: slices at original positions (stacked)
t = 1: all slices collapsed to y=0, values show Res[i][k]
```

What happens as t increases:
- Each slice j moves from `packedY(j)` toward 0 (ease-in-out curve).
- Colors lerp from green (`#50c878`) to purple (`#7c6ff5`).
- Plus-sign sprites fade out.
- Value labels on j=0 lerp from `Cube[i][0][k]` to `Res[i][k]`.
- At t=1, only j=0 slice is visible.

**Why pure?** Being a pure function of `t` means it's scrubable (slider), reversible (◀ button), and pausable at any point.

### Exploration mode (post-build)

After build completes, click any result cell → `mmJumpToCell(i, k)`:
- Sub-viz shows the full dot product breakdown `A[i,:] · B[:,k]`
- Cube highlights the selected vertical column
- Hover A or B cells to inspect individual j-factor contributions

### Timers

| Timer | Purpose | Cancel |
|-------|---------|--------|
| `tm1` (setTimeout) | Build tick + 600ms build→collapse transition | `clearTimeout(tm1)` |
| `colAnimId` (rAF) | Collapse animation frames | `cancelAnimationFrame(colAnimId)` |

### Key exports

| Function | Purpose |
|----------|---------|
| `mmToggle()`, `mmFwd()`, `mmBack()`, `mmReset()` | Playback control |
| `mmPauseBuild()`, `mmPauseAll()` | Stop timers |
| `applyStep(s)`, `applyS1(s)`, `applyCollapse(t)` | Paint functions |
| `mmRenderResult()` | Render result grid (partial sums, final, or interactive) |
| `mmJumpToCell(i, k)` | Enter exploration mode |
| `mmHoverCell(j)`, `mmClearHover()` | Exploration hover |
| `setBuildMode(mode)` | Switch outer/dot, triggers full reset |
| `mmToggleDetail()` | Toggle detail checkbox, remaps step position |
| `renderA(j, curI, curK)`, `renderB(j, curI, curK)` | Render side grids |
| `getMmState()`, `getBuildMode()` | Testable state queries |

---

## Embedding Forward (`tab-embed-fwd.js`)

Pure 2D. Shows `Y = X @ W` where X is one-hot encoded tokens. Einsum: `btv,vc→btc`

### State

```
eB, eT, eV, eC    batch, time, vocab, channels (adjustable)
tokenIds[b][t]     token indices
X[b][t][v]         one-hot encoded (V-length)
W[v][c]            embedding weight table (V×C)
Y[b][t][c]         output embeddings (B×T×C)
efStep             -1 (overview) | 0..B×T-1 (highlighting position)
efDetail           bool (default true) — element-by-element sub-viz
```

### Detail mode

Checkbox `#chkEfDetail` (default checked):
- **Off (compact)**: horizontal one-hot row × W → result row
- **On (detail)**: full V×C intermediate grid showing which row of W is selected

### Stacked tensor visualization

X and Y are 3D tensors (B×T×V and B×T×C). Displayed as stacked 2D pages (one per batch). Hovering a batch page expands it using `position: absolute` overlay (doesn't shift other tensors).

---

## Embedding Backward (`tab-embed-bwd.js`)

Pure 2D. Gradient accumulation: `dW = Xᵀ @ G`. Einsum: `btv,btc→vc`

### State

```
Same dimensions as forward: eB, eT, eV, eC
tokenIds, X, G[b][t][c] (upstream gradients), dW[v][c] (accumulated weight gradient)
dWAccum            running accumulator, updated as ebStep advances
ebStep             -1 (overview) | 0..B×T-1
```

Steps through positions showing each outer-product contribution to dW. Each step: `dW += X[b,t,:] ⊗ G[b,t,:]` (but only the selected row of W gets the gradient, since X is one-hot).

---

## Utility modules

### `einsum-spec.js`

Parses einsum signature strings and computes tensor contractions:
- `parseEinsum(sig, dims)` — e.g. `'btv,vc->btc'` → parsed spec with contracted/free indices
- `computeEinsum(spec, inputData)` — compute output tensor from nested arrays

Used by the embedding tabs for rigorous tensor operations.

### `embed-data.js`

Generates random embedding data:
- `generateTokens(B, T, V)` → `{tokenIds, X}` (one-hot encoded)
- `generateEmbedding(V, C)` → `W` (values 1–9)
- `generateGradients(B, T, C)` → `G` (values -4 to 4)
- `computeForward(X, W)` → `Y`
- `computeBackward(X, G)` → `dW`

---

## HTML structure (`matmul-3d.html`)

### Navigation DOM

```
Tier 1 buttons: #tier1-blocks, #tier1-matmul, #tier1-embed
Tier 2 rows:    #tier2-blocks, #tier2-matmul (hidden), #tier2-embed
Tab buttons:    #tab-inner, #tab-intro, #tab-matmul,
                #tab-embed-fwd-nav, #tab-embed-bwd-nav
```

### Key DOM IDs

| ID | Element |
|----|---------|
| **Navigation** | |
| `tier1-blocks`, `tier1-matmul`, `tier1-embed` | Tier 1 buttons |
| `tab-inner`, `tab-intro` | Vector Operations sub-tabs |
| `tab-embed-fwd-nav`, `tab-embed-bwd-nav` | Embeddings sub-tabs |
| **Control panels** | |
| `ctrl-inner`, `ctrl-intro`, `ctrl-matmul` | Tab content containers |
| `ctrl-embed-fwd`, `ctrl-embed-bwd` | Embedding tab containers |
| **Inner Product** | |
| `innerDisplay`, `spInner`, `pbInner`, `fInner`, `dInner`, `einsumInner` | |
| **Outer Product** | |
| `introDisplay`, `spIntro`, `pbIntro`, `fIntro`, `dIntro`, `einsumIntro` | |
| **Matrix Multiply** | |
| `presetSelect` | Preset dropdown |
| `presetDesc` | Preset description banner |
| `buildModeToggle` | Outer/Dot radio buttons |
| `chkDetail`, `chkDetailLabel` | Detail checkbox (label updates per mode) |
| `gridA`, `gridB` | A and B matrix grids |
| `mmCanvasHost`, `mainCanvas` | 3D canvas area |
| `canvasTitle` | "Cube[i,j,k] = ..." / "Result[i,k]" |
| `spCollapse` | Collapse slider (range 0–1000) |
| `mmResultGrid`, `mmResultHint` | Result grid + hint text |
| `opDisplay` | Outer product sub-viz (hidden during DP or exploration) |
| `dpSubViz` | Dot product sub-viz / exploration sub-viz |
| `spMM`, `pbMM`, `fMM`, `dMM`, `einsumMatmul` | Speed, play, formula, dots, einsum |
| **Embedding Forward** | |
| `efDisplay`, `spEF`, `pbEF`, `fEF`, `dEF`, `einsumEmbedFwd` | |
| `chkEfDetail`, `chkEfDetailLabel` | Detail checkbox |
| **Embedding Backward** | |
| `ebDisplay`, `spEB`, `pbEB`, `fEB`, `dEB`, `einsumEmbedBwd` | |
| **Shelves** | |
| `infoShelf`, `infoShelfHandle`, `infoShelfBackdrop` | Info shelf (per-tab help) |
| `shelfContent` | Dynamic shelf content |
| `rulesShelf`, `rulesShelfHandle`, `rulesShelfBackdrop` | Einsum rules shelf |

### CSS: Matrix cell classes

All matrix cells use `.mat-cell` as base class, with modifiers:

```css
.mat-cell.a            /* Orange (A matrix) */
.mat-cell.b            /* Blue (B matrix) */
.mat-cell.r            /* Green (Result matrix) */
.mat-cell.neutral      /* Gray (unassigned) */

/* State modifiers (combine with a/b/r): */
.hi                    /* Highlighted (row/column) */
.cur                   /* Current active cell (scaled up, shadow) */
.dim                   /* Dimmed (opacity 0.13) */
.hi-cell               /* Hover highlight (larger scale) */
.done                  /* Computed result */
.empty                 /* Unfilled result slot */
.partial               /* Partially computed (outer product build) */
.anim                  /* Fade-in animation */
.editable              /* Click-to-edit */
```

### CSS: Layout containers

```css
.mm-row          /* Flex row: A × B = Cube. Fixed height */
.mm-mat-area     /* Matrix container. Fixed height, centers content vertically */
.mm-cube-area    /* 3D canvas container. Fixed height */
.mm-toolbar      /* Controls row: preset, build mode, playback, speed, detail, einsum */
```

These use **fixed heights** (not min-height) so that controls below never shift when dimensions change.

---

## Window globals and HTML event wiring

HTML uses inline `onclick` handlers. Since ES modules don't pollute the global scope, `app.js` explicitly assigns all handler functions to `window` (~50 total):

**Core**: `rebuild`, `setMode`, `setTier`, `selectPreset`, `toggleInfo`, `toggleRules`, `changeDim`, `updateSegControl`, `snapToDefault`, `copyTorchCode`

**Inner Product**: `ipFwd`, `ipBack`, `ipToggle`, `ipReset`, `ipEditCell`, `ipResize`

**Outer Product**: `stepFwdIntro`, `stepBackIntro`, `togglePlayIntro`, `resetIntro`, `introEditCell`, `introHover`, `introClearHover`

**Matrix Multiply**: `mmBack`, `mmFwd`, `mmToggle`, `mmReset`, `mmScrubCollapse`, `mmRenderResult`, `mmSelectResultCell`, `mmJumpToCell`, `mmHoverCell`, `mmClearHover`, `mmToggleDetail`, `setBuildMode`

**Embed Forward**: `efFwd`, `efBack`, `efToggle`, `efReset`, `efJumpToPos`, `efTraceBack`, `efChangeDim`, `efToggleDetail`, `getEfState`

**Embed Backward**: `ebFwd`, `ebBack`, `ebToggle`, `ebReset`, `ebJumpToPos`, `ebTraceBack`, `ebChangeDim`

If you add a new function that needs to be called from HTML, you must add a `window.fnName = fnName` line in `app.js`.

---

## Color palette

| Color | Hex | Usage |
|-------|-----|-------|
| Orange | `#e06000` | A matrix (text), active cell |
| Light orange | `#fff3e8` | A matrix cell background |
| Blue | `#1a60b0` | B matrix (text), active cell |
| Light blue | `#e8f2ff` | B matrix cell background |
| Green | `#50c878` / `#1a9a40` | Result matrix, "done" slices |
| Purple | `#7c6ff5` | Collapsed cube |
| Gray | `#fafafa` | Canvas background |
| Light gray | `#eeeeee` | Empty/inactive boxes |

---

## Common operations

### Changing dimensions

User clicks +/- buttons → `changeDim(dim, delta)` in shared.js:
1. Clamp new dimension to [1, 5].
2. Resize A, B arrays (preserve existing values, fill new cells via `presetFillA`/`presetFillB` or `rand()`).
3. Recompute Cube and Res.
4. Fire `tabCallbacks.onDimChange(oldI, oldJ, oldK)`.

The callback in app.js then resets animations, rebuilds boxes, and re-renders.

### Inline cell editing

Click an `.editable` cell → `editCellInline(el, currentValue, color, onCommit)`:
1. Replaces cell content with a text input.
2. On blur or Enter: parse integer, clamp to [-99, 99], call `onCommit(value)`.
3. On Escape: restore original value.
4. `onCommit` updates the array and calls `recomputeFromMatrices()` → fires `onRecompute` callback.

### Rebuilding everything

`rebuild(rnd)` (called by Randomize/Reset buttons):
1. Pause all animations across all tabs.
2. `computeData(rnd)` — generate new A, B, Cube, Res (random if `rnd=true`, all 1s if `false`).
3. `initIntroVecs(rnd)` — generate new introA, introB.
4. Rebuild 3D boxes if on a 3D tab, or clear them if on 2D.
5. Re-render the current tab.

### Tab switching

`setMode(m)` in app.js:
1. Pause animations in the previous tab.
2. Toggle `.active` / `.hidden` CSS classes on tab buttons and panels.
3. If leaving intro, trigger carry-over.
4. Move canvas to the new tab's host div (if 3D).
5. Initialize the new tab's state (rebuild boxes, reset animation, render).

---

## Gotchas and pitfalls

1. **`removePlusPlanes()` before `rebuildBoxes()`**: Always remove old sprites before building new boxes, or orphaned Three.js objects accumulate in the scene.

2. **`tm1` double duty**: Used for both build tick timeouts AND the 600ms build→collapse transition. `mmPauseBuild()` / `mmPauseAll()` clear it. Don't create a second timeout variable — just reuse `tm1` and always clear it first.

3. **`lastOpJ` reset**: Tracks the last displayed j-slice in the outer product panel. Must be reset to `-1` in `mmReset` and `rebuild`, or the broadcast animation won't re-trigger for the same slice.

4. **rAF first-frame skip**: Collapse animation skips the first frame because `dt=0` would immediately trigger the boundary check. Don't remove the `if (!last)` guard.

5. **`setData()` for cross-module writes**: Only shared.js can reassign its own `let` exports. If a tab module needs to update shared state, call `setData({...})`. Don't try direct assignment — it silently fails in ES modules.

6. **`mmBuildDone` uses `mmStopBuildTimer()`** (not `mmPauseBuild()`) to preserve highlight timers.

7. **Three.js r128**: Pinned version loaded from CDN. Don't upgrade without testing. The custom orbit controls don't use `OrbitControls` from the library.

8. **`jLbl` span bug**: Don't create separate span IDs inside `innerHTML` strings that get overwritten by subsequent renders — the IDs will become stale.

9. **`setBuildMode()` triggers full reset**: No mid-build mode switching. Always resets to t1=-1, clears selection.

10. **Single `collapseT`**: No separate DP collapse state. One slider, one state variable shared across build modes.

11. **`detailMode()`** reads `#chkDetail` checkbox. Label text updates per build mode: "Element by element" (outer) vs "Term by term" (dot).

---

## Testing

### Unit tests (Vitest)

```bash
npm test           # runs vitest (155 tests across 8 files)
```

| File | Tests | Coverage |
|------|------:|---------|
| `tests/shared.test.js` | 9 | computeData, changeDim, recompute |
| `tests/embed-data.test.js` | 8 | Token generation, forward/backward compute |
| `tests/einsum-spec.test.js` | 15 | Einsum parser, tensor contraction |
| `tests/tab-intro.test.js` | 11 | Outer product rendering, step logic |
| `tests/tab-inner.test.js` | 12 | Inner product rendering, step-through |
| `tests/tab-embed-bwd.test.js` | 11 | Backward embedding, accumulator |
| `tests/tab-embed-fwd.test.js` | 30 | Forward embedding, detail mode, tensors |
| `tests/tab-matmul.test.js` | 59 | Build modes, detail, exploration, collapse, hover |

**Key rules**:
- Never import `app.js` in tests — it runs `rebuild(true)` + `setMode('intro')` at module init.
- Import individual modules directly.
- Functions marked `/* @testable */` are exported primarily for testing.
- `tests/setup.js` mocks THREE.js globally, provides canvas getContext stub, builds full DOM.

### Browser tests (Playwright)

```bash
npm run test:e2e   # runs playwright test (123 tests across 5 spec files)
```

| File | Scope |
|------|-------|
| `tests/e2e/smoke.spec.js` | Page load, tabs, presets, tier switching, grid rendering |
| `tests/e2e/presets.spec.js` | Preset loading, switching, state reset, exploration |
| `tests/e2e/qa-explore.spec.js` | OP/DP step-through, exploration, collapse slider |
| `tests/e2e/embed-fwd.spec.js` | Embedding forward: pills, tensors, detail mode |
| `tests/e2e/deeplink.spec.js` | URL query parameter deep linking (tab, preset, mode) |

**WebGL limitation**: Headless chromium lacks WebGL, so 3D-dependent tests use `page.evaluate()` with try/catch or test only DOM aspects. WebGL errors are filtered from error assertions.

### Interactive browser testing (playwright-cli)

For ad-hoc browser exploration, use `playwright-cli` (not the MCP Playwright server):

```bash
playwright-cli open http://localhost:3000/matmul-3d.html
playwright-cli snapshot          # get accessible DOM tree
playwright-cli click e5          # click element by ref
playwright-cli eval "window.setBuildMode('dot')"
playwright-cli screenshot --filename=check.png
playwright-cli close
```

---

## Adding a new tab (step-by-step)

### 1. Create the tab module

Create `js/tab-newview.js`. Import what you need:

```js
import { I, J, K, A, B, Cube, Res } from './shared.js';
// If 3D: import { sc, CELL, STEP, makeTex } from './scene.js';
// If 3D: import { boxes, rebuildBoxes, ... } from './cube-manager.js';
```

Export standard lifecycle functions:

```js
export function nvRender() { ... }        // render current state
export function nvReset() { ... }         // reset to initial state
export function nvPause() { ... }         // stop any running timers/rAF
export function nvFwd() { ... }           // step forward
export function nvBack() { ... }          // step backward
export function nvToggle() { ... }        // play/pause
```

### 2. Wire up in `app.js`

```js
import { nvRender, nvReset, nvPause, nvFwd, nvBack, nvToggle } from './tab-newview.js';
```

Add to `setMode()` switch. Add to `rebuild()` and the `onDimChange` callback. Assign window globals.

### 3. Add HTML

In `matmul-3d.html`: add a tier2 tab button, a `ctrl-newview` controls div, and a canvas host div if 3D.

### 4. Update `renderEinsumBadge` in `app.js`

Add a case for your new tab's einsum notation.

---

## Developer tools

| Tool | Purpose |
|------|---------|
| `npm test` | Unit tests (Vitest, 155 tests) |
| `npm run test:e2e` | Browser tests (Playwright, 123 tests) |
| `playwright-cli` | Interactive browser testing |
| `engram` | Persistent memory across sessions (SQLite, `~/.engram/engram.db`) |
| Obsidian vault | Shared notes at `~/obsidian-vault/` |
