// Pure types and helpers for audio. NO p5.sound import here — that lives in
// `audio-runtime.ts` so tests (vitest under Node) can exercise the queue logic
// without pulling browser globals from the p5.sound addon.

export type BucketName = "laser" | "explosion" | "shipDamage" | "heal";

/** Minimal interface for p5.sound's SoundFile (we only call play + isLoaded). */
export type SoundFileLike = {
    play(): void;
    isLoaded(): boolean;
};

/** Fisher–Yates non-repeating shuffle queue over a fixed pool of indices. */
export type ShuffleQueue = {
    readonly poolSize: number;
    readonly remaining: number[];
};

export type AudioState = {
    buckets: Record<BucketName, SoundFileLike[]>;
    queues: Record<BucketName, ShuffleQueue>;
};

function shuffleIndices(n: number, rng: () => number): number[] {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

export function createShuffleQueue(poolSize: number, rng: () => number = Math.random): ShuffleQueue {
    return { poolSize, remaining: shuffleIndices(poolSize, rng) };
}

export function nextFromQueue(
    q: ShuffleQueue,
    rng: () => number = Math.random,
): { index: number; queue: ShuffleQueue } {
    if (q.poolSize === 0) {
        throw new Error("nextFromQueue: empty pool");
    }
    if (q.remaining.length === 0) {
        const refilled = shuffleIndices(q.poolSize, rng);
        const index = refilled.pop()!;
        return { index, queue: { poolSize: q.poolSize, remaining: refilled } };
    }
    const remaining = q.remaining.slice();
    const index = remaining.pop()!;
    return { index, queue: { poolSize: q.poolSize, remaining } };
}

export function playFromBucket(state: AudioState, name: BucketName): AudioState {
    const bucket = state.buckets[name];
    if (bucket.length === 0) return state;
    const { index, queue } = nextFromQueue(state.queues[name]);
    const sound = bucket[index];
    if (sound.isLoaded()) {
        sound.play();
    }
    return {
        ...state,
        queues: { ...state.queues, [name]: queue },
    };
}

export const playLaser = (s: AudioState): AudioState => playFromBucket(s, "laser");
export const playExplosion = (s: AudioState): AudioState => playFromBucket(s, "explosion");
export const playShipDamage = (s: AudioState): AudioState => playFromBucket(s, "shipDamage");
export const playHeal = (s: AudioState): AudioState => playFromBucket(s, "heal");
