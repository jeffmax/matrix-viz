// ══════════════════════════════════════════════════
// EMBEDDING DATA GENERATOR
// ══════════════════════════════════════════════════

/**
 * Generate random token IDs and their one-hot representations.
 * @param {number} B batch size
 * @param {number} L sequence length
 * @param {number} H vocab size
 * @returns {{ tokenIds: number[][], X: number[][][] }}
 */
export function generateTokens(B, L, H) {
  const tokenIds = Array.from({ length: B }, () =>
    Array.from({ length: L }, () => Math.floor(Math.random() * H))
  );
  const X = tokenIds.map(seq =>
    seq.map(tok => {
      const oh = Array(H).fill(0);
      oh[tok] = 1;
      return oh;
    })
  );
  return { tokenIds, X };
}

/**
 * Generate a random embedding weight matrix.
 * @param {number} H vocab size (rows)
 * @param {number} C embedding dim (columns)
 * @returns {number[][]} H×C matrix with values 1..9
 */
export function generateEmbedding(H, C) {
  return Array.from({ length: H }, () =>
    Array.from({ length: C }, () => Math.floor(Math.random() * 9) + 1)
  );
}

/**
 * Compute forward: Y[b,l,:] = X[b,l,:] @ W = W[tokenId[b,l], :]
 * @param {number[][][]} X  one-hot (B,L,H)
 * @param {number[][]} W    embedding table (H,C)
 * @returns {number[][][]} Y (B,L,C)
 */
export function computeForward(X, W) {
  const B = X.length, L = X[0].length, H = W.length, C = W[0].length;
  return X.map(seq =>
    seq.map(oh => {
      const row = Array(C).fill(0);
      for (let h = 0; h < H; h++) {
        if (oh[h]) {
          for (let c = 0; c < C; c++) row[c] += oh[h] * W[h][c];
        }
      }
      return row;
    })
  );
}

/**
 * Generate upstream gradients (small random integers).
 * @param {number} B batch
 * @param {number} L seq length
 * @param {number} C embedding dim
 * @returns {number[][][]} G (B,L,C)
 */
export function generateGradients(B, L, C) {
  return Array.from({ length: B }, () =>
    Array.from({ length: L }, () =>
      Array.from({ length: C }, () => Math.floor(Math.random() * 9) - 4) // -4..4
    )
  );
}

/**
 * Compute backward: dW[h,c] = Σ_b Σ_l X[b,l,h] · G[b,l,c]
 * @param {number[][][]} X  one-hot (B,L,H)
 * @param {number[][][]} G  gradients (B,L,C)
 * @returns {number[][]} dW (H,C)
 */
export function computeBackward(X, G) {
  const B = X.length, L = X[0].length, H = X[0][0].length, C = G[0][0].length;
  const dW = Array.from({ length: H }, () => Array(C).fill(0));
  for (let b = 0; b < B; b++) {
    for (let l = 0; l < L; l++) {
      for (let h = 0; h < H; h++) {
        if (X[b][l][h]) {
          for (let c = 0; c < C; c++) {
            dW[h][c] += X[b][l][h] * G[b][l][c];
          }
        }
      }
    }
  }
  return dW;
}
