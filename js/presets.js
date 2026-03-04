// ══════════════════════════════════════════════════
// PRESETS — Named matrix multiply examples
// ══════════════════════════════════════════════════

export const PRESETS = [
  {
    id: 'basic',
    label: 'Basic 2×3 · 3×2',
    desc: `<strong>Standard multiplication.</strong> Each cell C[i,j] is the dot product of row i of A and column j of B. Hover over any result cell to see the computation.`,
    A: [[1, 2, 3],
        [4, 5, 6]],
    B: [[7, 8],
        [9, 10],
        [11, 12]],
    labelA: 'A',
    labelB: 'B',
  },
  {
    id: 'identity',
    label: 'Identity',
    desc: `<strong>Identity matrix: I @ B = B.</strong> Multiplying by the identity matrix leaves B unchanged. Each row of I has a single 1 that "selects" the corresponding row of B. This is the matrix equivalent of multiplying by 1.`,
    A: [[1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]],
    B: [[5, 3, 1],
        [8, 6, 2],
        [4, 7, 9]],
    labelA: 'I',
    labelB: 'B',
  },
  {
    id: 'row-select',
    label: 'Row Selection',
    desc: `<strong>Row selection: S @ B picks rows from B.</strong> Matrix S has a single 1 in each row indicating which row of B to select. Here we pick rows [2, 0, 2] — row 2, then row 0, then row 2 again. This is equivalent to <code>B[[2, 0, 2], :]</code> in NumPy.`,
    A: [[0, 0, 1],
        [1, 0, 0],
        [0, 0, 1]],
    B: [[5, 3, 1],
        [8, 6, 2],
        [4, 7, 9]],
    labelA: 'S',
    labelB: 'B',
  },
  {
    id: 'permute',
    label: 'Permutation',
    desc: `<strong>Permutation matrix: P @ B reorders rows.</strong> A permutation matrix is a rearranged identity — each row and column has exactly one 1. Here P reverses the row order of B (row 2 → row 0, row 1 → row 1, row 0 → row 2). Equivalent to <code>B[::-1, :]</code>.`,
    A: [[0, 0, 1],
        [0, 1, 0],
        [1, 0, 0]],
    B: [[1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]],
    labelA: 'P',
    labelB: 'B',
  },
  {
    id: 'sum-rows',
    label: 'Sum Rows',
    desc: `<strong>Row sum: 𝟏ᵀ @ B sums all rows.</strong> A row vector of all ones, when multiplied by B, produces the column-wise sum of B. Each result element is the sum of one column. This is <code>B.sum(axis=0)</code>.`,
    A: [[1, 1, 1]],
    B: [[1, 2],
        [3, 4],
        [5, 6]],
    labelA: '𝟏ᵀ',
    labelB: 'B',
  },
  {
    id: 'sum-cols',
    label: 'Sum Columns',
    desc: `<strong>Column sum: B @ 𝟏 sums all columns.</strong> Multiplying B on the right by a column vector of ones sums each row. The result is a column vector of row sums. This is <code>B.sum(axis=1)</code>.`,
    A: [[1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]],
    B: [[1],
        [1],
        [1]],
    labelA: 'B',
    labelB: '𝟏',
  },
  {
    id: 'average',
    label: 'Average Rows',
    desc: `<strong>Row average via matrix multiply.</strong> A row of [1/3, 1/3, 1/3] left-multiplied by B computes the mean of each column. This is <code>B.mean(axis=0)</code>. The averaging matrix distributes equal weight to every row.`,
    A: [[0.33, 0.33, 0.33]],
    B: [[3, 6],
        [9, 12],
        [6, 3]],
    labelA: 'avg',
    labelB: 'B',
  },
  {
    id: 'mask-upper',
    label: 'Cumulative Sum',
    desc: `<strong>Causal mask / cumulative sum.</strong> The lower-triangular matrix of ones, when applied as <code>L @ B</code>, makes each output row i the sum of rows 0..i of B. This computes a cumulative sum (prefix sum) along the rows — the basis of causal attention masks in transformers.`,
    A: [[1, 0, 0, 0],
        [1, 1, 0, 0],
        [1, 1, 1, 0],
        [1, 1, 1, 1]],
    B: [[1, 2],
        [3, 4],
        [5, 6],
        [7, 8]],
    labelA: 'L',
    labelB: 'B',
  },
  {
    id: 'projection',
    label: 'Projection',
    desc: `<strong>Projection: P @ v drops a dimension.</strong> A projection matrix zeros out one or more coordinates. Here P keeps x and z but zeros y, projecting 3D points onto the xz-plane. <code>P @ v</code> is a lossy, idempotent operation (P @ P = P).`,
    A: [[1, 0, 0],
        [0, 0, 0],
        [0, 0, 1]],
    B: [[3],
        [7],
        [5]],
    labelA: 'P',
    labelB: 'v',
  },
  {
    id: 'outer',
    label: 'Outer Product',
    desc: `<strong>Outer product: a ⊗ b = a @ bᵀ.</strong> A column vector times a row vector produces a rank-1 matrix where element [i,j] = a[i] × b[j]. This is the building block of attention scores and appears throughout linear algebra.`,
    A: [[1],
        [2],
        [3]],
    B: [[4, 5, 6]],
    labelA: 'a',
    labelB: 'bᵀ',
  },
  {
    id: 'roll',
    label: 'Circular Shift',
    desc: `<strong>Circular shift: R @ v rolls elements by 1 position.</strong> A shifted permutation matrix cyclically rotates the elements of a vector (or rows of a matrix). This is <code>np.roll(v, 1)</code>. Useful in convolutions and circular buffers.`,
    A: [[0, 0, 0, 1],
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0]],
    B: [[10],
        [20],
        [30],
        [40]],
    labelA: 'R',
    labelB: 'v',
  },
];

export let activePreset = null;

export function loadPreset(id) {
  const preset = PRESETS.find(p => p.id === id);
  if (!preset) return null;
  activePreset = preset;
  const A = preset.A.map(row => [...row]);
  const B = preset.B.map(row => [...row]);
  const I = A.length;
  const J = A[0].length;
  const K = B[0].length;
  return { A, B, I, J, K, labelA: preset.labelA, labelB: preset.labelB, desc: preset.desc };
}

export function clearPreset() {
  activePreset = null;
}
