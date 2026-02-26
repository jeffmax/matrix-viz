# MatMul Visualizer — Project Context for Claude Code

## What this is

An interactive 3D visualization of matrix multiplication using Three.js (r128). The goal is to help people doing Karpathy's *nn-zero-to-hero* course (and similar) develop deep geometric intuition for matrix multiplication — not just the algorithm, but the underlying structure that matters for understanding attention, backprop, and linear layers.

## Running locally

```bash
npm start          # serves on http://localhost:3000
# open http://localhost:3000/matmul-3d.html
```

ES modules require a local server — `file://` won't work due to CORS.

## File structure

```
matmul-3d.html          HTML + CSS (no inline JS)
js/
  shared.js             Global state (I,J,K, A,B,Cube,Res), dimensions, utilities, callback registry
  scene.js              Three.js scene, camera, custom orbit controls, render loop
  cube-manager.js       3D box mesh management, paint functions, plus planes
  tab-intro.js          Tab 0: Outer Product intro (2D, no Three.js)
  tab-matmul.js         Tab 1: Matrix Multiply — Build & Collapse (3D)
  tab-dotprod.js        Tab 2: Dot Product view (3D)
  app.js                Entry point: mode switching, rebuild, einsum badge, window globals
package.json            Dev server (serve), test script
vitest.config.js        Vitest config (jsdom environment)
tests/
  setup.js              DOM stubs, THREE.js mock, canvas mock
  shared.test.js        computeData correctness tests
  tab-intro.test.js     Tab 0 regression tests (double-play bug)
  tab-matmul.test.js    Tab 1 regression tests (highlight timer bug)
  tab-dotprod.test.js   Tab 2 regression tests (cell selection, checkbox)
.gitignore              node_modules/
```

### Import graph (no circular dependencies)

```
shared.js        ← scene.js, cube-manager.js, tab-intro.js, tab-matmul.js, tab-dotprod.js, app.js
scene.js         ← cube-manager.js, tab-matmul.js, tab-dotprod.js, app.js
cube-manager.js  ← tab-matmul.js, tab-dotprod.js, app.js
tab-intro.js     ← app.js
tab-matmul.js    ← app.js
tab-dotprod.js   ← app.js
```

### Key patterns

- **ES module live bindings**: `export let I, J, K` in shared.js — importers always see current values. Only shared.js can reassign; other modules use `setData()` for bulk updates.
- **Callback registry**: shared.js fires `tabCallbacks.onDimChange()` / `tabCallbacks.onRecompute()` without importing tab modules. app.js registers the handlers via `registerCallbacks()`.
- **Window globals**: HTML onclick handlers call `window.functionName`. app.js assigns all needed functions to `window`.
- **Three.js as global**: Loaded via `<script>` tag before the ES module. Accessed as `THREE` (global).

## Workflow rules

- **Always commit after any non-trivial change** before telling the user you're done. Don't leave uncommitted work.
- **Run syntax checks** before committing — the pre-commit hook will catch JS errors, but verify manually if making broad changes.

## Testing

```bash
npm test           # runs vitest (14 tests across 4 files)
```

- **Framework**: Vitest with jsdom environment
- **Setup**: `tests/setup.js` mocks THREE.js, canvas context, and builds all required DOM elements
- **Key rule**: Never import `app.js` in tests — it runs `rebuild(true)` + `setMode('intro')` at module init. Import individual modules directly.
- **Testable exports**: Functions marked `/* @testable */` are exported primarily for testing (e.g., `getOpHiTm`, `getDpState`, `dpTermByTerm`, `introAnimDuration`)
- **Writing new tests**: Add regression tests for bugs, put them in `tests/tab-*.test.js`

## Pre-commit hook

`.git/hooks/pre-commit` validates all `js/*.js` files with `node --input-type=module --check` and runs `npm test`. Catches syntax errors and regressions before commit.

## How to add a new tab

1. Create `js/tab-newtab.js` — import from `shared.js`, `scene.js`, `cube-manager.js` as needed
2. Export render/reset/pause/step functions
3. In `app.js`: import the new tab's exports, add to `setMode()` switch, register any callbacks, assign window globals
4. In `matmul-3d.html`: add a `.mode-tab` button, a `ctrl-newtab` controls div, and a canvas host div if it uses 3D

## Architecture

- **Single canvas / single Three.js scene** shared across tabs (important — switching tabs must not cause a jarring view change)
- **Three tabs:**
  - ⓪ Outer Product — a ⊗ b (2D intro: broadcast animation, hover interaction)
  - ① Matrix Multiply — Build & Collapse (unified: builds cube slice by slice, then collapses via scrubable animation)
  - ② Dot Product — row·column view for each result cell
- All 3D state lives in `boxes[i][j][k]` — mesh, edges, value sprite per cell
- Collapse animation driven by `collapseT ∈ [0,1]` — pure function `applyCollapse(t)` so it's scrubable and reversible
- Outer product display panel shows A[:,j] ⊗ B[j,:] for each active slice:
  - **Whole-slice mode** (elem-by-elem unchecked): broadcast animation — A column copies rightward, B row copies downward, result grid appears with staggered orange→green animation
  - **Element-by-element mode**: column vector, row vector, and result grid with current cell highlighted
- **Tab ⓪ → ① carry-over**: switching from intro to matmul sets A = the intro's outer product (introA ⊗ introB), J = len(introB), B randomized. The user sees their outer product become the A matrix.

## Key design decisions made so far

- One Three.js scene for all tabs — no jarring transitions when switching
- Speed slider: left = slow, right = fast (not reversed)
- Element-by-element checkbox applies to ALL j-slices, not just the first
- **Tabs ① and ② merged into a single "Matrix Multiply — Build & Collapse" tab** with a `mmPhase` state machine (`'build'` → `'collapse'` → `'done'`). Build auto-transitions to collapse after 600ms pause. Pressing ◀ during collapse reverses; if collapseT reaches 0, transitions back to build phase.
- Collapse slider (labeled "stacked" / "summed") appears after build completes, scrubs collapse position
- Step dots show one dot per j-slice (not per cell) to avoid clutter
- Max dimensions: I, J, K ∈ [1, 4] to keep performance smooth
- **3D axis mapping**: k→X (horizontal), j→Y (vertical/collapse axis), i→Z (depth). This makes the 3D cube slices visually align with the 2D outer product grid below (k=columns left-to-right, i=rows top-to-bottom from the overhead camera angle)

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

## Suggested tab order for the unified app

```
⓪ Outer Product — a ⊗ b         (DONE — 2D broadcast animation intro, carries over to matmul tab)
① Matrix Multiply — Build & Collapse  (DONE — unified 3D build + collapse with broadcast display)
② Matrix-vector: y = A @ x       (column mixing, sliders, information flow)
③ Dot product: row · column       (standard algorithm view)
④ Rank-1 sum: accumulating outer products   (2D heatmap panels, additive accumulator)
⑤ Bilinear scores → attention              (stretch goal, deep learning payoff)
```

The narrative arc: *what an outer product is → how matmul builds and collapses a cube of them → what a matrix does to a vector → the standard algorithm → the additive accumulation story → why this matters for transformers.*

Note: ⓪, ②, ③, ④ are pure 2D (no Three.js). ① is the existing 3D work. This means Three.js complexity is isolated to one tab.

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

## User / learning context

Jeff is working through Karpathy's nn-zero-to-hero, currently on makemore part 4 (manual backprop through MLPs). Primary goal is deep intuitive understanding of the math, not just working code. Particularly interested in the "why" behind operations — einsum, outer products, gradient flow. This visualization project is a direct companion to that learning.
