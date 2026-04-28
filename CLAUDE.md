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
- **Content:** MDX files in `src/content/lessons/<locale>/`, where `<locale>` is `en` or `de`. Validated against the Zod schema in `src/content/config.ts`.
- **i18n:** Astro's built-in i18n with `prefixDefaultLocale: false`. English at `/`, German under `/de/`. UI strings live in `src/i18n/<locale>.json`; access them via the `t(key, locale)` helper in `src/i18n/index.ts`. See the **Internationalization** section below.
- **Language:** TypeScript everywhere. No raw `.js` files except config files that have to be `.mjs` for tooling reasons.
- **Hosting target:** Cloudflare Pages. Build output is fully static (no server-side rendering, no edge functions). The `public/_headers` file ships security headers with the deploy.

---

## Hard rules — never violate without explicit user approval in the chat

These are the rules that protect the project's security and educational mission. Treat them as immutable.

### Security

1. **No backend services.** No Node servers, no API routes, no edge functions, no databases. If a feature seems to need one, stop and propose client-side alternatives (localStorage, IndexedDB, in-memory state). Do not silently add a backend.
2. **No user data collection.** No accounts, no analytics that track individuals, no third-party tracking pixels, no cookies that aren't strictly functional.
3. **Maintain the Content Security Policy** in `public/_headers`. Adding a new external script source, font source, or image source requires explicit user approval. Default-deny everything else.

   *Current state:* the CSP allows `'unsafe-inline'` for both styles AND scripts. This is required for Astro's hydration scripts to execute. It is acceptable because the site renders no user-controlled content, loads no third-party scripts, and the rest of the CSP (`default-src 'none'`, `frame-ancestors 'none'`, etc.) remains strict. If the site ever starts rendering user-supplied content (comments, profile fields, etc.), the CSP needs to be revisited and likely tightened with nonces.
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

Every lesson follows the same shape. When adding a new one, copy `src/content/lessons/en/the-nand-gate.mdx` as a template — don't invent a new structure. Then mirror it under `src/content/lessons/de/` (a stub linking back to the English version is fine until the translation lands — see **Internationalization**).

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

## Internationalization

The site ships in English (default, no URL prefix) and German (under `/de/`). Adding a third locale would mean adding it to the `LOCALES` tuple in `src/i18n/index.ts`, the `i18n.locales` array in `astro.config.mjs`, a new `src/i18n/<loc>.json`, a parallel page tree under `src/pages/<loc>/`, and a content subdirectory `src/content/lessons/<loc>/`.

### Layout of i18n code

- `astro.config.mjs` — `i18n: { defaultLocale: 'en', locales: ['en', 'de'], routing: { prefixDefaultLocale: false }, fallback: { de: 'en' } }`. The `fallback` is belt-and-suspenders; we intentionally ship a stub for every German page so visitors never hit a 404.
- `src/i18n/<locale>.json` — flat-ish dictionary of UI strings. Both files have identical key sets. `{name}` placeholders get substituted by `t()` via its third argument.
- `src/i18n/index.ts` — exports `t(key, locale, vars?)`, `Locale` type, the locale-aware URL helpers (`localizedRootHref`, `localizedAboutHref`, `localizedTrackHref`, `localizedLessonHref`), `switchLocalePath` (used by the language switcher), `stripLocaleSlug` (turns `en/the-nand-gate` → `the-nand-gate` for URL building), and `filterLessonsByLocale`.
- `src/components/LanguageSwitcher.astro` — text-based "EN | DE" toggle in the nav. Sets the `hciw-lang` cookie when clicked.

### Content structure

Lessons live in `src/content/lessons/<locale>/<slug>.mdx`. Astro reports each entry's `slug` as `<locale>/<slug>` (e.g. `en/the-nand-gate`). When you need the bare slug for URLs or comparisons, run it through `stripLocaleSlug()`. Schema in `src/content/config.ts` is locale-agnostic.

### Pages

The English page tree lives at `src/pages/{index,about}.astro`, `src/pages/tracks/[track].astro`, `src/pages/lessons/[...slug].astro`. The German tree mirrors it under `src/pages/de/`. Each page hardcodes its `locale` constant; both English and German lesson routes filter the `lessons` collection by the `<locale>/` slug prefix in `getStaticPaths`.

### Browser-language detection

Because deploys are static (no edge functions), language detection runs **client-side** as an inline script in `src/pages/index.astro`:

