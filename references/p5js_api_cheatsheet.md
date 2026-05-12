# p5.js API Cheatsheet

Version: p5 ^1.11.3. Full docs: https://p5js.org/reference/

This project uses p5 in **instance mode** (`new p5(sketch, element)`).

---

## Lifecycle

```typescript
const sketch = (p: p5) => {
    p.setup = () => { /* runs once */ };
    p.draw  = () => { /* runs every frame (~60fps) */ };
};
new p5(sketch, document.getElementById("sketch")!);
```

---

## Canvas

```typescript
p.createCanvas(width, height);          // create; returns canvas element
p.resizeCanvas(width, height);
p.width; p.height;                      // current canvas dimensions
p.frameRate(60);                        // set target FPS
p.frameCount;                           // frames elapsed
p.deltaTime;                            // ms since last frame
```

---

## Color & Background

```typescript
p.background(r, g, b);                  // or background(gray) / background(color)
p.fill(r, g, b, [a]);                   // fill color (0-255)
p.noFill();
p.stroke(r, g, b, [a]);
p.noStroke();
p.strokeWeight(w);
p.color(r, g, b, [a]);                  // create a p5.Color
p.lerpColor(c1, c2, t);                 // interpolate colors
```

---

## Shapes

```typescript
// Primitives
p.point(x, y);
p.line(x1, y1, x2, y2);
p.rect(x, y, w, h, [r]);               // r = corner radius
p.ellipse(x, y, w, [h]);
p.circle(x, y, d);
p.triangle(x1,y1, x2,y2, x3,y3);

// Polygons
p.beginShape();
p.vertex(x, y);
p.endShape([p.CLOSE]);

// Arcs
p.arc(x, y, w, h, start, stop, [mode]);  // mode: OPEN, CHORD, PIE
```

---

## Transforms

```typescript
p.push();                               // save transform + style state
p.pop();                                // restore
p.translate(x, y);
p.rotate(angle);                        // radians by default
p.scale(sx, [sy]);
p.angleMode(p.DEGREES);                 // or p.RADIANS (default)
```

---

## Text

```typescript
p.textSize(s);
p.textFont("monospace");
p.textAlign(p.CENTER, p.CENTER);        // horiz: LEFT, CENTER, RIGHT; vert: TOP, CENTER, BOTTOM, BASELINE
p.text("hello", x, y);
p.textWidth("hello");                   // pixel width of string
```

---

## Math

```typescript
p.PI; p.TWO_PI; p.HALF_PI;
p.sin(a); p.cos(a); p.tan(a);
p.atan2(y, x);
p.degrees(r); p.radians(d);
p.sqrt(n); p.pow(b, e); p.abs(n);
p.min(a, b); p.max(a, b);
p.constrain(n, lo, hi);
p.map(val, start1, stop1, start2, stop2);
p.lerp(start, stop, t);
p.dist(x1, y1, x2, y2);
p.floor(n); p.ceil(n); p.round(n);
p.random([lo], [hi]);                   // or random(array)
p.randomSeed(s);
p.noise(x, [y], [z]);                   // Perlin noise [0,1]
p.noiseSeed(s);
```

---

## Vector

```typescript
const v = p.createVector(x, y);
v.add(other); v.sub(other);
v.mult(scalar); v.div(scalar);
v.mag(); v.magSq();
v.normalize();
v.limit(max);
v.heading();                            // angle in radians
v.rotate(angle);
v.copy();
p5.Vector.dist(v1, v2);
p5.Vector.fromAngle(angle, [length]);
```

---

## Images & Sprites

```typescript
let img: p5.Image;
p.preload = () => { img = p.loadImage("path/to/img.png"); };
p.image(img, x, y, [w], [h]);
p.imageMode(p.CENTER);                  // or CORNER (default)
p.tint(r, g, b, [a]);
p.noTint();
```

---

## Sound (p5.sound add-on — not installed by default)

Not included in this project's current deps. Use Web Audio API directly if needed.

---

## Input (NOT used — RCade blocks direct events)

Direct `p.keyIsDown()`, `p.mouseX`, etc. may not work in RCade's sandbox.
Use `@rcade/plugin-input-classic` and `@rcade/plugin-input-spinners` instead.
See `references/rcade_readme.md` for the full input API.
