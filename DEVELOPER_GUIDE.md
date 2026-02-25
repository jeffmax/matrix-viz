# MatMul Visualizer — Developer Guide

A comprehensive reference for humans and AI agents working on this codebase.

## Quick start

```bash
npm install        # one-time: installs `serve`
npm start          # starts local server on http://localhost:3000
```

Open `http://localhost:3000/matmul-3d.html` in a browser. ES modules require a local server — `file://` won't work.

A pre-commit hook validates JS syntax on every commit. If it fails, fix the syntax error and commit again.

---

## File overview

| File | Lines | Role |
|------|------:|------|
| `matmul-3d.html` | ~571 | HTML structure + CSS. No inline JS. |
| `js/shared.js` | ~135 | Global state, dimension management, utilities, callback registry |
| `js/scene.js` | ~80 | Three.js scene, camera, custom orbit controls, render loop |
| `js/cube-manager.js` | ~90 | 3D box meshes: create, paint, plus-sign sprites |
| `js/tab-intro.js` | ~337 | Tab 0: Outer Product (2D only, no Three.js) |
| `js/tab-matmul.js` | ~452 | Tab 1: MatMul Build & Collapse (3D) |
| `js/tab-dotprod.js` | ~416 | Tab 2: Dot Product perspective (3D) |
| `js/app.js` | ~201 | Entry point: mode switching, rebuild, einsum badge, window globals |

### Import graph

Arrows show "is imported by." No circular dependencies.

```
shared.js        ← scene.js, cube-manager.js, tab-intro.js, tab-matmul.js, tab-dotprod.js, app.js
scene.js         ← cube-manager.js, tab-matmul.js, tab-dotprod.js, app.js
cube-manager.js  ← tab-matmul.js, tab-dotprod.js, app.js
tab-intro.js     ← app.js
tab-matmul.js    ← app.js
tab-dotprod.js   ← app.js
```

---

## Data model

### Dimensions

```
I = rows of A / rows of Result      ∈ [1, 4]
J = cols of A / rows of B           ∈ [1, 4]   (shared/contraction dimension)
K = cols of B / cols of Result       ∈ [1, 4]
```

Adjustable via +/- buttons in the UI. Maximum 4 to keep 3D performance smooth.

### Core arrays (all in `shared.js`)

```
A[i][j]         I×J input matrix         (orange in UI)
B[j][k]         J×K input matrix         (blue in UI)
Cube[i][j][k]   I×J×K product cube       Cube[i][j][k] = A[i][j] * B[j][k]
Res[i][k]       I×K result matrix        Res[i][k] = Σⱼ Cube[i][j][k]
```

Values are integers 1–9 (randomized) or user-editable in range [-99, 99].

### ES module state sharing

Shared state uses `export let` — ES live bindings mean importers always read the current value. **Only shared.js can reassign** these variables. Other modules that need to update state in bulk (e.g., `carryIntroToMatmul`) call `setData({I, J, K, A, B, Cube, Res})`.

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

---

## Three.js scene (`scene.js`)

### Setup

- Three.js **r128** loaded as a global `<script>` (not an ES module). Access via `THREE`.
- Single `<canvas id="mainCanvas">` (420×380), shared across tabs via `moveCanvasTo(hostId)`.
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
| `ensureAllGreen()` | Set all slices to `'done'` (green). Used when entering dotprod tab. |
| `packedY(j)` | Y coordinate of slice j. |
| `addPlusPlanes()` / `removePlusPlanes()` | Add/remove "+" sprites between slices. |
| `clearBoxes()` | Remove all 3D objects from the scene (used when switching to intro tab). |

### Canvas textures

`makeTex(text, color)` renders text to a 128×128 canvas and returns a `THREE.CanvasTexture`. Used for value labels on each box and for plus-sign sprites (`makePlusTex()`).

---

## Tab 0: Outer Product (`tab-intro.js`)

Pure 2D — no Three.js. Demonstrates `a ⊗ b` (outer product of two vectors).

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
| 1 | **Broadcast animation**: a copies rightward (K−1 times), b copies downward (I−1 times). Result grid appears with staggered CSS animations. |
| 2 | Final outer product grid with **hover interaction**: hovering cell (i,k) highlights `a[i]` and `b[k]`, shows the multiplication formula. Cells cycle automatically when playing. |

### Speed

`delay = 1400 - sliderValue` (slider range 200–1200). Left = slow, right = fast.

### Carry-over to Tab 1

When switching from intro to any other tab (if `introA` has data), `carryIntroToMatmul(introA, introB)` fires:
- Sets `A = introA ⊗ introB` (the outer product becomes the A matrix)
- `J = introB.length`
- `B` is randomized
- `Cube` and `Res` are recomputed

This creates a narrative connection: "your outer product becomes one input to matrix multiplication."

---

## Tab 1: Matrix Multiply — Build & Collapse (`tab-matmul.js`)

The central 3D visualization. Shows `Result = Σⱼ A[:,j] ⊗ B[j,:]` as a cube being built slice-by-slice then collapsed.

