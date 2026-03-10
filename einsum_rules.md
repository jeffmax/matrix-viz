# Comprehensive Rules for Einsum Notation

> **The single master rule:** einsum iterates over all index combinations, multiplies the corresponding elements, and sums over any index not in the output.

---

## 1. Basic Syntax

The general form is: `"inputs -> output"`, where inputs are comma-separated index strings for each operand.

- `"ij,jk->ik"` — two inputs, explicit output
- One operand or many operands are both valid

---

## 2. Index Letters

Each letter represents one axis (dimension) of a tensor. The size of that dimension must be consistent wherever the letter appears.

- `"ij,jk->ik"` requires the `j` dimension to match in both tensors

---

## 3. Free Indices (output indices)

Any index that appears on the right side of `->` is a **free index** — it survives into the output. The output tensor has one dimension for each free index, in the order written.

---

## 4. Dummy / Contracted Indices (summed indices)

Any index that appears in the input(s) but **not** in the output is a **dummy index** — it gets summed over (contracted). This is where the actual computation happens.

- `"ij,jk->ik"`: `j` is dummy → summed → matrix multiply
- `"ij->i"`: `j` is dummy → summed → row sums

---

## 5. Repeated Index Within a Single Operand → Diagonal Selection

When the same letter appears twice in a single operand's index string, einsum **constrains to the diagonal** along those axes — only elements where both positions are equal are considered.

- `"ii->i"`: selects diagonal elements → returns a vector
- `"ii->"`: selects diagonal, then sums → trace

This constraint is independent of whether the index ends up being free or dummy; it always applies first.

---

## 6. Shared Index Across Multiple Operands → Element Alignment

When the same letter appears in two different operands, those operands are **aligned along that dimension** before multiplying. Whether the index is then summed or kept depends on whether it appears in the output.

- In output → element-wise multiply along that axis (kept)
- Not in output → multiply and sum (contracted)

---

## 7. The Optional Arrow (`->`)

**With explicit `->`)**: You fully control which indices appear in the output and in what order. Any index not listed is summed. You can even specify an empty output (`"->"`) to sum everything to a scalar.

**Without `->` (implicit mode)**: The output is inferred by this rule:
- **Include** each index that appears **exactly once** across all inputs, in **alphabetical order**
- **Exclude** (sum over) any index that appears more than once

Examples of the implicit rule:

| Expression | Result |
|---|---|
| `"ijk"` | Each letter appears once → output is `ijk` → identity |
| `"ij,jk"` | `j` appears twice → summed; output is `ik` → matrix multiply |
| `"ii"` | `i` appears twice → summed → trace (scalar) |

---

## 8. Batch / Spectator Indices

An index that appears in multiple operands **and** in the output is a "batch" or "spectator" index — it's kept, and the operation is performed independently for each value of that index. No summation, no diagonal constraint (assuming it appears only once per operand).

- `"bij,bjk->bik"`: `b` is a batch index → batched matrix multiply

---

## 9. Output Ordering Is Explicit

When you use `->`, the order of indices in the output string determines the shape of the result. This lets you transpose implicitly.

- `"ij->ji"` → transpose
- `"ijk,kl->ilj"` → contract `k`, reorder remaining axes as `i`, `l`, `j`

---

## 10. No Repeated Index in the Output

A given letter should appear **at most once** in the output string. Having it twice would be ambiguous.

---

## Quick Reference Table

| Expression | What happens |
|---|---|
| `"ij->ij"` | Identity (pass through) |
| `"ij->ji"` | Transpose |
| `"ij->i"` | Sum along `j` (row sums) |
| `"ij->"` | Sum all elements → scalar |
| `"ii->i"` | Diagonal of matrix |
| `"ii->"` or `"ii"` | Trace |
| `"ij,jk->ik"` | Matrix multiply |
| `"ij,ij->ij"` | Element-wise multiply |
| `"ij,ij->i"` | Row-wise dot products |
| `"ij,ij->"` | Full dot product (sum of element-wise products) |
| `"i,j->ij"` | Outer product |
| `"i,i->"` | Dot product |
| `"i,i->i"` | Element-wise multiply (1D) |
| `"bij,bjk->bik"` | Batched matrix multiply |
| `"ij,kj->ik"` | Matrix multiply with implicit transpose (`a @ b.T`) |


## Links

* https://einsum.joelburget.com/
* [Einsum Puzzles in the spirit of Srush's Tensor Puzzles](https://github.com/pixqc/einsum-puzzles) - Open in [Colab](https://colab.research.google.com/github/pixqc/einsum-puzzles/blob/master/main.ipynb)
