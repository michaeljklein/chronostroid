import type p5 from "p5";

// IMPORTANT: globalize p5 BEFORE the addon's side-effect import so the
// addon's `p5` reference resolves. ESM evaluates sibling imports in source
// order, so this ordering is load-bearing — do not reshuffle.
import "./p5-globalize";
import "p5/lib/addons/p5.sound";

import {
    type AudioState,
    type BucketName,
    type ShuffleQueue,
    type SoundFileLike,
    createShuffleQueue,
} from "./audio";

// ---------------------------------------------------------------------------
// Bucket URL maps (resolved at build time by Vite's import.meta.glob).
//
// `query: '?url', import: 'default'` makes each value the resolved asset URL.
// RCade sandbox requirements: bundled assets only, no fetch / CDN — these
// URLs all resolve to relative paths under the built bundle.
// ---------------------------------------------------------------------------

const LASER_URLS = import.meta.glob("../assets/audio/retro_laser/*.ogg", {
    eager: true,
    query: "?url",
    import: "default",
}) as Record<string, string>;

const EXPLOSION_URLS = import.meta.glob("../assets/audio/explosion/*.ogg", {
    eager: true,
    query: "?url",
    import: "default",
}) as Record<string, string>;

const SHIP_DAMAGE_URLS = import.meta.glob("../assets/audio/retro_beep/*.ogg", {
    eager: true,
    query: "?url",
    import: "default",
}) as Record<string, string>;

const HEAL_URLS = import.meta.glob("../assets/audio/beep/*.ogg", {
    eager: true,
    query: "?url",
    import: "default",
}) as Record<string, string>;

/** Sorted URL list per bucket — ensures deterministic indexing across builds. */
function sortedUrls(map: Record<string, string>): string[] {
    return Object.keys(map)
        .sort()
        .map((k) => map[k]);
}

type P5WithLoadSound = p5 & {
    loadSound: (url: string) => SoundFileLike;
};

function loadBucket(p: P5WithLoadSound, urls: string[]): SoundFileLike[] {
    return urls.map((u) => p.loadSound(u));
}

export function loadAudio(p: p5): AudioState {
    const px = p as P5WithLoadSound;
    const laserUrls = sortedUrls(LASER_URLS);
    const explosionUrls = sortedUrls(EXPLOSION_URLS);
    const shipDamageUrls = sortedUrls(SHIP_DAMAGE_URLS);
    const healUrls = sortedUrls(HEAL_URLS);

    const buckets: Record<BucketName, SoundFileLike[]> = {
        laser: loadBucket(px, laserUrls),
        explosion: loadBucket(px, explosionUrls),
        shipDamage: loadBucket(px, shipDamageUrls),
        heal: loadBucket(px, healUrls),
    };

    const queues: Record<BucketName, ShuffleQueue> = {
        laser: createShuffleQueue(buckets.laser.length),
        explosion: createShuffleQueue(buckets.explosion.length),
        shipDamage: createShuffleQueue(buckets.shipDamage.length),
        heal: createShuffleQueue(buckets.heal.length),
    };

    return { buckets, queues };
}

// Re-export pure play helpers so sketch.ts has a single audio import surface.
export { playLaser, playExplosion, playShipDamage, playHeal } from "./audio";
export type { AudioState } from "./audio";