### State machine: `mmPhase`

```
'build'  →  'collapse'  →  'done'
   ↑             |
   └─────────────┘  (if collapseT reaches 0 via ◀)
```

### Build phase

- Steps through j-slices (or individual cells if "element-by-element" is checked).
- `t1` = current step index, `-1` = idle.
- `totalSteps1()` = `elemByElem ? J*I*K : J`.
- `decodeS1(s)` converts step number to `{j, cellI, cellK}`.
- Each step paints slices (`'empty'` → `'active'` → `'done'`) and updates 2D side grids.
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

### Timers

| Timer | Purpose | Cancel |
|-------|---------|--------|
| `tm1` (setTimeout) | Build tick + 600ms build→collapse transition | `clearTimeout(tm1)` |
| `colAnimId` (rAF) | Collapse animation frames | `cancelAnimationFrame(colAnimId)` |

### Speed

`spdMM() = 1900 - sliderValue` (slider range 100–1800). Collapse speed: `COL_SPEED = 0.0005` per ms (frame-rate independent via `dt`).

### rAF first-frame fix

`runColAnim` skips its first frame (`if (!last) { last = now; return; }`). Without this, `dt = 0` on the first call would trigger the boundary check and stop immediately.

---

## Tab 2: Dot Product (`tab-dotprod.js`)

Shows the same cube from a different perspective: each vertical column `Cube[i, :, k]` is a dot product `A[i,:] · B[:,k]`.

### Two modes

**Exploration mode** (`dpStep = -1`):
- Click any result cell `(i, k)` to select it.
- The corresponding column in the 3D cube lights up.
- A detail panel shows the full dot product breakdown.

**Animation mode** (`dpStep ≥ 0`):
- Steps through all result cells, optionally term-by-term.
- `totalSteps = dpTermByTerm ? I*K*J : I*K`.
- `dpDecodeStep(s) → {i, k, j}` for term-by-term mode.

### Collapse sync

When switching from matmul to dotprod, the collapse state `collapseT` is preserved:

```js
let savedCollapseT = collapseT;       // from matmul
setDpCollapseT(savedCollapseT);       // into dotprod
dpApplyCollapse(savedCollapseT);      // apply to cube
```

The dotprod tab has its own collapse slider and `dpCollapseT` state, but they visualize the same concept.

---

## HTML structure (`matmul-3d.html`)

### Top-level layout

```
<h1> title
<div.top-controls>      Randomize / Reset buttons
<div.mode-tabs>          Tab buttons (⓪ ① ②)
<div#ctrl-intro>         Tab 0 controls + content (hidden when inactive)
<div#ctrl-matmul>        Tab 1 controls + content (hidden when inactive)
<div#ctrl-dotprod>       Tab 2 controls + content (hidden when inactive)
```

### Key DOM IDs

