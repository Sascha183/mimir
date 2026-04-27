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

---

## Out of scope (don't propose these without being asked)

- User accounts and login
- Server-side rendering
- AI-powered features (chatbots, generated content)
- Social features (comments, sharing widgets that load third-party scripts)
- Payment processing
- Email collection

If the user later asks for any of the above, respond with the security implications first and propose the most contained possible implementation.
