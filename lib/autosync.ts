// Automatic sentence timing from the audio alone (no speech recognition needed).
//
// 1. Measure loudness every 10 ms and find the pauses (quiet stretches) in the narration.
// 2. Choose, for every sentence boundary, the pause that best fits the expected sentence lengths
//    (dynamic programming: longer pauses and natural sentence durations are preferred).
//
// Accuracy is usually within a few tenths of a second for clear narration; always review the result.

export interface Pause {
  start: number;
  end: number;
}

export interface Timing {
  start: number;
  end: number;
}

const HOP = 0.01; // seconds per energy frame

/** Loudness (dB) per 10 ms frame. */
export function frameEnergy(samples: Float32Array, sampleRate: number): Float32Array {
  const hop = Math.max(1, Math.round(sampleRate * HOP));
  const win = hop * 2;
  const frames = Math.max(0, Math.floor((samples.length - win) / hop) + 1);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const off = f * hop;
    for (let i = 0; i < win; i++) {
      const v = samples[off + i];
      sum += v * v;
    }
    out[f] = 10 * Math.log10(sum / win + 1e-10);
  }
  return out;
}

function percentile(values: Float32Array, p: number): number {
  const sorted = Array.from(values).sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))] ?? -100;
}

/** Find quiet stretches of at least `minPause` seconds, plus where speech starts and ends. */
export function detectPauses(db: Float32Array, minPause = 0.12): { pauses: Pause[]; speechStart: number; speechEnd: number } {
  const floor = percentile(db, 0.05);
  const speech = percentile(db, 0.7);
  const threshold = floor + 0.3 * (speech - floor);
  // light smoothing so single loud/quiet frames don't split pauses
  const quiet = Array.from(db, (_, i) => {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(db.length - 1, i + 2); k++) {
      s += db[k];
      n++;
    }
    return s / n < threshold;
  });
  let first = quiet.findIndex((q) => !q);
  let last = quiet.length - 1 - [...quiet].reverse().findIndex((q) => !q);
  if (first < 0) first = 0;
  if (last < first) last = quiet.length - 1;

  const pauses: Pause[] = [];
  let runStart = -1;
  for (let i = first; i <= last + 1; i++) {
    const q = i <= last && quiet[i];
    if (q && runStart < 0) runStart = i;
    if (!q && runStart >= 0) {
      if ((i - runStart) * HOP >= minPause) pauses.push({ start: runStart * HOP, end: i * HOP });
      runStart = -1;
    }
  }
  return { pauses, speechStart: first * HOP, speechEnd: (last + 1) * HOP };
}

/** Rough "speaking weight" of a sentence: letters plus extra for punctuation that causes short breaths. */
export function sentenceWeight(text: string): number {
  const letters = (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const breaks = (text.match(/[,;:—–]/g) ?? []).length;
  return letters + breaks * 6 + 8;
}

/**
 * Assign start/end times to `weights.length` sentences using the detected pauses.
 * Falls back to proportional timing when the audio has too few pauses.
 */
export function alignToPauses(weights: number[], pauses: Pause[], speechStart: number, speechEnd: number): Timing[] {
  const n = weights.length;
  if (n === 0) return [];
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(0.1, speechEnd - speechStart);
  const inner = pauses.filter((p) => p.start > speechStart + 0.2 && p.end < speechEnd - 0.2);

  const proportional = (): Timing[] => {
    let t = speechStart;
    return weights.map((w) => {
      const d = (w / total) * span;
      const r = { start: t, end: t + d };
      t += d;
      return r;
    });
  };
  if (n === 1) return [{ start: speechStart, end: speechEnd }];
  if (inner.length < n - 1) return proportional();

  // Seconds of speech per weight unit, estimated without pauses that will separate sentences.
  const rate = span / total;
  const P = inner.length;
  // Node j = boundary at pause j. Virtual start node = -1 (speechStart), virtual end node = P (speechEnd).
  const segStart = (j: number) => (j < 0 ? speechStart : inner[j].end);
  const segEnd = (j: number) => (j >= P ? speechEnd : inner[j].start);
  const pauseBonus = (j: number) => 1.6 * Math.log(Math.max(0.12, inner[j].end - inner[j].start) / 0.12);
  const segCost = (k: number, from: number, to: number) => {
    const dur = segEnd(to) - segStart(from);
    if (dur <= 0.25) return Infinity;
    const expected = weights[k] * rate;
    const sigma = 0.22 * expected + 0.6;
    const z = (dur - expected) / sigma;
    return z * z;
  };

  // dp[k][j]: best cost for sentences 0..k with sentence k ending at pause j.
  const INF = Infinity;
  const dp: Float64Array[] = [];
  const back: Int32Array[] = [];
  for (let k = 0; k < n - 1; k++) {
    dp.push(new Float64Array(P).fill(INF));
    back.push(new Int32Array(P).fill(-2));
    for (let j = k; j < P; j++) {
      if (k === 0) {
        dp[k][j] = segCost(0, -1, j) - pauseBonus(j);
        back[k][j] = -1;
      } else {
        let best = INF;
        let arg = -2;
        // Look back over a bounded window of pauses (keeps it fast on long audio).
        for (let q = Math.max(k - 1, j - 60); q < j; q++) {
          const c = dp[k - 1][q];
          if (c === INF) continue;
          const v = c + segCost(k, q, j);
          if (v < best) {
            best = v;
            arg = q;
          }
        }
        if (arg >= -1) {
          dp[k][j] = best - pauseBonus(j);
          back[k][j] = arg;
        }
      }
    }
  }
  // Last sentence ends at speechEnd.
  let bestEnd = INF;
  let argEnd = -2;
  for (let j = n - 2; j < P; j++) {
    const c = dp[n - 2][j];
    if (c === INF) continue;
    const v = c + segCost(n - 1, j, P);
    if (v < bestEnd) {
      bestEnd = v;
      argEnd = j;
    }
  }
  if (argEnd < 0) return proportional();

  const boundary: number[] = new Array(n - 1);
  let j = argEnd;
  for (let k = n - 2; k >= 0; k--) {
    boundary[k] = j;
    j = back[k][j];
  }
  const out: Timing[] = [];
  for (let k = 0; k < n; k++) {
    const from = k === 0 ? -1 : boundary[k - 1];
    const to = k === n - 1 ? P : boundary[k];
    out.push({ start: segStart(from), end: segEnd(to) });
  }
  return out;
}

/** Full pipeline on decoded mono samples. Returns rounded start/end per sentence. */
export function autoSync(samples: Float32Array, sampleRate: number, sentences: string[]): Timing[] {
  const db = frameEnergy(samples, sampleRate);
  const { pauses, speechStart, speechEnd } = detectPauses(db);
  const timings = alignToPauses(sentences.map(sentenceWeight), pauses, speechStart, speechEnd);
  return timings.map((t, i) => ({
    start: i === 0 ? 0 : Math.round(Math.max(0, t.start - 0.1) * 100) / 100,
    end: Math.round((t.end + 0.15) * 100) / 100,
  }));
}
