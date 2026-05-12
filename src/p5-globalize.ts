import p5 from "p5";

// p5.sound (and any other p5 addon shipped by the p5 project) expects a
// global `p5` constructor on `window` / `globalThis` to attach its API to.
// With ESM + instance-mode p5 there is no global; the addon import would
// otherwise throw `ReferenceError: p5 is not defined` and brick the sketch.
//
// This module is intentionally a side-effect import. It must be imported
// BEFORE any addon import: ESM evaluates sibling imports in source order
// within a single module, so `import "./p5-globalize"; import "p5/.../addon"`
// guarantees this runs first.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).p5 = p5;
