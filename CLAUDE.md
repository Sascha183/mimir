# How Computers Work — Project Brief

This file is read automatically by Claude Code at the start of every session. It encodes the architecture, conventions, and hard rules of this project. Read it carefully before making changes. If a request conflicts with these rules, surface the conflict before acting.

---

## What this project is

A static educational web app that teaches computing fundamentals from first principles. The first curriculum module is based on J. Clark Scott's *But How Do It Know? — The Basic Principles of Computers*. It walks the learner from a single NAND gate up through a working CPU.

Each lesson combines:
1. **Prose** — short, plain-language explanation (~3–5 minutes of reading).
2. **An interactive component** — a widget the learner manipulates (toggle inputs on a gate, wire NANDs into a NOT gate, write a byte to RAM, etc.).
3. **A comprehension check** — a small puzzle or question the learner must answer correctly to advance.

The site is deliberately tiny in scope: text, illustrations, and in-browser simulations. No video, no chat, no AI features in the product itself.

---

## Architecture

- **Framework:** Astro 5 with the MDX integration. Astro ships zero JavaScript by default and lets us hydrate interactive components as "islands" only where needed.
- **Interactive components:** React (via `@astrojs/react`). Use functional components and hooks only — no class components.
- **Styling:** Tailwind CSS via `@astrojs/tailwind`. No ad-hoc CSS files unless absolutely necessary; if added, scope them with CSS modules.
- **Content:** MDX files in `src/content/lessons/`. Validated against the Zod schema in `src/content/config.ts`.
- **Language:** TypeScript everywhere. No raw `.js` files except config files that have to be `.mjs` for tooling reasons.
- **Hosting target:** Cloudflare Pages. Build output is fully static (no server-side rendering, no edge functions). The `public/_headers` file ships security headers with the deploy.

---

## Hard rules — never violate without explicit user approval in the chat

These are the rules that protect the project's security and educational mission. Treat them as immutable.

### Security

1. **No backend services.** No Node servers, no API routes, no edge functions, no databases. If a feature seems to need one, stop and propose client-side alternatives (localStorage, IndexedDB, in-memory state). Do not silently add a backend.
2. **No user data collection.** No accounts, no analytics that track individuals, no third-party tracking pixels, no cookies that aren't strictly functional.
3. **Maintain the Content Security Policy** in `public/_headers`. Adding a new external script source, font source, or image source requires explicit user approval. Default-deny everything else.
4. **No inline scripts or `eval`-family functions.** No `eval()`, no `new Function()`, no `dangerouslySetInnerHTML`, no `innerHTML =` assignments with anything that could contain user input. The CSP forbids inline scripts at runtime — your code must work without them.
5. **No new dependencies without justification.** Before adding any npm package: check it's actively maintained (commit in last 12 months), has >100k weekly downloads OR is a well-known reference implementation, and has no open critical CVEs. Prefer writing 50 lines of code over adding a 5MB package.
6. **Subresource Integrity for any external asset.** If a font or script must come from a CDN (avoid this), include the `integrity` attribute.
7. **Treat all user-typed content as untrusted.** Puzzles may accept text input. That input goes into React state and gets rendered through React's normal text path — never through `dangerouslySetInnerHTML` or DOM mutation.

### Content correctness

8. **Don't invent technical claims.** All hardware/CPU explanations must be derivable from the source book or a well-established reference. If unsure, ask — don't guess.
9. **Lessons are deterministic.** Interactive components must give the same output for the same input every time. No randomness in correctness checks unless the component explicitly seeds and exposes a "regenerate" button.

### Accessibility

10. **Keyboard navigable.** Every interactive widget must be operable with keyboard alone. Click handlers need keyboard equivalents.
11. **Color is never the only signal.** Gate states use color *and* shape/text labels.
12. **Respect `prefers-reduced-motion`.** Animations check this media query and reduce or disable when set.

---

## Lesson pattern

Every lesson follows the same shape. When adding a new one, copy `src/content/lessons/02-the-nand-gate.mdx` as a template — don't invent a new structure.

```
---
title: "The NAND Gate"
slug: "the-nand-gate"
module: "hardware-basics"
order: 2
duration: 5
prerequisites: ["what-computers-do"]
objectives:
  - "Define what a NAND gate does"
  - "Predict the output for any input combination"
draft: false
---

import NandGate from '../../components/NandGate.tsx';

[opening prose — 1-2 paragraphs]

<NandGate client:load />

[follow-up prose explaining what they just saw]

[comprehension check or puzzle]
```

The `client:load` directive hydrates the React component on the client. Use `client:visible` for components below the fold to defer hydration until scrolled into view.