1. Only fires when `pathname === '/'`.
2. Bails immediately if the `hciw-lang` cookie is set (user already chose).
3. Otherwise checks `navigator.languages` for any `de*` entry and `location.replace('/de/')` if found.

The cookie is set by `LanguageSwitcher.astro` whenever the user clicks the switcher, so a deliberate language choice is never overridden by browser detection on subsequent visits. There is a brief flash of English before redirect on first visit; this is the explicit tradeoff for keeping the deploy static.

### Conventions when working on i18n code

- **Never hardcode user-facing strings.** Every string the visitor reads goes through `t()`. If a key is missing, add it to *both* `en.json` and `de.json` in the same change — `de.json` may use `"TODO: Übersetzen"` as a placeholder, but the key must exist so the structure stays parallel.
- **Build URLs through helpers.** Don't string-concatenate `/de/...` paths; use `localized*Href()` so a future locale slot-in works.
- **New lessons ship in both locales.** A stub linking to the English version is acceptable for `de/` until a translation lands. See existing stubs in `src/content/lessons/de/` for the exact shape (one-line italicized Markdown).
- **Adding a key everywhere.** When adding a UI string: (1) add to `en.json`, (2) add to `de.json` (use `"TODO: Übersetzen"` if no translation yet), (3) call `t('your.key', locale)` in the page/component.

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

1. Create `src/content/lessons/en/<slug>.mdx` following the schema.
2. Create the matching `src/content/lessons/de/<slug>.mdx`. If the German translation isn't ready yet, ship a stub (TODO title + a one-line link to the English version — see existing stubs for the shape).
3. If the lesson needs a new interactive component, build it in `src/components/` first and write its tests.
4. Verify the lesson appears in both locales on the dev server (`npm run dev` → `/lessons/<slug>` and `/de/lessons/<slug>`).
5. Run `npm run build` to confirm it passes the schema validation.
6. Run `npm run test` to confirm component tests pass.

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

## Future architecture

The site is currently a fully static deployment with no backend, no database, and no user accounts. Lesson progress is stored in localStorage per browser. This is intentional and matches the current scope.

When user-facing features are eventually added, they should follow this preference order:
- Bug reports / contact: external service (Formspree, Tally) — no backend needed
- Comments: external embed (giscus via iframe) — isolated from main site
- Newsletter: external service (Buttondown, Resend)
- User accounts + subscriptions: would require migration to a hybrid architecture (Cloudflare Workers for backend, Supabase or similar for DB, Clerk or Auth0 for auth, Paddle or Stripe for payments). This is a 6+ week project and should not be undertaken until there is real user demand justifying it.

Until that migration happens, do not propose adding a backend, database, authentication, or payments. Instead, identify whether an external service can solve the same problem.

---

## Curriculum roadmap — IT Basics, Module 1: Hardware fundamentals

This roadmap defines the remaining lessons in the hardware module. Lessons should be built strictly in order. Each lesson follows the established patterns (GuidedBuilder for guided construction, MDX with first-person singular voice, embedded interactive component, prev/next navigation handled automatically by the lesson layout).

Status legend: `[x]` done, `[ ]` todo, `[~]` in progress

### Done
- [x] Lesson 1: What computers actually do (slug: what-computers-do)
- [x] Lesson 2: Bits — atoms of information (slug: bits)
- [x] Lesson 3: The NAND gate (slug: the-nand-gate)
- [x] Lesson 4: Building a NOT gate (slug: not-from-nand)
- [x] Lesson 5: Building an AND gate (slug: and-from-nand)
- [x] Lesson 6: Building an OR gate (slug: or-from-nand) — followed Lesson 5's freeform `CircuitEditor` pattern (target truth table + hint + success block) rather than literal step-gating; matches the established conceptual model.
- [x] Lesson 7: Building an XOR gate (slug: xor-from-primitives) — palette is AND/OR/NOT (no NAND), forcing composition with gates the learner has built. Same freeform pattern as 5 and 6.
- [x] Lesson 8: The memory bit (slug: memory-bit) — built as a self-contained `MemoryBit.tsx` (option b from the roadmap). The shared simulator was *not* extended; it still rejects feedback loops, and `CircuitEditor`'s cycle detection remains intact. Latch state machine + click-pulses are encoded directly in the component, reusing only the visual primitives (`GateSymbol`, `Wire`, `Bulb`).

### Todo

