import { describe, it, expect } from 'vitest';
import { generateTokens, generateEmbedding, computeForward, generateGradients, computeBackward } from '../js/embed-data.js';

describe('generateTokens', () => {
  it('produces valid one-hot tensors', () => {
    const { tokenIds, X } = generateTokens(2, 3, 4);
    expect(X.length).toBe(2);
    expect(X[0].length).toBe(3);
    expect(X[0][0].length).toBe(4);
    for (let b = 0; b < 2; b++) {
      for (let l = 0; l < 3; l++) {
        const oh = X[b][l];
        const sum = oh.reduce((s, v) => s + v, 0);
        expect(sum).toBe(1); // exactly one 1
        expect(oh.filter(v => v === 1).length).toBe(1);
        expect(oh.filter(v => v === 0).length).toBe(3);
      }
    }
  });

  it('token IDs are in range [0, H)', () => {
    const { tokenIds } = generateTokens(2, 3, 4);
    for (const seq of tokenIds) {
      for (const tok of seq) {
        expect(tok).toBeGreaterThanOrEqual(0);
        expect(tok).toBeLessThan(4);
      }
    }
  });

  it('one-hot matches token IDs', () => {
    const { tokenIds, X } = generateTokens(2, 3, 4);
    for (let b = 0; b < 2; b++) {
      for (let l = 0; l < 3; l++) {
        expect(X[b][l][tokenIds[b][l]]).toBe(1);
      }
    }
  });
});

describe('generateEmbedding', () => {
  it('produces H×C matrix with values 1..9', () => {
    const W = generateEmbedding(4, 3);
    expect(W.length).toBe(4);
    for (const row of W) {
      expect(row.length).toBe(3);
      for (const v of row) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(9);
      }
    }
  });
});

describe('computeForward', () => {
  it('Y[b,l,:] equals W[tokenId[b,l],:]', () => {
    const tokenIds = [[0, 2], [1, 0]];
    const X = tokenIds.map(seq => seq.map(tok => {
      const oh = [0, 0, 0];
      oh[tok] = 1;
      return oh;
    }));
    const W = [[10, 20], [30, 40], [50, 60]];
    const Y = computeForward(X, W);
    expect(Y[0][0]).toEqual([10, 20]); // token 0 → row 0
    expect(Y[0][1]).toEqual([50, 60]); // token 2 → row 2
    expect(Y[1][0]).toEqual([30, 40]); // token 1 → row 1
    expect(Y[1][1]).toEqual([10, 20]); // token 0 → row 0
  });
});

describe('computeBackward', () => {
  it('dW[h,:] = sum of G[b,l,:] for all (b,l) where token==h', () => {
    // tokens: [[0, 2], [0, 1]]
    const X = [
      [[1, 0, 0], [0, 0, 1]],
      [[1, 0, 0], [0, 1, 0]]
    ];
    const G = [
      [[1, 2], [3, 4]],
      [[5, 6], [7, 8]]
    ];
    const dW = computeBackward(X, G);
    // token 0 appears at (0,0) and (1,0): G values [1,2] + [5,6] = [6, 8]
    expect(dW[0]).toEqual([6, 8]);
    // token 1 appears at (1,1): G value [7, 8]
    expect(dW[1]).toEqual([7, 8]);
    // token 2 appears at (0,1): G value [3, 4]
    expect(dW[2]).toEqual([3, 4]);
  });

  it('rare tokens get smaller updates', () => {
    // token 0 appears 3 times, token 1 appears 0 times
    const X = [
      [[1, 0], [1, 0]],
      [[1, 0], [1, 0]]
    ];
    const G = [
      [[1, 1], [1, 1]],
      [[1, 1], [1, 1]]
    ];
    const dW = computeBackward(X, G);
    expect(dW[0]).toEqual([4, 4]); // 4 contributions
    expect(dW[1]).toEqual([0, 0]); // zero contributions
  });
});

describe('generateGradients', () => {
  it('produces B×L×C tensor with integer values', () => {
    const G = generateGradients(2, 3, 3);
    expect(G.length).toBe(2);
    expect(G[0].length).toBe(3);
    expect(G[0][0].length).toBe(3);
    for (const batch of G) {
      for (const seq of batch) {
        for (const v of seq) {
          expect(Number.isInteger(v)).toBe(true);
        }
      }
    }
  });
});
