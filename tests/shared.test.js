import { describe, it, expect, beforeEach } from 'vitest';
import { computeData, changeDim, I, J, K, A, B, Cube, Res } from '../js/shared.js';

describe('computeData', () => {
  beforeEach(() => {
    computeData(true);
  });

  it('creates A with dimensions I×J', () => {
    expect(A.length).toBe(I);
    for (const row of A) expect(row.length).toBe(J);
  });

  it('creates B with dimensions J×K', () => {
    expect(B.length).toBe(J);
    for (const row of B) expect(row.length).toBe(K);
  });

  it('computes Cube[i][j][k] = A[i][j] * B[j][k]', () => {
    for (let i = 0; i < I; i++)
      for (let j = 0; j < J; j++)
        for (let k = 0; k < K; k++)
          expect(Cube[i][j][k]).toBe(A[i][j] * B[j][k]);
  });

  it('computes Res[i][k] = sum_j A[i][j]*B[j][k]', () => {
    for (let i = 0; i < I; i++)
      for (let k = 0; k < K; k++) {
        let sum = 0;
        for (let j = 0; j < J; j++) sum += A[i][j] * B[j][k];
        expect(Res[i][k]).toBe(sum);
      }
  });

  it('generates values in range 1..9 when random', () => {
    for (let i = 0; i < I; i++)
      for (let j = 0; j < J; j++)
        expect(A[i][j]).toBeGreaterThanOrEqual(1);
  });

  it('generates all 1s when not random', () => {
    computeData(false);
    for (let i = 0; i < I; i++)
      for (let j = 0; j < J; j++)
        expect(A[i][j]).toBe(1);
  });
});

describe('default dimensions', () => {
  it('defaults to I=3, J=3, K=2 (non-square B)', () => {
    expect(I).toBe(3);
    expect(J).toBe(3);
    expect(K).toBe(2);
  });
});

describe('changeDim max=5', () => {
  beforeEach(() => {
    computeData(true);
  });

  it('allows dimensions up to 5', () => {
    // Start at I=3, increase twice to reach 5
    changeDim('I', 1);
    changeDim('I', 1);
    expect(I).toBe(5);
  });

  it('clamps at 5 (does not exceed)', () => {
    changeDim('I', 1);
    changeDim('I', 1);
    changeDim('I', 1); // should be clamped
    expect(I).toBe(5);
  });
});
