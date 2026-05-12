import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createShuffleQueue, nextFromQueue } from "./audio";

// ---------------------------------------------------------------------------
// File-on-disk presence tests (do NOT import the audio module's URL-resolving
// side effects — vitest doesn't run Vite's import.meta.glob the same as a
// dev/build pass, and we want these tests to verify the actual bundled assets).
// ---------------------------------------------------------------------------

const ASSETS_ROOT = resolve(__dirname, "..", "assets", "audio");

const EXPECTED: Record<string, string[]> = {
    retro_laser: ["retro_laser_01.ogg", "retro_laser_02.ogg"],
    explosion: ["explosion_01.ogg", "explosion_02.ogg"],
    retro_beep: [
        "retro_beep_01.ogg",
        "retro_beep_02.ogg",
        "retro_beep_03.ogg",
        "retro_beep_04.ogg",
        "retro_beep_05.ogg",
        "retro_beep_06.ogg",
    ],
    beep: ["beep_01.ogg", "beep_02.ogg", "beep_03.ogg"],
};

describe("audio asset files on disk", () => {
    it("LICENSE is present at assets/audio/LICENSE", () => {
        expect(existsSync(join(ASSETS_ROOT, "LICENSE"))).toBe(true);
    });

    for (const [bucket, files] of Object.entries(EXPECTED)) {
        describe(`bucket ${bucket}`, () => {
            it(`contains exactly the expected ${files.length} samples`, () => {
                const dir = join(ASSETS_ROOT, bucket);
                expect(existsSync(dir)).toBe(true);
                const onDisk = readdirSync(dir).filter((f: string) => f.endsWith(".ogg")).sort();
                expect(onDisk).toEqual(files.slice().sort());
            });

            for (const f of files) {
                it(`${f} exists and is non-empty`, () => {
                    const p = join(ASSETS_ROOT, bucket, f);
                    expect(existsSync(p)).toBe(true);
                    const size = statSync(p).size;
                    expect(size).toBeGreaterThan(0);
                });
            }
        });
    }
});

// ---------------------------------------------------------------------------
// ShuffleQueue invariants
// ---------------------------------------------------------------------------

describe("createShuffleQueue / nextFromQueue", () => {
    it("createShuffleQueue holds exactly poolSize indices, all distinct, all in range", () => {
        const q = createShuffleQueue(6);
        expect(q.poolSize).toBe(6);
        expect(q.remaining).toHaveLength(6);
        const set = new Set(q.remaining);
        expect(set.size).toBe(6);
        for (const i of q.remaining) {
            expect(i).toBeGreaterThanOrEqual(0);
            expect(i).toBeLessThan(6);
        }
    });

    it("nextFromQueue exhausts the pool without repeats, then refills", () => {
        let q = createShuffleQueue(4);
        const drawn: number[] = [];
        for (let i = 0; i < 4; i++) {
            const r = nextFromQueue(q);
            drawn.push(r.index);
            q = r.queue;
        }
        // First full cycle: every index appears exactly once.
        expect(new Set(drawn).size).toBe(4);
        // Queue should be empty.
        expect(q.remaining).toHaveLength(0);
        // Next call refills automatically and returns a valid index.
        const after = nextFromQueue(q);
        expect(after.index).toBeGreaterThanOrEqual(0);
        expect(after.index).toBeLessThan(4);
        // Queue now has 3 left (one consumed).
        expect(after.queue.remaining).toHaveLength(3);
    });

    it("nextFromQueue is pure: input queue unchanged after a call", () => {
        const q = createShuffleQueue(3);
        const snapshot = q.remaining.slice();
        const _r = nextFromQueue(q);
        void _r;
        expect(q.remaining).toEqual(snapshot);
    });

    it("nextFromQueue throws on empty pool (poolSize === 0)", () => {
        const q = createShuffleQueue(0);
        expect(() => nextFromQueue(q)).toThrow();
    });

    it("nextFromQueue refill produces all indices over enough draws", () => {
        let q = createShuffleQueue(5);
        const seen = new Set<number>();
        for (let i = 0; i < 20 && seen.size < 5; i++) {
            const r = nextFromQueue(q);
            seen.add(r.index);
            q = r.queue;
        }
        expect(seen.size).toBe(5);
    });
});
