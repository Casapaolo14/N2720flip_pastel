# Sorbet Brutalism — Style Guidelines

Brutalist structure, soft pastels, McBling sparkle. Heavy black outlines and hard offset shadows hold the layout together; pale pastel fills soften it; silver glitter is the accent.

**Balance rule:** ~70% clean pastel, ~30% sparkle. Every block is solid, flat and outlined; sparkle only on a few key accents.

Reference implementation: `test.html`.

## Color palette

Six Color Crush pastels, plus black ink and warm off-white paper. A different pastel per block, none dominating.

| Name      | Hex       | Token      | Typical use                                  |
|-----------|-----------|------------|----------------------------------------------|
| Lilac     | `#F0D9EF` | `--lilac`  | Hero block, focus outline, chrome tint       |
| Blush     | `#FCDCE1` | `--blush`  | Glitter base, accent pills                   |
| Butter    | `#FFE6BB` | `--butter` | Tags, cards                                  |
| Sage      | `#E9ECCE` | `--sage`   | Secondary buttons, rules/info blocks         |
| Mint      | `#CDE9DC` | `--mint`   | Primary buttons, cards                       |
| Baby blue | `#C4DFE5` | `--blue`   | Default pills, cards                         |
| Ink       | `#000000` | `--ink`    | All borders, shadows, text                   |
| Paper     | `#FFFDF7` | `--paper`  | Page background                              |

- Pastels are fills only — never text or borders. Ink does all line work.
- Glitter is not a seventh color; it's an accent reserved for key elements.
- The pastels are very pale: contrast comes from the black outlines, not the fills.

## Typography

| Font          | Role                                        | Settings |
|---------------|---------------------------------------------|----------|
| Bungee        | Hero headline (chrome), prices              | Hero `clamp(44px, 9vw, 96px)`, line-height .95; prices 30px |
| Archivo Black | Section titles, buttons, tags, card titles  | Uppercase; H2 32px, H3 22px, buttons 16px, tags 13px / .08em tracking |
| Space Mono    | Body, inputs, labels                        | 400 body, 700 labels/pills; 16–18px |

- Bungee only for the hero headline and prices.
- Display labels always Archivo Black, uppercase.

## Structure

- **Border:** `3px solid #000` on every block, button, input, pill, swatch.
- **Shadow:** `6px 6px 0 #000` on blocks, cards, buttons; `4px 4px 0 #000` on small items (swatches, inputs). Never blurred.
- **Page background:** paper with a 1px black dot grid every 22px.
- **Layout:** single column, max 1000px, 16px side gutter, 32px between sections, 24px block padding.
- **Grids:** `auto-fit` columns that wrap on phones — swatches min 130px, cards min 220px, 16–24px gaps.
- **Corners:** square. Only pills are fully rounded (`border-radius: 999px`).

## Components

- **Button:** pastel fill, border + 6px shadow, Archivo Black uppercase, 14px × 22px padding.
  - Hover: lifts `translate(-2px,-2px)`, shadow grows to 8px.
  - Active: presses `translate(6px,6px)`, shadow drops to 0.
- **Pill:** rounded, border, 700 weight, `background-color` (not `background`, so `.glitter` can layer on top).
- **Tag:** butter, Archivo Black 13px uppercase, border, no shadow.
- **Input:** white, border + 4px shadow; focus = `3px solid` lilac outline, 3px offset.
- **Card:** pastel block, border + 6px shadow, stacked: pill → title → Bungee price → button.
- **Swatch:** 120px tall, border + 4px shadow, name and hex bottom-left.

## Bling

### Silver glitter (`.glitter`)

Static pastel gradient with two fixed silver speck grids. **The specks never move** — animating tiny dots by sub-pixel offsets makes them crawl and flicker.

```css
.glitter{
  background-color:var(--blush);
  background-image:
    radial-gradient(circle,#fff 1px,#c0c6d4 1.5px,transparent 2px),
    radial-gradient(circle,rgba(176,184,200,.8) 1px,transparent 1.5px),
    linear-gradient(120deg,var(--blush),var(--lilac),var(--blue),var(--mint));
  background-size:9px 9px,13px 13px,300% 300%;
  background-position:0 0,4px 6px,40% 50%;
}
```

- Silver = white core + cool grey rim. Avoid tinted (lilac/warm) rims: over pink and butter they read as brown.
- On pills set `background-color`, never the `background` shorthand, or it wipes the glitter.

### Hover twinkle

Two sparse sparkle grids behind the text, fading out of phase — **only on hover / keyboard focus**.

```css
.glitter{position:relative;isolation:isolate}
.glitter::before,.glitter::after{
  content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;opacity:0;
  background:radial-gradient(circle,#fff 1.5px,#c9ced9 2px,#8e97a8 2.5px,transparent 3px) 0 0/23px 19px;
}
.glitter::after{background-position:11px 9px}
.glitter:hover::before,.glitter:hover::after,
.glitter:focus-visible::before,.glitter:focus-visible::after{animation:twinkle .5s ease-in-out infinite alternate}
.glitter:hover::after,.glitter:focus-visible::after{animation-delay:-.25s}
@keyframes twinkle{from{opacity:0}to{opacity:1}}
```

- `isolation:isolate` + `z-index:-1` puts sparkles above the fill but under the text.
- `pointer-events:none` keeps clicks on the element.

### Chrome headline (`.chrome`)

Bungee with a metallic vertical gradient clipped to the text and a 2px ink stroke:

```css
background:linear-gradient(180deg,#fff 0%,#d9d9e8 40%,#8f8fa8 50%,#f2f2ff 60%,#F0D9EF 100%);
-webkit-background-clip:text;background-clip:text;color:transparent;
-webkit-text-stroke:2px #000;
```

One chrome headline per page — the hero.

### Corner sparkles

`✦` / `✧` glyphs at 28px, absolutely positioned overhanging a block's corner (`top:-18px; left:-14px` or `bottom:-16px; right:-12px`). Max two per block, not on every block.

## Motion & accessibility

- Nothing moves at rest. Motion is a reward for interaction: button press/lift and glitter twinkle on hover/focus.
- Twinkle triggers on `:focus-visible` too, so keyboard users get it.
- Reduced motion: no blinking — sparkles just appear on hover:

```css
@media (prefers-reduced-motion:reduce){
  .glitter:hover::before,.glitter:focus-visible::before{animation:none;opacity:1}
  .glitter:hover::after,.glitter:focus-visible::after{animation:none}
}
```

- Text is always ink on pastel — high contrast regardless of fill.

## Do / Don't

| Do | Don't |
|----|-------|
| 3px black border on everything | Thin, grey or colored borders |
| Hard, unblurred offset shadows | Soft drop shadows |
| One pastel per block, varied | Same pastel everywhere, or saturated colors |
| Glitter on 1–2 key accents per view | Glitter on whole sections or every button |
| Static glitter, twinkle on hover only | Constant or looping page animation |
| Silver sparkles (white + cool grey) | Tinted/warm sparkle rims (turn brown) |
| Bungee for hero + prices | Bungee for body or labels |
| `background-color` on elements that may get `.glitter` | `background` shorthand that wipes glitter layers |
