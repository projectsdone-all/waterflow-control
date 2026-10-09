// ─────────────────────────────────────────────────────────────────────────────
// Isolation Forest — Liu, Ting & Zhou (2008), implemented from scratch.
//
// Anomalies are "few and different", so they get isolated by random splits
// in fewer steps than normal points. The anomaly score is
//     s(x, n) = 2^( -E[h(x)] / c(n) )
// where h(x) is the path length of x in one isolation tree, E[h(x)] its mean
// over all trees, and c(n) the average path length of an unsuccessful BST
// search — used to normalise. s → 1 means anomaly, s ≈ 0.5 or lower is normal.
// Same algorithm and defaults as scikit-learn's IsolationForest
// (n_estimators = 100, max_samples = 256).
// ─────────────────────────────────────────────────────────────────────────────

type Node =
  | { leaf: true; size: number }
  | { leaf: false; feature: number; split: number; left: Node; right: Node };

const EULER = 0.5772156649;

/** Average path length of an unsuccessful search in a BST with n nodes */
export function cFactor(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER) - (2 * (n - 1)) / n;
}

// small seeded PRNG so a trained model is reproducible
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface IFOptions { nTrees?: number; sampleSize?: number; seed?: number }

export class IsolationForest {
  private trees: Node[] = [];
  private psi = 256;
  private maxDepth = 8;
  readonly nTrees: number;
  readonly sampleSize: number;
  private rand: () => number;
  nFeatures = 0;
  trainedOn = 0;

  constructor(opts: IFOptions = {}) {
    this.nTrees = opts.nTrees ?? 100;
    this.sampleSize = opts.sampleSize ?? 256;
    this.rand = mulberry32(opts.seed ?? 42);
  }

  fit(X: number[][]): this {
    this.trainedOn = X.length;
    this.nFeatures = X[0]?.length ?? 0;
    this.psi = Math.min(this.sampleSize, X.length);
    this.maxDepth = Math.ceil(Math.log2(Math.max(2, this.psi)));
    this.trees = [];
    for (let t = 0; t < this.nTrees; t++) {
      const sample: number[][] = [];
      for (let i = 0; i < this.psi; i++) sample.push(X[Math.floor(this.rand() * X.length)]);
      this.trees.push(this.build(sample, 0));
    }
    return this;
  }

  private build(X: number[][], depth: number): Node {
    if (depth >= this.maxDepth || X.length <= 1) return { leaf: true, size: X.length };
    // choose a random feature that actually varies in this node
    const candidates: number[] = [];
    const mins: number[] = [], maxs: number[] = [];
    for (let f = 0; f < this.nFeatures; f++) {
      let mn = Infinity, mx = -Infinity;
      for (const row of X) { if (row[f] < mn) mn = row[f]; if (row[f] > mx) mx = row[f]; }
      mins[f] = mn; maxs[f] = mx;
      if (mx > mn) candidates.push(f);
    }
    if (!candidates.length) return { leaf: true, size: X.length };
    const feature = candidates[Math.floor(this.rand() * candidates.length)];
    const split = mins[feature] + this.rand() * (maxs[feature] - mins[feature]);
    const L: number[][] = [], R: number[][] = [];
    for (const row of X) (row[feature] < split ? L : R).push(row);
    return { leaf: false, feature, split, left: this.build(L, depth + 1), right: this.build(R, depth + 1) };
  }

  private pathLength(x: number[], node: Node, depth: number): number {
    if (node.leaf) return depth + cFactor(node.size);
    return this.pathLength(x, x[node.feature] < node.split ? node.left : node.right, depth + 1);
  }

  /** Mean path length across all trees */
  meanPath(x: number[]): number {
    let s = 0;
    for (const t of this.trees) s += this.pathLength(x, t, 0);
    return s / this.trees.length;
  }

  /** Anomaly score in (0, 1]; higher = more anomalous */
  score(x: number[]): number {
    if (!this.trees.length) return 0.5;
    return Math.pow(2, -this.meanPath(x) / cFactor(this.psi));
  }

  /**
   * How much each feature is responsible for isolating x quickly:
   * counts the splits on each feature along x's path, weighted by how early
   * they happen. Used for the "why was this flagged" explanation.
   */
  featureContributions(x: number[]): number[] {
    const out = new Array(this.nFeatures).fill(0);
    for (const t of this.trees) {
      let node = t, depth = 0;
      while (!node.leaf) {
        out[node.feature] += 1 / (depth + 1);
        node = x[node.feature] < node.split ? node.left : node.right;
        depth++;
      }
    }
    const sum = out.reduce((a, b) => a + b, 0) || 1;
    return out.map(v => v / sum);
  }
}
