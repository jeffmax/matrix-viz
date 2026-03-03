import { describe, it, expect } from 'vitest';
import { parseEinsum, computeEinsum } from '../js/einsum-spec.js';

describe('parseEinsum', () => {
  it('parses embedding forward: blh,hc->blc', () => {
    const spec = parseEinsum('blh,hc->blc', { b: 2, l: 3, h: 4, c: 3 });
    expect(spec.signature).toBe('blh,hc->blc');
    expect(spec.inputs).toHaveLength(2);
    expect(spec.inputs[0].indices).toEqual(['b', 'l', 'h']);
    expect(spec.inputs[0].shape).toEqual([2, 3, 4]);
    expect(spec.inputs[1].indices).toEqual(['h', 'c']);
    expect(spec.inputs[1].shape).toEqual([4, 3]);
    expect(spec.output.indices).toEqual(['b', 'l', 'c']);
    expect(spec.output.shape).toEqual([2, 3, 3]);
    expect(spec.contracted).toEqual(['h']);
    expect(spec.free).toEqual(['b', 'l', 'c']);
    expect(spec.intermediateRank).toBe(4);
  });

  it('parses matmul: ij,jk->ik', () => {
    const spec = parseEinsum('ij,jk->ik', { i: 3, j: 3, k: 3 });
    expect(spec.contracted).toEqual(['j']);
    expect(spec.free).toEqual(['i', 'k']);
    expect(spec.output.shape).toEqual([3, 3]);
  });

  it('parses embedding backward: blh,blc->hc', () => {
    const spec = parseEinsum('blh,blc->hc', { b: 2, l: 3, h: 4, c: 3 });
    expect(spec.contracted).toEqual(['b', 'l']);
    expect(spec.free).toEqual(['h', 'c']);
    expect(spec.output.shape).toEqual([4, 3]);
  });

  it('parses transpose: ij->ji', () => {
    const spec = parseEinsum('ij->ji', { i: 2, j: 3 });
    expect(spec.inputs).toHaveLength(1);
    expect(spec.contracted).toEqual([]);
    expect(spec.free).toEqual(['j', 'i']);
    expect(spec.output.shape).toEqual([3, 2]);
  });

  it('parses dot product to scalar: i,i->', () => {
    const spec = parseEinsum('i,i->', { i: 3 });
    expect(spec.contracted).toEqual(['i']);
    expect(spec.free).toEqual([]);
    expect(spec.output.indices).toEqual([]);
    expect(spec.output.shape).toEqual([]);
  });

  it('rejects invalid signature', () => {
    expect(() => parseEinsum('bad format', { i: 2 })).toThrow();
  });

  it('rejects unknown dimension', () => {
    expect(() => parseEinsum('ij->ij', { i: 2 })).toThrow(/Unknown dimension/);
  });

  it('rejects output index not in inputs', () => {
    expect(() => parseEinsum('ij->ik', { i: 2, j: 3, k: 4 })).toThrow(/not found in inputs/);
  });
});

describe('computeEinsum', () => {
  it('computes matmul ij,jk->ik', () => {
    const spec = parseEinsum('ij,jk->ik', { i: 2, j: 2, k: 2 });
    const A = [[1, 2], [3, 4]];
    const B = [[5, 6], [7, 8]];
    const result = computeEinsum(spec, [A, B]);
    // [1*5+2*7, 1*6+2*8] = [19, 22]
    // [3*5+4*7, 3*6+4*8] = [43, 50]
    expect(result).toEqual([[19, 22], [43, 50]]);
  });

  it('computes outer product i,k->ik', () => {
    const spec = parseEinsum('i,k->ik', { i: 3, k: 2 });
    const a = [2, 3, 5];
    const b = [7, 11];
    const result = computeEinsum(spec, [a, b]);
    expect(result).toEqual([[14, 22], [21, 33], [35, 55]]);
  });

  it('computes dot product i,i->', () => {
    const spec = parseEinsum('i,i->', { i: 3 });
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const result = computeEinsum(spec, [a, b]);
    // 1*4 + 2*5 + 3*6 = 32
    expect(result).toBe(32);
  });

  it('computes transpose ij->ji', () => {
    const spec = parseEinsum('ij->ji', { i: 2, j: 3 });
    const A = [[1, 2, 3], [4, 5, 6]];
    const result = computeEinsum(spec, [A]);
    expect(result).toEqual([[1, 4], [2, 5], [3, 6]]);
  });

  it('computes embedding forward blh,hc->blc', () => {
    const spec = parseEinsum('blh,hc->blc', { b: 1, l: 2, h: 3, c: 2 });
    // one-hot X: batch=1, seq=2, vocab=3
    // token 0 at pos 0, token 2 at pos 1
    const X = [[[1, 0, 0], [0, 0, 1]]];
    const W = [[10, 20], [30, 40], [50, 60]];
    const result = computeEinsum(spec, [X, W]);
    // Y[0,0,:] = X[0,0,:] @ W = [1,0,0] @ W = [10, 20]
    // Y[0,1,:] = X[0,1,:] @ W = [0,0,1] @ W = [50, 60]
    expect(result).toEqual([[[10, 20], [50, 60]]]);
  });

  it('computes embedding backward blh,blc->hc', () => {
    const spec = parseEinsum('blh,blc->hc', { b: 1, l: 2, h: 3, c: 2 });
    // one-hot X: token 0 at pos 0, token 2 at pos 1
    const X = [[[1, 0, 0], [0, 0, 1]]];
    const G = [[[1, 2], [3, 4]]];
    const result = computeEinsum(spec, [X, G]);
    // dW[0,:] = G[0,0,:] = [1, 2]  (only pos 0 has token 0)
    // dW[1,:] = [0, 0]              (no positions have token 1)
    // dW[2,:] = G[0,1,:] = [3, 4]  (only pos 1 has token 2)
    expect(result).toEqual([[1, 2], [0, 0], [3, 4]]);
  });

  it('matches computeData for matmul', () => {
    // Verify against the existing computeData logic
    const spec = parseEinsum('ij,jk->ik', { i: 3, j: 3, k: 3 });
    const A = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const B = [[9, 8, 7], [6, 5, 4], [3, 2, 1]];
    const result = computeEinsum(spec, [A, B]);
    // Verify each cell manually
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 3; k++) {
        let sum = 0;
        for (let j = 0; j < 3; j++) sum += A[i][j] * B[j][k];
        expect(result[i][k]).toBe(sum);
      }
    }
  });
});