| ID | Element |
|----|---------|
| `tab-intro`, `tab-matmul`, `tab-dotprod` | Mode tab buttons |
| `ctrl-intro`, `ctrl-matmul`, `ctrl-dotprod` | Tab content panels |
| `mainCanvas` | The single shared Three.js canvas |
| `mmCanvasHost`, `dpCanvasHost` | Canvas mount points (canvas moves between them) |
| `gridA`, `gridB` | A and B matrix grids (matmul tab) |
| `introDisplay` | Outer product vectors and grid (intro tab) |
| `opDisplay` | Outer product detail panel (matmul tab, elem-by-elem mode) |
| `dpMatrices` | A, B, Result grids (dotprod tab) |
| `spIntro`, `spMM`, `spDP` | Speed sliders per tab |
| `spCollapse` | Collapse slider (matmul tab) |
| `dpCollapseSlider` | Collapse slider (dotprod tab) |
| `pbIntro`, `pbMM`, `pbDP` | Play/pause buttons |
| `chkElem` | "Show outer products element by element" checkbox |
| `chkDpTerm` | "Show terms one by one" checkbox |
| `fIntro`, `fMM`, `fDP` | Formula bar text |
| `dIntro`, `dMM`, `dDP` | Step dots |
| `einsumIntro`, `einsumMatmul`, `einsumDotprod` | Einsum badge containers |
| `drawer-intro`, `drawer-dotprod` | Info drawer panels |

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
.anim                  /* Fade-in animation */
.editable              /* Click-to-edit */
```

### CSS: Layout containers

```css
.mm-row          /* Flex row: A × B = Cube. Fixed height: 460px */
.mm-mat-area     /* Matrix container. Fixed height: 280px, centers content vertically */
.mm-cube-area    /* 3D canvas container. Fixed height: 440px */
```

These use **fixed heights** (not min-height) so that controls below never shift when dimensions change.

### CSS: Animations

```css
@keyframes introCopyRight    /* 0.4s — broadcast a rightward */
@keyframes introCopyDown     /* 0.4s — broadcast b downward */
@keyframes introMulAppear    /* 0.35s — result cell appear */
@keyframes opSliceAppear     /* 0.45s — outer product slice appear */
```

---

## Window globals and HTML event wiring

HTML uses inline `onclick` handlers (e.g., `onclick="rebuild(true)"`). Since ES modules don't pollute the global scope, `app.js` explicitly assigns all handler functions to `window`:

```js
// app.js
window.rebuild = rebuild;
window.setMode = setMode;
window.toggleInfo = toggleInfo;
window.changeDim = changeDim;
// ... ~20 total
```

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
1. Clamp new dimension to [1, 4].
2. Resize A, B arrays (preserve existing values, fill new cells with `rand()`).
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
4. Rebuild 3D boxes if on a 3D tab, or clear them if on intro.
5. Re-render the current tab.

### Tab switching

`setMode(m)` in app.js:
1. Pause animations in the previous tab.
2. Toggle `.active` / `.hidden` CSS classes on tab buttons and panels.
3. If leaving intro, trigger carry-over.
4. Move canvas to the new tab's host div.
5. Initialize the new tab's state (rebuild boxes, reset animation, render).

---

## Gotchas and pitfalls

1. **`removePlusPlanes()` before `rebuildBoxes()`**: Always remove old sprites before building new boxes, or orphaned Three.js objects accumulate in the scene.

2. **`tm1` double duty**: Used for both build tick timeouts AND the 600ms build→collapse transition. `mmPauseBuild()` / `mmPauseAll()` clear it. Don't create a second timeout variable — just reuse `tm1` and always clear it first.

3. **`lastOpJ` reset**: Tracks the last displayed j-slice in the outer product panel. Must be reset to `-1` in `mmReset` and `rebuild`, or the broadcast animation won't re-trigger for the same slice.

4. **rAF first-frame skip**: Collapse animation skips the first frame because `dt=0` would immediately trigger the boundary check. Don't remove the `if (!last)` guard.

5. **`setData()` for cross-module writes**: Only shared.js can reassign its own `let` exports. If a tab module needs to update shared state, call `setData({...})`. Don't try direct assignment — it silently fails in ES modules.

6. **`resetDpState()` clears `dpCollapseT`**: If you need to preserve collapse state across a reset (e.g., when switching tabs), save the value before calling reset and restore it after.

7. **Three.js r128**: Pinned version loaded from CDN. Don't upgrade without testing. The custom orbit controls don't use `OrbitControls` from the library.

8. **`jLbl` span bug**: Don't create separate span IDs inside `innerHTML` strings that get overwritten by subsequent renders — the IDs will become stale.

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

Add to `setMode()`:

```js
if (prev === 'newview') nvPause();
document.getElementById('tab-newview').classList.toggle('active', m === 'newview');
document.getElementById('ctrl-newview').classList.toggle('hidden', m !== 'newview');

if (m === 'newview') {
  // If 3D: moveCanvasTo('nvCanvasHost');
  nvReset();
  nvRender();
  renderEinsumBadge('einsumNewview', 'newview');
}
```

Add to `rebuild()` and the `onDimChange` callback.

Assign window globals:

```js
window.nvFwd = nvFwd;
window.nvBack = nvBack;
window.nvToggle = nvToggle;
window.nvReset = nvReset;
```

### 3. Add HTML

In `matmul-3d.html`, add:

```html
<!-- Tab button -->
<button class="mode-tab" id="tab-newview" onclick="setMode('newview')">③ New View</button>

<!-- Tab panel -->
<div id="ctrl-newview" class="hidden tab-container">
  <div class="controls-row">
    <div class="playback">
      <button class="play-btn" onclick="nvBack()">◀</button>
      <button class="play-btn big" onclick="nvFwd()">▶|</button>
      <button class="play-btn" id="pbNV" onclick="nvToggle()">▶</button>
      <button class="play-btn" onclick="nvReset()">↺</button>
      <div class="slider-wrap">
        <input type="range" id="spNV" min="200" max="1200" value="200">
      </div>
    </div>
    <div class="einsum-badge" id="einsumNewview"></div>
  </div>
  <!-- If 3D: -->
  <div id="nvCanvasHost"></div>
  <!-- Tab-specific content here -->
</div>
```

### 4. Update `renderEinsumBadge` in `app.js`

Add a case for your new tab's einsum notation.

---

## Testing checklist

After any change, verify:

- [ ] All three tabs render correctly
- [ ] Dimension +/- buttons work (try 1×1×1 and 4×4×4)
- [ ] Inline cell editing (click a value, type a new one, press Enter)
- [ ] Tab switching preserves state (intro→matmul carry-over, collapse sync)
- [ ] Build animation plays, pauses, steps forward/back, resets
- [ ] Collapse animation is scrubable via slider
- [ ] ◀ during collapse reverses direction, reaches 0 and transitions back to build
- [ ] Randomize and Reset buttons work from every tab
- [ ] 3D orbit (drag to rotate) works
- [ ] Info drawer opens/closes, state persists across page reload
- [ ] No console errors
