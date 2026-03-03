// ══════════════════════════════════════════════════
// EINSUM SPEC PARSER & COMPUTE
// ══════════════════════════════════════════════════

/**
 * Parse an einsum signature string with dimension sizes.
 *
 * @param {string} sig  e.g. 'blh,hc->blc'
 * @param {Object} dims e.g. {b:2, l:3, h:4, c:3}
 * @returns {Object} parsed spec
 */
export function parseEinsum(sig, dims) {
  const m = sig.match(/^([a-z,]+)->([a-z]*)$/);
  if (!m) throw new Error(`Invalid einsum signature: ${sig}`);

  const inputStrs = m[1].split(',');
  const outputStr = m[2];

  // Collect all indices that appear in inputs
  const allSet = new Set();
  const inputs = inputStrs.map(s => {
    const indices = s.split('');
    for (const idx of indices) {
      if (!(idx in dims)) throw new Error(`Unknown dimension '${idx}' in signature '${sig}'`);
      allSet.add(idx);
    }
    return { indices, shape: indices.map(i => dims[i]) };
  });

  // Output indices
  const outputIndices = outputStr.split('');
  for (const idx of outputIndices) {
    if (!allSet.has(idx)) throw new Error(`Output index '${idx}' not found in inputs`);
  }

  const outputSet = new Set(outputIndices);
  const free = outputIndices.slice();
  const contracted = [...allSet].filter(i => !outputSet.has(i));
  // Sort contracted to a stable order (alphabetical)
  contracted.sort();
  const allIndices = [...new Set([...free, ...contracted])];

  return {
    signature: sig,
    inputs,
    output: { indices: outputIndices, shape: outputIndices.map(i => dims[i]) },
    contracted,
    free,
    allIndices,
    intermediateRank: allIndices.length,
    dims: { ...dims },
  };
}

/**
 * Compute the einsum output from input tensors.
 * Tensors are nested arrays matching the shapes in spec.inputs.
 *
 * @param {Object} spec  from parseEinsum()
 * @param {Array[]} inputData  array of tensors (nested arrays)
 * @returns {Array} output tensor (nested array matching spec.output.shape)
 */
export function computeEinsum(spec, inputData) {
  const { inputs, output, contracted, dims } = spec;

  // Helper: get value from a nested array given index assignment
  function getValue(tensor, indices, assignment) {
    let val = tensor;
    for (const idx of indices) {
      val = val[assignment[idx]];
    }
    return val;
  }

  // Helper: iterate over all assignments for a set of indices
  function* iterateIndices(idxList) {
    if (idxList.length === 0) { yield {}; return; }
    const [first, ...rest] = idxList;
    const size = dims[first];
    for (let v = 0; v < size; v++) {
      for (const sub of iterateIndices(rest)) {
        yield { [first]: v, ...sub };
      }
    }
  }

  // Build output tensor
  function buildOutput(outIndices, depth, assignment) {
    if (depth === outIndices.length) {
      // Sum over contracted indices
      let sum = 0;
      for (const cAssign of iterateIndices(contracted)) {
        const fullAssign = { ...assignment, ...cAssign };
        let product = 1;
        for (let t = 0; t < inputs.length; t++) {
          product *= getValue(inputData[t], inputs[t].indices, fullAssign);
        }
        sum += product;
      }
      return sum;
    }
    const idx = outIndices[depth];
    const size = dims[idx];
    const result = [];
    for (let v = 0; v < size; v++) {
      assignment[idx] = v;
      result.push(buildOutput(outIndices, depth + 1, assignment));
    }
    delete assignment[idx];
    return result;
  }

  // Handle scalar output (no output indices)
  if (output.indices.length === 0) {
    return buildOutput(output.indices, 0, {});
  }

  return buildOutput(output.indices, 0, {});
}