---

## Architecture for gate-circuit lessons

The logic-gate curriculum is split into three layers. New gate lessons should reuse the lower layers instead of duplicating code.

### `src/lib/gates/` — pure simulation library

No React. No DOM. Just data and functions.

- `types.ts` — `Bit`, `GateKind`, `GateInstance`, `PortRef`, `Wire`, `Circuit`, etc. A `Circuit` is a plain serializable object.
- `gates.ts` — `evaluateGate(kind, in1, in2)` truth functions and `getGateArity(kind)`.
- `simulator.ts` — `simulateCircuit(circuit, inputs)` returns circuit outputs; `simulateAll(...)` returns every gate's output too (used by the canvas for wire coloring). Throws on circular wiring.
- `truth-table.ts` — `generateTruthTable(circuit)` enumerates all 2^n input combinations.

Tests live in `src/lib/gates/__tests__/`. The library has no UI dependencies and is the place to add new gate kinds, optimizations, or analysis tools.

### `src/components/gates/` — reusable circuit UI primitives

These components are framework-agnostic about which lesson uses them. They don't fetch data, don't persist state, don't know about lesson concepts — they just render whatever they're handed.

- `GateSymbol.tsx` — SVG `<g>` for a gate (NAND/NOT/AND/OR/XOR). Embeds in a parent `<svg>`.
- `Wire.tsx` — cubic-Bezier wire between two points; styled by an `active` prop.
- `InputSwitch.tsx` — iOS-style toggle button (`role="switch"`).
- `OutputBulb.tsx` — exports `Bulb` (an SVG `<g>` for embedding in a parent SVG, used by `SwitchRoom`) and a default `OutputBulb` (HTML+SVG widget for canvas use).
- `CircuitCanvas.tsx` — declarative renderer: takes a `Circuit` plus input/output values and lays everything out. No editing yet — that comes later.

### `src/components/<LessonScene>.tsx` — lesson-specific scenes

Lesson scenes (e.g. `NotFromNand.tsx`) compose the primitives above to tell one story. They:

- Build their own `Circuit` data (often two or three variants for staged reveals).
- Hold lesson-specific state (mode, observation flags) and persist it to `localStorage` under `hciw:<scene-name>:state`.
- Don't reach into the simulator or canvas internals — they pass data in and read results out.

When adding a new gate lesson, the order is: extend the library if needed → reuse primitives in a new lesson scene → embed the scene in an MDX file. Avoid copying gate-rendering or simulation code into a new component.

---

## Interactive component pattern

Components live in `src/components/`. Each component:

- Is a default-exported React functional component.
- Takes no required props (so it can be dropped into MDX without configuration).
- Manages its own state with `useState` / `useReducer`.
- Persists progress to `localStorage` under the key `hciw:<component-name>:<slug>` if relevant.
- Has a corresponding test file `<Component>.test.tsx` with at least the truth-table cases (for gates) or boundary cases (for other widgets).
- Includes ARIA labels and keyboard handlers.

### Discovery + verification pattern

Some components combine free experimentation with a quiz that checks whether the learner has noticed the underlying pattern (see `SwitchRoom.tsx`). The shape:

1. An interactive scene the learner manipulates freely — no right answer at this stage.
2. A truth table or fill-in widget the learner completes from observation.
3. Verification feedback that appears only once every cell is non-empty: a gentle prompt to keep trying if wrong, a tasteful reveal connecting the pattern to the lesson concept if right.

Use this shape for "discover the rule" lessons. Don't gate the surrounding lesson prose behind the quiz — a learner who skips the interaction shouldn't be blocked from the explanation.

---

## Adding a new lesson

1. Create `src/content/lessons/NN-slug.mdx` following the schema.
2. If the lesson needs a new interactive component, build it in `src/components/` first and write its tests.
3. Verify the lesson appears in the dev server (`npm run dev`).
4. Run `npm run build` to confirm it passes the schema validation.
5. Run `npm run test` to confirm component tests pass.

---

## Common commands

```bash
npm install              # install dependencies
npm run dev              # start dev server at localhost:4321
npm run build            # build static output to ./dist
npm run preview          # preview the built site locally
npm run test             # run component tests
npm run lint             # eslint
npm audit                # check for known vulnerabilities — run before every deploy
```

---

## Out of scope (don't propose these without being asked)

- User accounts and login
- Server-side rendering
- AI-powered features (chatbots, generated content)
- Social features (comments, sharing widgets that load third-party scripts)
- Payment processing
- Email collection

If the user later asks for any of the above, respond with the security implications first and propose the most contained possible implementation.
