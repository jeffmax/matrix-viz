# Matrix Multiplication: Multiple Perspectives

An interactive visualization that builds geometric intuition for matrix multiplication. Instead of showing just the standard row-times-column algorithm, it reveals the underlying structure — outer products, rank-1 sums, the 3D cube, and how it all connects to embeddings and attention in deep learning.

Built as a companion to Karpathy's [nn-zero-to-hero](https://karpathy.ai/zero-to-hero.html) course.

**[Try it live](https://jeffmax.io/matrix.html)** (single self-contained HTML file, no dependencies)

## What's inside

- **Inner Product** — step through `a · b = Σ a[i]×b[i]` with editable vectors
- **Outer Product** — watch `a ⊗ b` broadcast into a matrix
- **Matrix Multiply** — 3D cube visualization with two build modes:
  - *Outer product*: J rank-1 slices that collapse into the result
  - *Dot product*: cell-by-cell row·column computation
  - Interactive exploration, collapse slider, 11 named presets (identity, row selection, one-hot lookup, etc.)
- **Embedding Forward** — `Y = X @ W` one-hot row selection (einsum: `btv,vc→btc`)
- **Embedding Backward** — `dW = Xᵀ @ G` gradient accumulation (einsum: `btv,btc→vc`)

Einsum notation is a guiding thread throughout.

## Running locally

```bash
npm install
npm start          # serves on http://localhost:3000
```

Then open http://localhost:3000/matmul-3d.html

## Building

```bash
npm run build      # produces matrix.html (~717 KB, fully self-contained)
```

## Testing

```bash
npm test           # unit tests (Vitest, 155 tests)
npm run test:e2e   # browser tests (Playwright, 111 tests)
```

## Contributing

Contributions are welcome! Whether it's bug fixes, new visualization perspectives, improved explanations, or test coverage — open an issue or submit a PR.

## License

[CC BY-NC 4.0](LICENSE) — free to use, share, and adapt for non-commercial purposes with attribution.
