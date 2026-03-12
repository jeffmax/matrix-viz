// ══════════════════════════════════════════════════
// EMBEDDING DATA GENERATOR
// ══════════════════════════════════════════════════

/**
 * Generate random token IDs and their one-hot representations.
 * @param {number} B batch size
 * @param {number} T sequence length
 * @param {number} V vocab size
 * @returns {{ tokenIds: number[][], X: number[][][] }}
 */
export function generateTokens(B, T, V) {
  const tokenIds = Array.from({ length: B }, () =>
    Array.from({ length: T }, () => Math.floor(Math.random() * V))
  );
  const X = tokenIds.map(seq =>
    seq.map(tok => {
      const oh = Array(V).fill(0);
      oh[tok] = 1;
      return oh;
    })
  );
  return { tokenIds, X };
}

/**
 * Generate a random embedding weight matrix.
 * @param {number} V vocab size (rows)
 * @param {number} C embedding dim (columns)
 * @returns {number[][]} V×C matrix with values 1..9
 */
export function generateEmbedding(V, C) {
  return Array.from({ length: V }, () =>
    Array.from({ length: C }, () => Math.floor(Math.random() * 9) + 1)
  );
}

/**
 * Compute forward: Y[b,t,:] = X[b,t,:] @ W = W[tokenId[b,t], :]
 * @param {number[][][]} X  one-hot (B,T,V)
 * @param {number[][]} W    embedding table (V,C)
 * @returns {number[][][]} Y (B,T,C)
 */
export function computeForward(X, W) {
  const B = X.length, T = X[0].length, V = W.length, C = W[0].length;
  return X.map(seq =>
    seq.map(oh => {
      const row = Array(C).fill(0);
      for (let v = 0; v < V; v++) {
        if (oh[v]) {
          for (let c = 0; c < C; c++) row[c] += oh[v] * W[v][c];
        }
      }
      return row;
    })
  );
}

/**
 * Generate upstream gradients (small random integers).
 * @param {number} B batch
 * @param {number} T seq length
 * @param {number} C embedding dim
 * @returns {number[][][]} G (B,T,C)
 */
export function generateGradients(B, T, C) {
  return Array.from({ length: B }, () =>
    Array.from({ length: T }, () =>
      Array.from({ length: C }, () => Math.floor(Math.random() * 9) - 4) // -4..4
    )
  );
}

/**
 * Compute backward: dW[v,c] = Σ_b Σ_t X[b,t,v] · G[b,t,c]
 * @param {number[][][]} X  one-hot (B,T,V)
 * @param {number[][][]} G  gradients (B,T,C)
 * @returns {number[][]} dW (V,C)
 */
export function computeBackward(X, G) {
  const B = X.length, T = X[0].length, V = X[0][0].length, C = G[0][0].length;
  const dW = Array.from({ length: V }, () => Array(C).fill(0));
  for (let b = 0; b < B; b++) {
    for (let t = 0; t < T; t++) {
      for (let v = 0; v < V; v++) {
        if (X[b][t][v]) {
          for (let c = 0; c < C; c++) {
            dW[v][c] += X[b][t][v] * G[b][t][c];
          }
        }
      }
    }
  }
  return dW;
}
