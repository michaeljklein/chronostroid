import CONSTANTS from "./constants.json";
import type { ShipState } from "./ship";
import type { BulletState } from "./bullet";
import type { AsteroidState } from "./asteroid";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ZoneSnapshot = {
    ship: ShipState;
    asteroids: AsteroidState[];
    bullets: BulletState[];
    hp: number;
};

/** Index into the node pool (-1 = null/none). */
export type NodeId = number;

const POOL_SIZE = CONSTANTS.REWIND.HISTORY_TICKS;
const NULL_ID: NodeId = -1;

// ---------------------------------------------------------------------------
// Internal node structure
// ---------------------------------------------------------------------------

type PoolNode = {
    snapshot: ZoneSnapshot;
    parent: NodeId;
    children: NodeId[];
    lastVisitedChildIndex: number;
    /** Monotonically increasing counter — used for insertion-order tracking. */
    insertionOrder: number;
};

// ---------------------------------------------------------------------------
// ZoneHistory — opaque to callers
// ---------------------------------------------------------------------------

export type ZoneHistory = {
    /** The fixed pool of node slots. Shared by reference across all ZoneHistory
     *  wrappers derived from the same tree (intentionally mutable internally). */
    readonly _pool: Array<PoolNode | null>;
    /** Stack of free slot indices (free-list). */
    readonly _freeList: NodeId[];
    /** Ring buffer of allocated NodeIds in insertion order — oldest first. */
    readonly _insertionRing: NodeId[];
    /** The root of the current tree. */
    readonly _root: NodeId;
    /** The currently active node. */
    readonly _current: NodeId;
    /** Monotonic counter for insertion-order bookkeeping. */
    readonly _insertionCounter: number;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function allocNode(h: ZoneHistory, snapshot: ZoneSnapshot, parent: NodeId): NodeId {
    const freeList = h._freeList;
    if (freeList.length === 0) {
        throw new Error("ZoneHistory: pool exhausted (should have been pruned first)");
    }
    const id = freeList.pop()!;
    const order = h._insertionCounter;
    h._pool[id] = {
        snapshot,
        parent,
        children: [],
        lastVisitedChildIndex: NULL_ID,
        insertionOrder: order,
    };
    return id;
}

function freeNode(h: ZoneHistory, id: NodeId): void {
    h._pool[id] = null;
    h._freeList.push(id);
}

/** Recursively free a subtree rooted at `id`, skipping `exclude`. */
function freeSubtree(h: ZoneHistory, id: NodeId, exclude: NodeId): void {
    if (id === NULL_ID || id === exclude) return;
    const node = h._pool[id];
    if (node === null) return;
    for (const child of node.children) {
        freeSubtree(h, child, exclude);
    }
    freeNode(h, id);
}

/** Remove a NodeId from the insertion ring. Mutates the array in-place. */
function removeFromRing(ring: NodeId[], id: NodeId): void {
    const idx = ring.indexOf(id);
    if (idx !== -1) ring.splice(idx, 1);
}

/**
 * Ensure the pool has at least one free slot.
 * If the pool is at capacity, drop the oldest-inserted node from the ring,
 * promote the subtree containing `current` to be the new root,
 * and free all sibling subtrees of the promoted child.
 *
 * Returns the (possibly updated) root NodeId.
 */
function ensureFreeSlot(h: ZoneHistory, currentId: NodeId): NodeId {
    if (h._freeList.length > 0) return h._root;

    // Find the oldest-inserted allocated node
    const ring = h._insertionRing;
    if (ring.length === 0) {
        throw new Error("ZoneHistory: insertion ring is empty but pool is full");
    }
    const oldestId = ring[0];
    ring.shift(); // remove from front

    // The oldest node should always be the root (we only prune from the root).
    // But defensively handle the case where it isn't (shouldn't happen in practice).
    const rootId = h._root;
    if (oldestId !== rootId) {
        // This shouldn't happen given our invariants, but handle gracefully:
        // just free the orphaned node if it still exists.
        if (h._pool[oldestId] !== null) {
            freeNode(h, oldestId);
        }
        return rootId;
    }

    // We are dropping the root. Find which child of root is an ancestor of current
    // (or is current itself). That child is promoted to be the new root.
    const rootNode = h._pool[rootId]!;
    let promotedChildId: NodeId = NULL_ID;

    // Walk from current toward root to find which child of rootId is on the path.
    // Build the ancestor chain.
    let walker: NodeId = currentId;
    while (walker !== NULL_ID) {
        const walkerNode = h._pool[walker];
        if (walkerNode === null) break;
        if (walkerNode.parent === rootId) {
            promotedChildId = walker;
            break;
        }
        walker = walkerNode.parent;
    }

    if (promotedChildId === NULL_ID) {
        // Current is the root itself — use lastVisitedChildIndex as fallback
        if (rootNode.children.length > 0) {
            const lvi = rootNode.lastVisitedChildIndex;
            promotedChildId =
                lvi >= 0 && lvi < rootNode.children.length
                    ? rootNode.children[lvi]
                    : rootNode.children[rootNode.children.length - 1];
        } else {
            // Root has no children — just free root and caller will create a fresh tree
            freeNode(h, rootId);
            return NULL_ID;
        }
    }

    // Free all sibling subtrees (children of root that are NOT the promoted child)
    for (const childId of rootNode.children) {
        if (childId !== promotedChildId) {
            freeSubtree(h, childId, NULL_ID);
            // Also remove freed nodes from insertion ring
            // (we won't hit them again via current path, so ring cleanup happens lazily
            //  via the NULL check in the pool; but we need to drop them from the ring
            //  to prevent future incorrect frees)
            removeFromRing(ring, childId);
        }
    }

    // Detach the promoted child from the old root
    const promotedNode = h._pool[promotedChildId]!;
    promotedNode.parent = NULL_ID;

    // Free the old root slot
    freeNode(h, rootId);

    return promotedChildId;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createZoneHistory(initial: ZoneSnapshot): ZoneHistory {
    const pool: Array<PoolNode | null> = new Array(POOL_SIZE).fill(null);
    const freeList: NodeId[] = [];
    // Pre-populate free list (highest index first for stack behaviour — order
    // doesn't affect correctness).
    for (let i = POOL_SIZE - 1; i >= 1; i--) {
        freeList.push(i);
    }

    const insertionRing: NodeId[] = [];

    // Bootstrap: manually allocate slot 0 as root without going through allocNode
    // (since h doesn't exist yet).
    pool[0] = {
        snapshot: initial,
        parent: NULL_ID,
        children: [],
        lastVisitedChildIndex: NULL_ID,
        insertionOrder: 0,
    };
    insertionRing.push(0);

    return {
        _pool: pool,
        _freeList: freeList,
        _insertionRing: insertionRing,
        _root: 0,
        _current: 0,
        _insertionCounter: 1,
    };
}

export function recordTick(h: ZoneHistory, snapshot: ZoneSnapshot): ZoneHistory {
    // Mutate shared pool — but return a new ZoneHistory wrapper.
    const mutableH = h as {
        _root: NodeId;
        _current: NodeId;
        _insertionCounter: number;
        _freeList: NodeId[];
        _insertionRing: NodeId[];
        _pool: Array<PoolNode | null>;
    };

    // Ensure there is a free slot, possibly pruning the oldest root.
    const newRoot = ensureFreeSlot(mutableH as ZoneHistory, mutableH._current);
    mutableH._root = newRoot;

    // Increment insertion counter before allocating (counter stored on h is immutable
    // so we capture new value here).
    const newCounter = mutableH._insertionCounter + 1;

    // Allocate new node as child of current.
    const parentId = mutableH._current;
    const newId = allocNode(mutableH as ZoneHistory, snapshot, parentId);
    // insertionOrder was set to `h._insertionCounter` inside allocNode — correct.

    // Push into insertion ring.
    mutableH._insertionRing.push(newId);

    // Update parent's children list and lastVisitedChildIndex.
    const parentNode = mutableH._pool[parentId]!;
    parentNode.children.push(newId);
    parentNode.lastVisitedChildIndex = parentNode.children.length - 1;

    return {
        _pool: mutableH._pool,
        _freeList: mutableH._freeList,
        _insertionRing: mutableH._insertionRing,
        _root: mutableH._root,
        _current: newId,
        _insertionCounter: newCounter,
    };
}

export function rewind(h: ZoneHistory, n: number): ZoneHistory {
    let currentId = h._current;

    for (let i = 0; i < n; i++) {
        const node = h._pool[currentId];
        if (node === null || node.parent === NULL_ID) break;
        const parentId = node.parent;
        const parentNode = h._pool[parentId]!;
        // Record which child we came from so fastForward knows where to go.
        const childIndex = parentNode.children.indexOf(currentId);
        if (childIndex !== -1) {
            parentNode.lastVisitedChildIndex = childIndex;
        }
        currentId = parentId;
    }

    return {
        _pool: h._pool,
        _freeList: h._freeList,
        _insertionRing: h._insertionRing,
        _root: h._root,
        _current: currentId,
        _insertionCounter: h._insertionCounter,
    };
}

export function fastForward(
    h: ZoneHistory,
    n: number
): { history: ZoneHistory; stepsTaken: number } {
    let currentId = h._current;
    let steps = 0;

    for (let i = 0; i < n; i++) {
        const node = h._pool[currentId];
        if (node === null || node.children.length === 0) break;
        const lvi = node.lastVisitedChildIndex;
        const childId =
            lvi >= 0 && lvi < node.children.length
                ? node.children[lvi]
                : node.children[node.children.length - 1];
        currentId = childId;
        steps++;
    }

    return {
        history: {
            _pool: h._pool,
            _freeList: h._freeList,
            _insertionRing: h._insertionRing,
            _root: h._root,
            _current: currentId,
            _insertionCounter: h._insertionCounter,
        },
        stepsTaken: steps,
    };
}

export function atFrontier(h: ZoneHistory): boolean {
    const node = h._pool[h._current];
    if (node === null) return true;
    return node.children.length === 0;
}

export function currentSnapshot(h: ZoneHistory): ZoneSnapshot {
    const node = h._pool[h._current];
    if (node === null) {
        throw new Error("ZoneHistory: current node is null");
    }
    return node.snapshot;
}

/** Returns the number of live (non-null) nodes in the pool. Used in tests. */
export function liveNodeCount(h: ZoneHistory): number {
    let count = 0;
    for (let i = 0; i < POOL_SIZE; i++) {
        if (h._pool[i] !== null) count++;
    }
    return count;
}