#### [x] Lesson 6: Building an OR gate (done)
- **Slug:** or-from-nand
- **Order:** 6
- **Duration:** 7 minutes
- **Prerequisites:** ["and-from-nand"]
- **Pattern:** GuidedBuilder, modeled closely on Lesson 5 (and-from-nand)
- **The pedagogical insight:** OR can be built by inverting both inputs of a NAND. So: NOT(A) and NOT(B) feed into a NAND. The result is OR. (This is De Morgan's law applied — but DO NOT name it that. The point is for the learner to feel the elegance, not to memorize a theorem.)
- **Step sequence (5 steps):**
  1. **Observe:** A pre-placed NAND with both inputs wired to A and B. Instruction: "Here's the same NAND from before. Toggle the switches and remind yourself how it behaves. We're going to use this — but flipped."
  2. **Add NOT to A's path:** Allow learner to drag a NOT gate. Instruction: "Drag a NOT gate onto the canvas. We're going to flip input A before it reaches the NAND."
  3. **Wire A through the NOT:** Constrain wires so the only valid action is rewiring A → NOT_1.in, then NOT_1.out → NAND.in1. Instruction: "Disconnect A from the NAND. Then route A through the NOT, and the NOT into the NAND's first input." (The wire-deletion has to be allowed in this step — adjust GuidedBuilder if needed to support `deleteWires` selectively.)
  4. **Repeat for B:** Same as step 2-3 but for B. Instruction: "Now do the same for B. Add another NOT and route B through it into the NAND's second input."
  5. **Verify:** Instruction: "Look at the truth table. Y is on whenever A or B (or both) are on — that's an OR gate. You just built it by inverting both inputs of a NAND."
- **Hint** (revealed via "Stuck?" button in Step 3): "Remember the symmetry — the NOT bubble is the visual sign of inversion. If I invert *both* inputs going into a NAND, I get the opposite behavior."
- **Success block text:** "You just built an OR gate. The trick was symmetry: NAND is 'NOT (A AND B)' — and OR turns out to be 'NOT(A) NAND NOT(B)'. The two operations are mirror images of each other. This deep relationship between AND and OR (with inversion sprinkled in) shows up everywhere in computing — from logic to programming to math. You'll see it again."
- **Closing tease:** "Next: XOR. The trickiest of the standard gates, and the most useful for what comes after — addition, comparison, encryption. It's the first gate that needs more than one or two NANDs to build."

#### [x] Lesson 7: Building an XOR gate (done)
- **Slug:** xor-from-primitives
- **Order:** 7
- **Duration:** 10 minutes (longer — this is genuinely complex)
- **Prerequisites:** ["or-from-nand"]
- **Pattern:** GuidedBuilder, but with more freedom. Allow the learner to use AND, OR, and NOT as primitives (NOT just NAND). Pedagogically, this is where we shift from "everything is NAND" to "we can compose at higher levels." This earns the learner: by lesson 7 they've built AND, OR, NOT themselves, so it's fair to use them as building blocks.
- **The pedagogical insight:** XOR is "exactly one of the two inputs is on" — it's the OR but excluding the case where both are on. So: XOR = (A OR B) AND NOT(A AND B). Five gates total: 1 OR, 1 AND, 1 NAND (or NOT after AND), wired into a final AND.
- **Available gates in palette:** ["AND", "OR", "NOT"] — note: not NAND. Force the learner to think in terms of the gates they've built, not the primitive.
- **Step sequence (5 steps):**
  1. **Discuss the problem:** No interactivity yet — just a long instruction explaining what XOR is and why it matters (parity, addition, equality checking). Frame it as a puzzle: "How would you build a gate that turns on only when exactly one input is on?"
  2. **Build the OR half:** Add an OR, wire A and B to it. Instruction: "Start with what you know: an OR gate is on when at least one input is on. That's almost what we want — except we don't want it on when BOTH are on."
  3. **Build the AND half:** Add an AND, also wire A and B to it. Instruction: "Now add an AND. This will tell us when BOTH inputs are on — exactly the case we want to exclude."
  4. **Invert the AND:** Add a NOT after the AND. Instruction: "Add a NOT to flip the AND's output. Now we have a signal that's on UNLESS both inputs are on."
  5. **Combine:** Add a final AND that takes (OR output) and (NOT-AND output) as inputs, wires to Y. Instruction: "The last step: combine your two signals. Y should be on only if (at least one input is on) AND (it's not the case that both are on). That's XOR."
- **Hint after Step 5 if stuck:** "Think of it as two conditions that both need to be true: 'at least one is on' AND 'they're not both on'. Each condition is one of the signals you built."
- **Success block text:** "XOR — exclusive OR. It's true when exactly one input is true, false when both are off OR both are on. This is the gate that powers binary addition (the carry-less part), comparison (equal? not equal?), and one-time-pad encryption. It also marks a turning point: from now on, complex circuits are built not from raw NANDs but from compositions of gates you've built. That's how all real chips are designed — bottom-up, layer by layer."
- **Closing tease:** "So far every gate has been about computation — taking inputs and producing outputs. The next lesson breaks something that has felt like a rule the whole time: every output depends only on the current inputs. What if a gate could remember? That's where things get strange — and that's where computers get their memory."

#### [x] Lesson 8: The memory bit (done)
- **Slug:** memory-bit
- **Order:** 8
- **Duration:** 12 minutes
- **Prerequisites:** ["xor-from-primitives"]
- **Pattern:** This lesson likely needs custom work, NOT just GuidedBuilder. Reason: feedback loops. Every previous lesson assumed acyclic circuits — but a memory bit REQUIRES a loop (the gate's output feeds back into its own input chain). The simulator may need adjustment to handle this correctly.
- **CRITICAL:** Before building this lesson, check whether the simulator (src/lib/gates/simulator.ts) handles feedback loops. If it currently throws "circular wiring detected", we need to either (a) extend the simulator with stable-state computation for feedback circuits, or (b) build a custom mini-simulator just for this lesson that does timed/clocked evaluation. Do NOT silently break the cycle detection — it's there for a reason in regular circuits.
- **The pedagogical insight:** Two NAND gates wired in a cross-coupled feedback loop form a "set-reset latch" — the simplest possible memory. When you "set" it (briefly pulse one input), the latch holds the new state until you "reset" it. This is genuinely mind-blowing because:
  1. The same NAND that did pure computation can ALSO hold state
  2. State emerges from feedback, not from any new physical mechanism
  3. This is how ALL computer memory works, all the way up to RAM
- **Suggested approach:**
  - Use a custom interactive component (NOT GuidedBuilder) showing a fixed cross-coupled NAND latch
  - Two input switches: "Set" and "Reset" (momentary buttons, not toggles — they spring back)
  - Two output bulbs: Q and Q-bar (always opposite)
  - When learner presses Set: Q goes on, stays on after release
  - When learner presses Reset: Q goes off, stays off after release
  - When both inputs are at rest: state is preserved
  - The "magic" is that the gate REMEMBERS — pressing nothing keeps the state
- **Lesson body should:**
  - Open with the audacity of the claim: "I'm going to show you how a computer remembers things. Brace yourself, because the trick is going to feel like cheating."
  - Explain that until now, every gate's output depended only on its current inputs. Memory needs something more — a way for the past to influence the present.
  - Introduce the cross-coupled NAND configuration. Show it visually before the interactive widget. The wiring is genuinely unusual and benefits from being seen first.
  - Embed the widget. Explicitly invite the learner to: press Set, release, observe; press Reset, release, observe; do nothing and observe.
  - The reveal: "The output didn't go away when you released the button. That's because the output is also one of the inputs. The gate is, in a real sense, listening to itself. And that's all memory is — at every level, all the way up to your phone's RAM. A signal that loops back into itself."
  - Closing reflection: "This is the end of Module 1. You started with a switch and a light. You ended with a circuit that can remember. Everything in a computer — every photo it stores, every webpage it loads, every word in this lesson — is built from billions of these tiny memory cells, plus the gates you built earlier to manipulate them. There's nothing else. There never was anything else."
- **Closing tease (optional, if Module 2 is planned):** "Module 2: from a single memory bit to bytes, registers, and the memory grid. We're going to scale this up."

### Working agreements for autonomous lesson building

When working through these lessons in sequence, follow these rules:
- **Build in order.** Don't skip ahead, even if a later lesson seems easier.
- **Test in browser after each lesson.** Run `npm run dev`, navigate to the lesson, click through it manually. If something is visually broken or interactively broken, fix it before moving on.
- **Commit after each completed lesson.** Use clear messages like "lesson 6: OR gate via guided builder".
- **Update this roadmap.** When a lesson is done, change `[ ]` to `[x]` and append a one-line note about anything notable.
- **Stop and ask for human input only when:**
  - A pedagogical decision is genuinely ambiguous (e.g., "should this be guided or freeform?")
  - The simulator or library needs a non-trivial extension (especially for Lesson 8's feedback loops)
  - A test fails in a way that suggests a real bug, not just a flaky test
  - The build breaks and the cause is unclear after one attempt to fix
- **Don't ask for human input on:** styling tweaks, prose phrasing, hint wording, color choices, layout decisions. Make a reasonable choice and move on. The human will polish during review.

## Curriculum roadmap — IT Basics, Module 2: From bits to RAM

This module builds the "memory half" of the computer. We start with a single memory bit (which Module 1 ended with) and scale up: 8 bits become a byte, byte storage gets controlled access (the Enabler), Enabler + byte forms a Register, registers connect via a Bus, decoders select among many registers, and finally many registers in a grid plus an address register form RAM.

Pedagogically, Module 1 was about "what is a thing." Module 2 is about "what happens when many things work together." Less individual gate logic, more about systems, addressing, and the elegance of composition. Visual abstraction matters more here — at some point we stop drawing every NAND and start drawing higher-level building blocks.

Module 2 ends WITHOUT the CPU. The CPU (ALU, control unit, instructions, machine language) is Module 3. Splitting them keeps each module's cognitive load reasonable.

Status legend: `[x]` done, `[ ]` todo, `[~]` in progress

### Module 2 lessons

#### [x] Lesson 9: From one bit to many — the byte (done) — built as `TheByte.tsx`, a custom state-machine widget. Eight `InputSwitch` toggles + a single Store button + an SVG visualizing the shared `s` wire. Inputs and stored byte are kept in a single combined `useState` so functional updates always see the latest inputs (avoids stale-closure bugs when state-changing events fire in quick succession). Decimal/binary readouts reflect `stored`, never `inputs`.
- **Slug:** the-byte
- **Order:** 9
- **Duration:** 8 minutes
- **Prerequisites:** ["memory-bit"]
- **Pedagogical insight:** A single memory bit can hold one yes/no answer. To represent something more interesting (a number, a letter, a color), we put eight bits side by side. They share a single "set" wire, so all eight capture their inputs at the same instant. This is a byte. The book frames this with a memorable image: "a bite is a mouthful, a byte is the digital equivalent."
- **Component pattern:** Custom widget (NOT GuidedBuilder). Visual representation of 8 memory bits in a row, sharing a "set" line. Learner can: click 8 input switches to set values, press a single "store" button (the shared 's' wire) to capture all of them simultaneously, see the byte's stored value displayed in three forms — as 8 bits visually, as a binary string ("0010 1101"), and as a decimal number (45).
- **Key visual moment:** When the learner clicks "store", all 8 bits flash/animate at the same instant — emphasizing the "atomic" nature of byte writes.
- **Lesson body should cover:**
  - Reframe from Module 1: we built a single memory bit. But one bit is barely useful — it can only answer one yes/no question.
  - The trick: take 8 of them, line them up, share their "set" wire. Now one click captures 8 bits at once.
  - Why exactly 8? It's a historical convention — small enough to be cheap to build, big enough to be useful (256 possibilities means we can represent every letter of the alphabet, every number 0-255, and a lot more besides). The book explains this lightly — keep it light too.
  - Demonstrate the widget. Encourage the learner to set various patterns and observe the decimal interpretation update.
  - Brief note: the order of bits in a byte matters — it gives us a code (binary number code). We'll explore that more in the next lesson.
  - Closing tease: but storing a byte is half the battle. We also need to control WHEN it gets used — when we let it out and when we keep it private. That requires one more idea.

#### [x] Lesson 10: Controlling access — the Enabler and the Register (done) — built as `TheRegister.tsx`. Reuses lesson 9's byte-write UI (8 toggles + Store) and adds an Enabler block: 8 ANDs rotated -90° so data flows top-to-bottom, with a single shared horizontal enable line crossing every gate's enable input. Output cells beneath show stored AND enable per bit. Side-by-side stored/output readouts make the gating obvious. Reset clears everything including enable.
- **Slug:** the-register
- **Order:** 10
- **Duration:** 8 minutes
- **Prerequisites:** ["the-byte"]
- **Pedagogical insight:** A byte alone is "always on" — its outputs are always visible to whatever's connected. In a real computer, we need to control when a byte's contents are exposed to the rest of the system. The Enabler (8 AND gates with a shared "enable" line) does this: when "enable" is on, the byte passes through; when off, the outputs are forced to zero. Combine a byte with an Enabler, and you have a Register — the building block of all CPU storage. The book makes a lovely point here: the word "gate" finally makes sense. An enabler is literally a gate that opens and closes.
- **Component pattern:** Custom widget extending the byte widget from Lesson 9. Show: a byte (from previous lesson, simplified) → an Enabler (8 AND gates visible, then collapsible to a "block" view) → output. The learner has TWO controls now: set bit (write to byte) and enable bit (let the byte's contents through to the output). Demonstrate the four operational states: byte empty + enable off, byte empty + enable on, byte stored + enable off (output is all zeros even though byte holds data!), byte stored + enable on (output reveals the data).
- **Key visual moment:** When the learner toggles "enable" with a stored byte, the output bits visibly switch between "0000 0000" and the actual stored value. This is the moment that "controlled access" clicks.
- **Lesson body should cover:**
  - Recap the byte — but point out a problem. A byte's outputs are always on. If 8 bytes are all hooked up to the same wires, all 8 try to drive those wires at once. Conflict. We need a way to say "only one byte talks at a time."
  - Introduce the Enabler. Show the wiring: 8 AND gates, all sharing one "enable" wire on their second input. When enable is off, no AND gate can output 1, so the entire byte is muted. When enable is on, every bit passes through.
  - The combined unit (byte + enabler) is called a Register. The "R" abbreviation will appear in every diagram from now on.
  - Demonstrate the widget. Walk through the four states described above.
  - Why this matters: this is how the CPU has multiple working bytes (R0, R1, R2, etc.) all sharing the same wires without interfering with each other. Only one register is "enabled" at any given moment.
  - Closing tease: now that we can mute and unmute registers, we can connect many of them to the same shared wire — a Bus.

#### [x] Lesson 11: The Bus — moving data (done) — built as `TheBus.tsx`. Three registers (R0/R1/R2) tap a single shared 8-bit bus drawn as one thick horizontal line. Eight input switches act as a permanent always-on source that drives the bus when no register is enabled. Each register has Set (capture from bus) and Enable (drive onto bus). Bus value is computed from a single `computeBus(state)` function: 0 enabled → inputs, 1 enabled → that register, 2+ enabled → conflict. During conflict the bus turns red, the readout becomes a role=alert warning, and Set buttons get `disabled`. `pulseSet` uses functional setState so it always sees the freshest enables.
- **Slug:** the-bus
- **Order:** 11
- **Duration:** 9 minutes
- **Prerequisites:** ["the-register"]
- **Pedagogical insight:** A bus is just 8 shared wires that connect multiple registers. To move data from R1 to R4, you turn on R1's enable bit (R1's contents now appear on the bus) and pulse R4's set bit (R4 captures whatever is on the bus). The data was "copied", not "moved" — it still exists in R1. The bus is bidirectional: any register can write to or read from it. The only rule: never enable two registers onto the bus at the same time, or their outputs conflict.
- **Component pattern:** Custom widget showing 4-5 registers connected to a horizontal bus. Each register has visible "enable" and "set" buttons. The bus itself shows a live byte value (whatever's currently being driven onto it, or "—" if nothing). The learner can: store different values into different registers (using set), then perform copy operations (enable source register, pulse destination register's set). The widget visualizes the data flowing across the bus with a brief animation.
- **Special interactive moment — the conflict warning:** If the learner tries to enable two registers simultaneously, the widget shows a clear error state: bus turns red, message appears: "Two registers are trying to talk at once. The bus only works when one register is enabled at a time." This makes the rule visceral.
- **Lesson body should cover:**
  - Introduce the problem: I have R1, R2, R3, R4. I want to copy a byte from R1 to R4. How?
  - Solution: connect them all to the same 8 wires. Call those wires "the bus."
  - The protocol: enable source, pulse destination's set. Bus carries the byte from one to the other for one moment. Done.
  - Crucial rule: only one register enabled at a time. Demonstrate the conflict in the widget.
  - The bus is the highway of the CPU. The CPU's job is essentially: move bytes between registers via the bus, sometimes transforming them along the way.
  - The book also points out: when you "copy" R1 to R4, R1 is unchanged — it's a copy, not a move. This is true at the hardware level even if programmers sometimes say "move R1 to R4" colloquially.
  - Closing tease: with bytes, registers, and a bus, we can store and move data. But how do we choose WHICH register to enable when we have many of them? That's the next idea — the decoder.

#### [x] Lesson 12: The decoder — choosing one of many (done) — built as `TheDecoder.tsx`. A 2-to-4 decoder rendered as four labeled rows (`¬A·¬B`, `¬A·B`, `A·¬B`, `A·B`) → AND pill → output bulb. Toggle A/B; the matching row lights up, the rest dim. Avoided rendering 4-to-16 or 8-to-256 per the roadmap's "use abstraction" guidance — the lesson prose carries the scaling argument verbally.
- **Slug:** the-decoder
- **Order:** 12
- **Duration:** 7 minutes
- **Prerequisites:** ["the-bus"]
- **Pedagogical insight:** A decoder takes N input bits and turns on exactly one of 2^N output wires — corresponding to the binary value of the inputs. With 2 input bits we can select 1 of 4 outputs; with 3 inputs, 1 of 8; with 8 inputs, 1 of 256. This is how a CPU points at exactly one register or memory location: the decoder takes a binary "address" and activates the corresponding wire. It's elegant, and it's the bridge between binary numbers (Lesson 2) and addressing.
- **Component pattern:** GuidedBuilder OR custom widget — author's choice. Either way, show: input bits on the left (start with 2-bit decoder, then expand to 3-bit), decoder logic in the middle (AND gates with various NOT'd inputs), output wires on the right with only one lighting up at a time. Learner toggles input bits, watches the active output change.
- **Recommended approach:** Custom widget. Show a 2x4 decoder first (manageable visualization), then a "now imagine 256 of these" abstraction for the larger case. Don't try to render a 4-to-16 or 8-to-256 decoder fully — it would be overwhelming. The point is the principle, not the wiring.
- **Lesson body should cover:**
  - The problem: I have 4 registers but only one bus. How does the CPU choose which one to enable?
  - The naive solution: 4 separate "enable" wires, one per register. The CPU sets the right one. Works, but doesn't scale — for 256 RAM locations, 256 wires.
  - The decoder: turn a small binary number (the "address") into a large 1-of-N selection. With 8 input bits we can pick one of 256 outputs.
  - Demonstrate the 2-to-4 decoder in the widget. Toggle inputs (00, 01, 10, 11), see which output lights up.
  - Connect to addressing: this is exactly how memory addressing works. Put a number into an address register, the decoder turns that number into "select this one byte out of 256."
  - Closing tease: now we have all the pieces — bytes, registers, bus, decoder. Time to put them together into the most important storage system in any computer: RAM.

#### [x] Lesson 13: Random Access Memory (done) — built as `RandomAccessMemory.tsx`. 256-byte store rendered as a 16×16 grid of 22 px cells; per the roadmap, no cell tries to display its 8 bits. Cells are stored as a flat `number[256]` (each 0..255) rather than `Bit[256][8]` to keep state and JSON small. MAR is 8 toggle switches; clicking any grid cell also writes that cell's index into the MAR (both routes mentioned in the roadmap). Selected cell readout shows binary + decimal; data toggles + Write button capture the data into the selected cell. "Clear cell", "Clear all", and "Reset" cover destructive cases without nuking the bit/data setup mid-experiment.
- **Slug:** ram
- **Order:** 13
- **Duration:** 12 minutes
- **Prerequisites:** ["the-decoder"]
- **Pedagogical insight:** RAM is built from 256 registers arranged in a 16×16 grid, plus a Memory Address Register (MAR) that selects which one is active. Two 4-to-16 decoders (one for the row, one for the column) intersect at exactly one cell — that's the selected register. The "random access" in RAM means: any byte can be read or written in equal time, regardless of where it is in the grid. This is the second half of the computer (the first half being the CPU, which we'll build in Module 3).
- **Component pattern:** Custom widget. This is the climax of Module 2 and deserves a polished visualization. Show: the MAR on the left (8 input bits, displayed as binary AND decimal), two decoders feeding into a 16×16 grid (don't try to render every register — show a stylized grid with the selected cell highlighted), bus + set/enable controls at the bottom. Learner can: type or click an address into the MAR, watch the grid highlight the corresponding cell, read or write that cell with the bus.
- **Suggested simplifications for the widget:**
  - Don't render 256 individual registers visually — that's overwhelming. Render a stylized 16×16 grid where each cell is small (~20px), the selected cell is brightly highlighted, and clicking on the grid is one way to set the MAR.
  - Provide both an address input (MAR) and a "current contents" display side by side, so the learner can see "address 42 holds the value 0010 1101 (45)".
  - Allow the learner to write to several addresses, then come back and read them — proving that data persists per address.
- **Lesson body should cover:**
  - The vision: a computer needs to remember thousands of bytes — programs, data, the current state of everything. We're going to build storage for 256 bytes (small for real computers, plenty for our learning purposes).
  - The architecture: take 256 registers, arrange them in a 16×16 grid. Use two decoders (one for the row, one for the column) — at any moment, only one row line is active and one column line is active. The single register at their intersection is "selected."
  - Selection happens via the Memory Address Register (MAR). Put a number 0-255 into MAR. The first 4 bits drive the row decoder, the last 4 bits drive the column decoder. One cell is selected. That cell's set/enable wires are now wired up to the bus.
  - Demonstrate the widget: write a value, change the address, write a different value, change back, read the first value. The data is there, untouched.
  - Why "random access": unlike a tape or a queue, you can jump to any address instantly. Address 0, then address 200, then address 73 — same speed each time. This property is so important it gave the technology its name.
  - The big reveal: this is half a computer. We have storage. The other half — the part that does things with stored data — is the CPU. That's Module 3.
  - Closing for Module 2: pause and reflect. We've gone from a single memory bit (could remember one yes/no) to RAM (can remember 256 different things, each one a byte, each one accessible in any order). The leap is enormous, and yet every part of it was built from gates the learner constructed in Module 1. Nothing new was added at the bottom. The complexity emerged from arrangement.

### Closing reflection lesson — optional but recommended

#### [ ] Lesson 14: What we have so far (a pause)
- **Slug:** module-2-recap
- **Order:** 14
- **Duration:** 5 minutes
- **Prerequisites:** ["ram"]
- **Pattern:** Pure prose — no interactive widget needed. A reflective pause before the heavy lift of Module 3 (the CPU).
- **Body should:**
  - Survey the journey so far. Module 1: gates from a single NAND. Module 2: storage from those gates.
  - Make an explicit promise: Module 3 will build the other half — the part that DOES things. The CPU. ALU. Instructions. The thing that takes the data sitting in RAM and turns it into a running program.
  - Note that we're now standing on the boundary between "static structures" (what we've built) and "dynamic behavior" (what's coming). Computers, fundamentally, are about that combination — memory plus a thing that operates on memory, repeated billions of times per second.
  - Brief author's note about pacing: if Module 1 was concrete and tactile, Module 2 was about composition. Module 3 will be about choreography — many parts dancing in coordinated steps. Different in feel, but built on everything we've already learned.
  - Tease Module 3.

### Notes for autonomous building

#### Visual abstraction matters
By Lesson 11 (the bus), the CircuitCanvas with individual NAND gates becomes too cluttered. Module 2 lessons will use higher-level visualizations:
- Bytes shown as 8 bits in a row, not 32 NAND gates
- Registers shown as a single labeled box, not their internal byte+enabler
- Buses shown as a thick line with byte values displayed
- RAM shown as a stylized grid, not 256 individual register boxes

This is intentional. The lessons explicitly note "we're not drawing every gate anymore — we're zooming out" so the abstraction is a teaching point, not a hidden simplification.

#### Components are mostly custom, not GuidedBuilder
Module 2 has fewer "build the circuit yourself" lessons. Most lessons demonstrate a fixed structure (a byte, a register, RAM) and let the learner manipulate inputs and observe outputs. GuidedBuilder is overkill when there's nothing to construct. Use the existing custom-widget pattern from MemoryBit as the model.

#### Simulator extension may not be needed
The Module 2 widgets are mostly state-machine-style (bytes, registers, RAM cells with set/enable inputs). Most can be implemented with plain React useState — they don't need the gate-level simulator. Only fall back to extending src/lib/gates/simulator.ts if a widget genuinely benefits from gate-accurate simulation.

#### Pedagogical decisions that need human judgment
Stop and ask if any of these come up:
- Whether to actually render the 4-to-16 or 8-to-256 decoder gates, or use the abstraction approach (recommend abstraction)
- Whether the RAM widget should let the learner type addresses or click on the grid (recommend both)
- Whether Lesson 14 (the recap) is worth building or feels filler-y (author can decide based on how the rest reads)
- Anything about codes, ASCII, or binary number representation — the book has more material here, and we may want a Lesson 9.5 or 12.5 specifically about codes. But the current plan rolls "binary numbers" into Lesson 9 lightly. If it feels rushed, propose a separate codes lesson.

#### Don't build Module 3
Module 3 (the CPU) is its own scope. After Lesson 14 (or Lesson 13 if 14 is skipped), STOP. Do not start the CPU. The learner should hit a clear "End of Module 2 — Module 3 coming soon" boundary, ideally with a "Coming soon" track entry visible in the IT Basics overview.

---

## Out of scope (don't propose these without being asked)

- User accounts and login
- Server-side rendering
- AI-powered features (chatbots, generated content)
- Social features (comments, sharing widgets that load third-party scripts)
- Payment processing
- Email collection

If the user later asks for any of the above, respond with the security implications first and propose the most contained possible implementation.
