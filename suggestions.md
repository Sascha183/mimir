# Lesson 17 — visualization approaches

The roadmap pre-named three. Below is how each plays out concretely, including how it scales to lessons 18 (stepper) and 20 (instruction cycle).

## Approach A — SVG oscilloscope (animated waveform)

A scope-trace style: 1–3 horizontal traces drawn left-to-right with `requestAnimationFrame`, sample buffers, smooth scrolling.

- **Implementation cost:** highest. RAF loop, sample windowing, fractional-pixel math.
- **Pedagogy:** most physically faithful — looks like a real EE oscilloscope. Naturally shows clk_e / clk_s offset as two overlaid traces.
- **Scales to L18 (stepper):** awkward. The stepper is fundamentally discrete ("step 3 is active"); a continuous waveform makes that information harder to read, not easier.
- **Scales to L20 (instruction cycle):** awkward for the same reason.

## Approach B — Horizontal timeline of discrete ticks ← recommended

A row of N "tick" cells. Active cell highlighted; previous cells faded. Time advances by moving the highlight rightward via a `setInterval`. Multiple signals stack as parallel rows, so you can read "tick 5: clk_e is filled, clk_s is filled one tick later."

- **Implementation cost:** moderate. One interval, one tick index, CSS handles the rest.
- **Pedagogy:** matches the actual digital-circuit reality (discrete moments, not continuous voltage). The clk_e / clk_s offset reads as "filled cell at column 5 vs column 6" — visceral and countable.
- **Scales to L18 (stepper):** directly. The stepper IS this visualization — one row, the highlighted cell IS the active step. No new pattern needed.
- **Scales to L20 (instruction cycle):** directly. Phases (fetch 1, fetch 2, fetch 3, exec 4, exec 5, exec 6) are just labeled tick cells. The CPU diagram can sit beside the timeline; clicking a tick can scrub to that moment.
- **Tick-rate slider:** trivially the `setInterval` period.
- **`prefers-reduced-motion`:** trivial — drop animation, leave the highlight.

## Approach C — Pulse / flashing indicator(s)

Two or three indicator dots that turn on/off in sync. Like a CPU's clock LED.

- **Implementation cost:** lowest.
- **Pedagogy:** strong "single bit oscillating" intuition, but the clk_e vs clk_s offset is invisible — both dots just appear to "blink together" at any reasonable rate.
- **Scales to L18 / L20:** doesn't. A blinking dot can't show a sequence.

## Recommendation: B

It's the only one of the three that doubles as the L18 stepper visualization and the L20 instruction-cycle visualization without invention. Picking A or C now means inventing a second visualization for L18, which the roadmap explicitly warns against ("the CPU diagram widget should USE THE SAME PATTERN for its time aspects. Don't invent a third animation system.").

The one place B is weaker than A: B reads as "the clock is a series of discrete moments" rather than "the clock is a continuous oscillation." I think that's fine — the lesson's goal is timing's role, not the analog physics. The prose can carry "imagine each tick is one nanosecond at 1 GHz" without the visual having to be continuous.

## Concrete L17 plan with Approach B

- A `<TimelineSignal>` primitive: takes a label, an array of bits per tick, and a current-tick index. Renders one row of cells, the active one highlighted.
- The L17 widget composes three of them stacked: `clk`, `clk_e`, `clk_s`.
- Controls: Start / Pause, Single-step, Reset, tick-rate slider (e.g., 200ms–2000ms per tick).
- The clk row alternates 1/0 every tick. clk_e is the AND of clk and "the first half of the tick window"; clk_s is the AND of clk and "the second half." Render this over ~16 ticks (= 8 full clock periods) so the pattern is obvious.
- The primitive lives in `src/components/timeline/` so L18 / L20 can import it.

---

# Lesson 18 — stepper visualization approaches

The stepper is a 7-output counter: exactly one of seven output wires is high per clock period, and the active output advances by one each period until it wraps. The pedagogical goal is to make the learner *feel* "the stepper is what gives the CPU phases — fetch fetch fetch, then execute execute execute."

The decision: how do we show the stepper relative to the L17 clock view?

## Approach A — Full instruction-cycle timeline (28 ticks) ← recommended

Top: a 28-tick timeline (= 7 full clock periods, = one complete instruction cycle) with two rows: `clk` and `clk_s`. Below: a 7-cell stepper display labeled `1` through `7` with phase tags (`fetch / fetch / fetch / exec / exec / exec / reset`), with the active step highlighted. The stepper advances when `clk_s` pulses (when the timeline tick hits phase 2 of its 4-tick period). After 7 advances, the stepper wraps and the timeline loops back to tick 0.

- **Implementation cost:** moderate. Reuse `TimelineSignal` for the clock rows; the stepper is a TimelineSignal with `cellLabels` and `bits = [1,0,0,0,0,0,0]` rotated by step.
- **Pedagogy:** strongest. Learner sees one full instruction cycle in one timeline pass. The 7 clk_s pulses line up *vertically* with the 7 step transitions — "every clk_s pulse is one click forward on the stepper." The whole timeline loops in lockstep with the stepper.
- **Width:** 28 timeline cells is wider than L17's 16. Cells get narrower (~16px each at 600px width). Still readable.
- **Cons:** the timeline is the widest of the three options. Mobile viewports may need horizontal scroll.

## Approach B — L17-matching 16-tick timeline, stepper continues across passes

Same 16-tick timeline as L17 (= 4 clock periods). Stepper sits below. As the timeline plays, the stepper advances 4 times per timeline pass. After ~1.75 passes, one full stepper cycle is complete.

- **Implementation cost:** lowest (most reuse from L17).
- **Pedagogy:** muddier. The timeline keeps wrapping while the stepper is mid-cycle, so the visual rhythm of "timeline pass = stepper cycle" is broken. Learner has to mentally track "we're in the second pass, step 5."
- **Cons:** the disconnect between the two cycle lengths is the wrong thing to highlight in this lesson.

## Approach C — Mini-clock (4 ticks = one period), stepper advances per pass

Top: 4-tick clock view showing exactly one clock period, looping. Below: 7-cell stepper. Stepper advances every time the clock view completes one loop.

- **Implementation cost:** lowest.
- **Pedagogy:** very direct: "every loop of the clock = one stepper step." The 1-to-1 mapping is unambiguous.
- **Cons:** loses the "many periods at a glance" perspective from L17. The clock view becomes a pulse animation, not a timeline.

## Recommendation: A

Reasoning:
- A is the only design where one full timeline pass equals one full instruction cycle. The pedagogical claim "the stepper has 7 phases" becomes a *visual fact* — you can count the seven clk_s pulses across the timeline and see the seven steps they trigger.
- L20 (the instruction cycle) is going to want exactly this view: 6–7 cells representing the phases of one instruction. Building A here means L20 reuses the same width/layout.
- Width is a real concern but tractable. With Tailwind's responsive utilities the timeline can scroll horizontally on mobile.

## Concrete L18 plan with Approach A

- 28-tick timeline (`clk` and `clk_s` rows) plus a 7-cell stepper row, all using `TimelineSignal`.
- Internal state: `tick` (0..27).
- Stepper's active index = `Math.floor(tick / 4)`.
- Stepper cell labels: `["1", "2", "3", "4", "5", "6", "7"]`. Phase labels rendered separately below: `fetch / fetch / fetch / exec / exec / exec / reset`.
- Controls match L17: Start/Pause, Step (one timeline tick), Reset, tick-rate slider, persisted.
- Phase indicator below the stepper names what's happening at the current step (e.g., "step 4 — execute").
- Tests cover stepper alignment with clk_s, wraparound at step 7, phase-label correctness.

---

# Lesson 19 — control section visualization approaches

The roadmap flags this as the trickiest visualization in the curriculum. The control section is a wiring panel: stepper outputs, AND'd with bits from the IR, fan out to the enable/set inputs of every register and the ALU. Scott's book draws it as a dense rats-nest of wires.

The pedagogical core: **at each step, depending on what's in the IR, a specific set of action wires fires.** Not the wiring itself — the *behavior* the wiring produces.

## Approach A — Switchboard view (steps left, actions right, animated lines)

Two columns of pins. Lines connect "step N" to each action it triggers. When step 3 is active, its outgoing lines glow.

- **Implementation cost:** moderate–high. Lines need SVG, layout math gets fussy.
- **Pedagogy:** captures the abstract truth ("control section = wiring") but the visual gets dense fast. Switching instructions to show wiring change is awkward.
- **L20 reuse:** none — L20 wants a CPU diagram, not a wiring panel.

## Approach B — Concrete instruction walkthrough (one instruction, six panels)

Pick ADD R2, R3. Show six panels, one per step. Each panel shows the CPU's registers, bus, ALU; highlights what fires.

- **Implementation cost:** high — needs a CPU diagram.
- **Pedagogy:** vivid but specific to one instruction.
- **L20 reuse:** *too much* — this IS L20, premature. Risk of duplicating work.

## Approach C — Prose only, no visualization

Skip the gate-level. Just describe in text + a simple diagram.

- **Implementation cost:** lowest.
- **Pedagogy:** thin for a 10-minute dedicated lesson. Learner gets nothing visual.

## Approach D — Step-action recipe table with instruction selector ← recommended

A 7-row table. Each row labels a step ("step 4 — execute") and lists the action wires that fire AT that step ("enable R2", "set TMP"). The currently-active step row is highlighted. An instruction selector at the top swaps the table's contents — fetch rows (1–3) stay the same across instructions; execute rows (4–6) differ. Step 7 is always reset.

- **Implementation cost:** moderate. No SVG wiring, no CPU diagram. Just a table that updates with selected instruction and active step.
- **Pedagogy:** delivers exactly the abstract truth — "the wiring fires these actions at this step for this instruction". Switching instructions is one click; the learner sees fetch (1–3) is constant and execute (4–6) varies. That comparison is the lesson.
- **L20 reuse:** the action recipes (per-instruction, per-step action lists) are the *exact same data* L20's CPU diagram will need to drive its animations. So this lesson establishes the recipes; L20 visualizes them on the CPU. Maximum leverage, zero overlap.
- **Cons:** the action names ("enable IAR", "set MAR") introduce CPU register names the learner hasn't formally met. The lesson has to briefly name them in prose. That's fine — L19 is anyway the right place to introduce IAR/MAR/IR/TMP/ACC, since they only matter once we have control wiring talking about them.

## Recommendation: D

A captures the wiring truth but the visual gets impossible. B is L20 done early. C is too thin. D shows the exact thing the lesson is teaching — *what fires when, varied by instruction* — without inventing a wiring view we'd have to throw away.

The recipes built for D become the data layer for L20's CPU diagram, so this work pays off twice.

## Concrete L19 plan with Approach D

- A small `cpu/recipes.ts` library: per-instruction step recipes. Each recipe is `Action[]` per step (length 7). Initial set: ADD (R2, R3), LOAD (R0, R1), JMPR (R0). Fetch rows shared.
- Action types: `{kind: 'enable' | 'set' | 'alu_op' | 'misc', target: string, label?: string}`. Renders as a small badge/chip.
- `ControlSection.tsx` widget: instruction selector (3 chips), 7-row table, active-step highlight tied to a tick that auto-advances every 4 ticks (one clock period — like L18 but the timeline rows aren't shown; we just animate the highlight).
- Controls: Start/Pause, Step (advance one period = one stepper step), Reset, rate slider. A bit faster than L18's per-tick because we're showing per-step granularity.
- Brief in-prose introduction of the new register names: IAR, MAR, IR, TMP, ACC. R0–R3 are the four general-purpose registers introduced retroactively here.
- Tests cover: each instruction's recipe is structurally complete (7 steps); fetch rows match across instructions; active-step highlight tracks the clock; instruction switch updates the table; persistence.

---

# Lesson 20 — instruction-cycle visualization approaches

This is the climax widget. It needs to show the full CPU: 8 special registers (IAR, MAR, IR, TMP, ACC + R0–R3), RAM, the bus, the ALU, the stepper, and an active-step indicator — all updating per step as an instruction cycle plays out. The roadmap calls it "probably the largest [component] in the codebase" and notes it gets reused by L21–26.

A central design tension: how literal should the spatial layout be?

## Approach A — Full SVG diagram with bus and arrow animations

Hand-drawn SVG layout. Bus is an actual SVG line. Registers tap it via short stub lines. ALU has wires going in/out. Animated arrows or path-draws indicate data flow each step.

- **Implementation cost:** highest. SVG layout math, coordinated path animations, motion handling.
- **Pedagogy:** most "cpu-diagram-like." Lines are real lines.
- **Reuse for L21–26:** good; the layout is fixed, only the per-step animation changes.
- **Risks:** animation timing bugs, accessibility (SVG is harder to make screen-reader friendly), overengineering for an 8-minute lesson.

## Approach B — HTML/CSS layout with a styled bus bar ← recommended

Boxes for components in HTML; the bus is a styled horizontal bar between them. No animated arrows — state changes are conveyed by border color, fill color, and value-text changes. CSS transitions on color do the visual work. SVG only used inside specific blocks if it adds clarity (e.g., the ALU's two inputs / one output topology).

- **Implementation cost:** moderate. The bulk of the work is the simulator and the per-step state model; layout is a Tailwind grid.
- **Pedagogy:** captures the topology (everything taps the bus) without forcing an SVG line-routing problem. Active "enable" goes green, active "set" goes blue, the bus shows its current byte value as text. The semantics are clear and accessible.
- **Reuse for L21–26:** excellent. Each later lesson swaps in a different recipe; the diagram doesn't change.
- **Cons:** less visually striking than Approach A. The "wires" are implicit.

## Approach C — Data-table view (minimalist)

Show the CPU as a list of register name → current value pairs. Show bus as a one-line readout. Show RAM as a small table. Animate by highlighting which rows change each step.

- **Implementation cost:** lowest.
- **Pedagogy:** loses the spatial intuition entirely. The bus stops feeling like "a thing in the middle that everyone connects to."
- **Reuse:** fine, but the lessons coming after will want the spatial layout for explanation purposes.

## Recommendation: B

A is too much engineering for a curriculum widget. C loses the spatial mental model that justifies a "diagram" lesson at all. B threads the needle: clean enough that I can ship it cleanly, rich enough that the learner sees the bus-as-shared-wire topology, reusable enough that L21–26 can plug in.

The hard part of L20 isn't the diagram — it's the **simulator**. Per-step state evolution is where the lesson's correctness lives. Save engineering budget for that.

## Concrete L20 plan with Approach B

### New library: `src/lib/cpu/`
- `types.ts` — `CpuState` (registers, RAM, stepIdx, bus snapshot fields).
- `simulator.ts` — `executeStep(state, actions)`: returns the new state. Handles all action kinds.
  - Phase A: determine bus value (whichever `enable` action fires; `enable RAM` reads RAM[MAR]).
  - Phase B: compute ALU output (if any `alu` action this step). ALU inputs: bus (input A) and TMP (input B).
  - Phase C: apply `set` actions. Special case: `set ACC` captures ALU output if there was an ALU action; otherwise captures bus. `set RAM` writes the bus to RAM[MAR].
  - Phase D: increment stepper.
- `instructions.ts` — initial state per instruction (RAM and register pre-population so each demo runs sensibly).

### New component family: `src/components/cpu/`
- `RegisterBox.tsx` — labeled register with byte value shown as decimal (and binary on hover/secondary line). Props: `name`, `value`, `state` ('idle' | 'enabled' | 'set'). Color coding follows the L19 chip palette.
- `Bus.tsx` — horizontal styled bar showing current value (decimal + binary). Shows `null` (gray "—") when no driver.
- `AluBox.tsx` — ALU with its op-select label and current output value.
- `RamPanel.tsx` — small visible window of RAM (~16 cells) with the MAR-targeted cell highlighted.
- `StepperRow.tsx` — slim 7-cell stepper row reused from `TimelineSignal`'s primitive.

### Lesson widget: `src/components/InstructionCycle.tsx`
Composes the cpu/* primitives into the full diagram. Layout (top to bottom):
1. RAM panel (16 cells visible)
2. The bus bar
3. Special registers (IAR, MAR, IR, TMP, ACC) and general registers (R0–R3) on either side of the bus
4. ALU (centered below the bus, drawing from bus and TMP, output to ACC)
5. Stepper row + active step's action chips
6. Controls: instruction selector (reuses L19's recipes), Run/Pause, Step, Reset, rate slider

### What L20 covers vs leaves for later
- L20 runs ONE instruction cycle from the recipe. After step 7, the stepper resets and IAR is one byte ahead. Clicking Step again kicks off another cycle (which will fetch whatever's in RAM at the new IAR — for the demo I'll either fill RAM with the same instruction byte, or just acknowledge in prose that "in a real program these would be different bytes").
- L23 will add the program editor. L20 just shows the cycle.

### Tests
- Simulator: ADD R2, R3 with R2=5, R3=3 produces R3=8 after a full cycle.
- Simulator: LOAD R0=42, R1=0, RAM[42]=99 produces R1=99 after the cycle.
- Simulator: JMPR R0=0x55 produces IAR=0x55 after the cycle.
- Component: instruction selector resets state; Step advances both stepper and CPU state; Reset returns to initial state; persistence of selected instruction and rate.

---

# Lesson 21 — ALU instructions: picker design

L21 is `[AUTONOMOUS]`, but the picker UX has a real design choice. The roadmap is clear that we reuse L20's CPU diagram + simulator + recipe layer; what's new is *how the learner picks an instruction*.

## Approach A — Three dropdowns (op, regA, regB)

Three `<select>` elements. Compact, familiar, accessible.

- **Pros:** smallest UI footprint.
- **Cons:** dropdowns hide the choices until clicked; the learner doesn't see "8 ops × 4 regs × 4 regs" while picking.

## Approach B — Three radio button groups ← recommended

Three rows of button chips, one per chunk of the instruction (op / regA / regB). Click any chip to swap that part. Live update of the CPU state and the instruction byte.

- **Pros:** all 16 choices (8 ops + 4 regs + 4 regs) are visible at once. Click feels exploratory. Matches the L19/L20 instruction-selector pattern, so muscle memory transfers.
- **Cons:** wider — but at 16 chips total, fits comfortably.

## Approach C — Bit-toggle interface

Eight switches; learner toggles bits and the widget decodes them into op/regA/regB labels.

- **Pros:** maximally faithful to "the instruction is 8 bits."
- **Cons:** harder to construct a target instruction. To build "ADD R2, R3" the learner has to know the encoding by heart, defeating the point.

## Approach D — Combo (B + an inline 8-bit display)

Approach B's chip rows, plus a non-interactive 8-bit display showing how the choices encode into bytes. The bit chunks are visually grouped (1 | 3 | 2 | 2) with chunk labels underneath ("ALU flag" / "op" / "reg A" / "reg B").

- **Pros:** delivers both the high-level pick AND the explicit "this is what the byte looks like" pedagogy the roadmap calls for.
- **Cons:** slightly more layout work, but it's just a styled binary string.

## Recommendation: D

The roadmap explicitly calls out the 8-bit format as part of the lesson body. Showing the byte right next to the picker turns abstract prose ("bit 0 is 1, bits 1-3 are op…") into a live demonstration the learner can poke. B alone hides the byte; D foregrounds it without making the bits the only way to interact.

## Concrete L21 plan

- New library file `src/lib/cpu/alu-instructions.ts` with:
  - `ALU_OPS` and `ALU_REGS` enums.
  - `encodeAluInstruction(op, regA, regB)` → byte (bit 7 = 1, bits 6-4 = op, bits 3-2 = regA, bits 1-0 = regB).
  - `buildAluRecipe(op, regA, regB)` → returns a `Recipe` with shared FETCH + dynamic execute (CMP omits the writeback to regB).
  - `buildAluPreset(op, regA, regB)` → returns an `InstructionPreset` with sensible initial register values and the encoded byte at RAM[0].
- New widget `src/components/AluInstructionsCycle.tsx`:
  - Three radio chip rows (op / regA / regB).
  - 8-cell byte display with the four chunks visually delineated.
  - Below: same CPU diagram primitives as L20 (RegisterBox / Bus / AluBox / RamPanel) driven by the simulator and the live recipe.
  - On any picker change: rebuild recipe + preset, reset the simulator to step 0.
- Tests cover: encoding round-trip, recipe shape (CMP step 6 empty), end-to-end ADD R2 + R3 → R3=8, AND/OR/XOR.

---

# Lesson 22 — LOAD and STORE: pre-population question

L22 is `[AUTONOMOUS]` and the picker design follows L21's chip-row pattern. The one design choice worth a moment: **how much of the initial state should the learner control?**

The roadmap says "let the learner pre-populate some RAM bytes." Three ways:

## Approach A — Fixed presets per (op, regA, regB) combination

Pick LOAD/STORE + regA + regB; the widget seeds RAM and registers with sensible defaults (RAM[7]=99 for LOAD, regB=42 for STORE, etc.). Learner runs the cycle and observes.

- **Pros:** smallest surface area. Mirrors L21 exactly. The picker change is the only mutation; everything else is canned.
- **Cons:** "pre-populate" is automated, not interactive. Less hands-on.

## Approach B — Editable RAM cells + editable registers

Make `RamPanel` cells clickable to set values. Add register-value editors. Learner sets up the scene, then runs.

- **Pros:** maximum interactivity. The learner literally puts a byte in RAM[7] and watches LOAD pull it out.
- **Cons:** materially more UI work — register editing was deliberately not built into the CPU diagram. Adding it ripples through L20–25.

## Approach C — Approach A + a small "scenario" picker ← recommended

Keep the chip pickers (op/regA/regB) + byte display from L21. Add 2–3 named scenarios (e.g., "LOAD a value from a known address", "STORE a register's contents to RAM", "Round-trip: STORE then LOAD") that each preset RAM and registers differently. The chip pickers and the scenarios are independent: scenarios pick the *narrative*, chips pick the *encoding*.

- **Pros:** keeps the L21 pattern, but offers more variety than a single canned setup. Two-phase pedagogy: "here's what LOAD/STORE *can* do" (the scenarios), and "here's how the bit encoding parameterizes it" (the chips).
- **Cons:** slightly more recipe data, but recipes are cheap.

## Recommendation: A

On reflection, even C is over-engineered for one lesson. The chip picker IS the variation — every (regA, regB) pair already gives a different scenario from the same defaults. Eight LOAD variants (R0..R3 × R0..R3) is plenty. B is a much bigger lift; C duplicates work that the chip picker already does. A keeps L22 as a 1-hour effort by mirroring L21.

If a later lesson genuinely needs editable RAM (e.g., L23 DATA's program editor), that's the right place to invest.

## Concrete L22 plan

- `src/lib/cpu/load-store-instructions.ts`:
  - `LoadStoreOp = 'LOAD' | 'STORE'`
  - `encodeLoadStore(op, regA, regB)` — opcode 0000 (LOAD) or 0001 (STORE) in bits 7-4; regA in bits 3-2; regB in bits 1-0.
  - `buildLoadStoreRecipe(op, regA, regB)`: step 4 enable regA + set MAR; step 5 either (LOAD: enable RAM + set regB) or (STORE: enable regB + set RAM); step 6 empty; step 7 reset.
  - `buildLoadStorePreset(op, regA, regB)`: for LOAD, regA gets 7 and RAM[7]=99; for STORE, regA gets 5 and regB gets 42.
- `src/components/LoadStoreCycle.tsx`: chip pickers + 3-chunk byte display (opcode 4 bits / regA 2 bits / regB 2 bits) + shared `CpuDiagram`. Same structure as `AluInstructionsCycle.tsx`.
- Tests: encoding round-trip, recipe shape, LOAD pulls 99 into regB, STORE puts 42 into RAM[5].

---

# Lesson 23 — DATA instruction + first complete program

L23 is `[AUTONOMOUS]` but introduces two things the previous widgets haven't handled:
1. **A two-byte instruction** — DATA's data byte sits at IAR+1, requiring a second IAR-advancing fetch inside the execute phase.
2. **A multi-instruction program** — the lesson's payoff is "you can now write a real program," which means the widget should run a sequence of distinct instructions back-to-back.

The first need is an extension of the recipe pattern; the second forces the widget out of "one fixed recipe per cycle" mode.

## Approach A — Single DATA demo (mirror L21/L22)

Picker for destination register + data value. One DATA cycle, just like ALU and LOAD/STORE. The full program lives in prose only.

- **Pros:** simplest. Mirrors prior lessons.
- **Cons:** misses the lesson's promised payoff ("the first complete program"). The lesson title says "DATA instruction *and* the first complete program."

## Approach B — Pre-loaded program runner (no editor) ← recommended

Pre-load RAM with a fixed 8-byte program:
```
DATA R0, 5
DATA R1, 3
ADD R0, R1
DATA R0, 14
STORE R0, R1
```
The widget runs cycle after cycle. The recipe used at each cycle is decoded *dynamically* from IR (set during fetch). A program-listing panel beside the CPU diagram shows the disassembly with the current instruction highlighted. After running through, RAM[14] holds 8.

- **Pros:** the lesson's payoff is visible. The first two instructions (both DATA) show the two-byte mechanic clearly. The third (ADD) shows ALU-on-just-loaded-data. The last (STORE) shows persistence to RAM. Five instructions cover most of what the learner has seen so far.
- **Implementation cost:** moderate. The recipe-per-cycle has to become recipe-per-IR. A new `decoder.ts` looks at IR and returns the right recipe. The widget reuses CpuDiagram unchanged.
- **Cons:** the program is fixed; learner can't write their own.

## Approach C — Editable program (drag-and-drop instructions)

Approach B + the learner can add/remove/edit instructions.

- **Pros:** maximum agency.
- **Cons:** materially more UI work; out of scope for a 9-minute lesson. A real "write your own program" experience deserves its own scope, not a corner of L23.

## Recommendation: B

It's the only one of the three that delivers the lesson's promised payoff while staying within an autonomous-build budget. The "first complete program" is concrete; the DATA mechanic is shown by the program's first two instructions; the dynamic recipe selection is the right architectural step toward Modules 4–5 anyway (which will be more programs, not more single instructions).

## Concrete L23 plan with Approach B

- `src/lib/cpu/data-instruction.ts` with:
  - `encodeDataInstruction(regB)` → byte `0010_00_RB`.
  - `buildDataRecipe(regB)` → 7-step recipe. Steps 4–6 mirror fetch's IAR-advance pattern: step 4 sets MAR to IAR + bumps ACC; step 5 reads RAM[MAR] into regB; step 6 copies ACC back to IAR (advancing past the data byte).
- `src/lib/cpu/decoder.ts` with `buildRecipeForIR(ir)` — tries ALU decode, then LOAD/STORE decode, then DATA decode. Falls back to a no-op recipe (FETCH + empty execute + RESET) for unknown bytes.
- `src/lib/cpu/program.ts` (or extend an existing module): a `PROGRAM_DEMO` constant holding the 5-instruction program as `{ ram: number[], registers: {} }`, plus a `disassemble(ram)` function that returns `[{address, mnemonic, byteCount}]` for the listing panel.
- `src/components/DataInstructionCycle.tsx`:
  - Program-listing panel showing the 5 disassembled lines with the current line highlighted (current line = the one whose first byte matches "cycleStartIAR", a piece of state that captures IAR at each step-0 transition).
  - Shared CpuDiagram (recipe = `buildRecipeForIR(cpuState.registers.IR)`).
  - Run/Step/Reset controls; a "Step instruction" button that advances 7 steps at a time (= one full cycle); a rate slider.
- Tests:
  - DATA encoding/decoding round-trip.
  - DATA recipe applied to a state where IAR=0 and RAM[0..1] = [opcode, 42] correctly puts 42 into the destination register and advances IAR to 2.
  - Running the full pre-loaded program produces RAM[14] = 8 and R1 = 8.

---

# Lesson 24 — JUMP instructions: how many programs to ship?

L24 introduces JMP (2-byte: opcode + destination address) and JMPR (1-byte: jump to address in register). Both are adding decoder + recipe entries; the new ingredient is the **loop**.

## Approach A — Single JMP loop program

One pre-loaded loop using JMP. JMPR is mentioned in prose only.

- **Pros:** smallest. Mirrors L23's single-program pattern.
- **Cons:** the lesson covers two instructions (JMP and JMPR); shipping only one feels lopsided.

## Approach B — Two loop programs (JMP and JMPR), user picks ← recommended

Two pre-loaded loops, one using each jump form. Same end behavior (R1 keeps incrementing); only the instruction encoding differs.

- **Pros:** both instructions get equal time. The user can compare side-by-side. Shows that JMPR can substitute for JMP when the destination address is already in a register.
- **Cons:** slightly more recipe data — but each is just a few bytes.

## Approach C — Three programs (linear vs JMP-loop vs JMPR-loop)

Add the L23-style linear program for contrast.

- **Pros:** the "without jumps, programs are linear and finite" point is visceral.
- **Cons:** redundant — L23's widget already runs a linear program. The contrast lives in prose ("remember the linear program?") cleanly enough.

## Recommendation: B

Both JMP and JMPR get airtime. The two demos run nearly identical loops, so the structural similarity-with-different-encoding pedagogy is direct. C is over-served; A is under-served.

## Concrete L24 plan with Approach B

- `src/lib/cpu/jump-instructions.ts`:
  - `encodeJmp()` → `0100_0000` (no operand encoded in the byte; the destination is the next byte in RAM).
  - `encodeJmpr(reg)` → `0011_00_RB`.
  - `buildJmpRecipe()` — 7-step. Step 4: enable IAR + set MAR. Step 5: enable RAM + set IAR. Steps 6 empty. (After fetch, IAR points at the address byte; JMP overwrites IAR with the byte at MAR, no further increment needed.)
  - `buildJmprRecipe(reg)` — already exists conceptually in `recipes.ts` for R0; here parameterized for any register: step 4 enable reg + set IAR.
- `src/lib/cpu/decoder.ts`: extend `buildRecipeForIR` to dispatch JMP (`0100xxxx`) and JMPR (`0011xxxx`); extend `disassemble` to render `JMP <addr>` (2-byte) and `JMPR <reg>` (1-byte).
- `src/lib/cpu/jump-programs.ts`:
  - JMP loop: `DATA R1,0; DATA R2,1; ADD R2,R1; JMP 4` — R1 increments forever.
  - JMPR loop: `DATA R1,0; DATA R2,1; DATA R0,6; ADD R2,R1; JMPR R0` — R1 increments forever using R0 as a stored target address.
- `src/components/JumpInstructionsCycle.tsx`: program picker (chips), program-listing panel, shared `CpuDiagram`. Same shape as `DataInstructionCycle` — but no automatic stop condition (these are loops; the user controls Run/Pause).
- Tests: encode/decode for both, end-to-end "run 5 iterations of JMP loop, R1 = 5", same for JMPR.

---

# Lesson 25 — flags and conditional jumps: the simulator extension

L25 is `[AUTONOMOUS]` but it's the heaviest of the autonomous lessons. It introduces:
- The **flag register** (4 bits: Carry, A larger, Equal, Zero)
- **JCAEZ** (conditional jump): 2-byte instruction with a 4-bit condition mask
- **CLF** (clear flags): 1-byte instruction

The pedagogical payoff is huge — conditionals make the CPU Turing-complete in any practical sense. The implementation question is: **how to model conditional behavior in the simulator's action-list model.**

## Approach A — Conditional action lists (dynamic recipe based on state)

Extend `buildRecipeForIR` to take `(ir, flags)`. JCAEZ's recipe builder evaluates the condition at recipe-build time, returning step 5 with one of two action lists ("enable RAM, set IAR" if jumping; "enable ACC, set IAR" otherwise). The recipe rebuilds whenever flags change (memo dep).

- **Pros:** stays inside the existing recipe model. Simulator unchanged. JCAEZ becomes "just another instruction with a state-dependent recipe."
- **Cons:** subtle — the recipe's step 5 depends on flags AT THE MOMENT the recipe is rebuilt, which is at the end of step 4 (when IR is stable and flags are last-updated). For JCAEZ specifically, flags don't change during JCAEZ's own execution, so this is safe.

## Approach B — Conditional action kind

Add a new action kind `conditionalSet { source, conditionMask }` interpreted by the simulator. The simulator picks the right source (RAM if condition, ACC if not) at execution time.

- **Pros:** the recipe is fully static; the simulator handles dispatch.
- **Cons:** adds complexity to the simulator for a one-instruction feature. The condition logic gets baked into the simulator instead of staying with the instruction.

## Approach C — Skip CLF; restrict to JCAEZ only

Save the CLF instruction for "out of scope." Just JCAEZ + flag register.

- **Pros:** smaller scope.
- **Cons:** the lesson body explicitly mentions CLF; omitting it leaves a hole.

## Recommendation: A

A keeps the architectural decisions consistent across the curriculum: every instruction has a recipe, recipes drive the simulator. The "dynamic recipe" is a small extension. CLF doesn't need conditional logic — it's just a `clearFlags` action.

## Concrete L25 plan with Approach A

### Simulator extension
- `CpuState.flags: { carry, aLarger, equal, zero }` (each `Bit`).
- `AluSnapshot.flagsOutput: { carry, aLarger, equal, zero }` — what the ALU is currently computing on its flag pins.
- `executeStep` updates `flagsOutput` whenever an `alu` action fires:
  - Carry from ADD overflow.
  - A larger from CMP (bus-side > TMP).
  - Equal from CMP (bus-side === TMP).
  - Zero from the byte output being all zeros.
- New action kinds:
  - `{ kind: 'setFlags' }` — copy `aluSnapshot.flagsOutput` into `state.flags`.
  - `{ kind: 'clearFlags' }` — zero `state.flags`.

### Recipe updates
- ALU recipes (in `alu-instructions.ts`): step 5 gets a `setFlags` action appended so flags update on every ALU op.
- New `src/lib/cpu/conditional-jump.ts`:
  - `encodeJcaez(c, a, e, z)` → `0101_CAEZ` (2-byte instruction).
  - `buildJcaezRecipe(caez, flags)` — step 4 sets MAR and ACC=IAR+1; step 5 picks RAM (if cond met) or ACC (if not) as the IAR source.
  - `encodeClf()` → `0110_0000`; `buildClfRecipe()` — step 4 fires `clearFlags`.
- Update `decoder.ts`'s `buildRecipeForIR` to take `(ir, flags?)` and dispatch JCAEZ/CLF. Existing callers pass undefined for flags (no-op for non-conditional instructions).
- Update `disassemble` to render `JC <addr>` / `JA <addr>` / `JE <addr>` / `JZ <addr>` / `JCAEZ <mask> <addr>` for combined masks, and `CLF`.

### Visualization
- `CpuDiagram` gets a flag register block showing all 4 flags with on/off styling.
- The flag block is positioned near the ALU since they're functionally connected.

### Demo programs
- "R0 > R1 → result is R0 (R0=7, R1=4)" — JA branches.
- "R1 > R0 → result is R1 (R0=4, R1=7)" — JA does NOT branch.
- "R0 == R1 → either (R0=5, R1=5)" — JA does NOT branch (A flag is 0 when equal).

All three programs share the same code: DATA-init R3 to 0, DATA-init R0 and R1, CMP R0/R1, JA <skip>, ADD R1 to R3 (else branch), JMP <end>, ADD R0 to R3 (then branch). The picker just swaps the DATA values.

### Tests
- Simulator: ALU op ADD with overflow sets carry flag.
- Simulator: ALU op CMP with R0 > R1 sets aLarger but not equal.
- Simulator: setFlags after ADD captures the carry into state.flags.
- Simulator: clearFlags zeros all four.
- JCAEZ encode/decode round-trip.
- JCAEZ recipe: with caez = 0100 (JA) and flags.aLarger = 1, step 5 enables RAM (jump).
- JCAEZ recipe: with caez = 0100 (JA) and flags.aLarger = 0, step 5 enables ACC (skip).
- CLF cycle: state.flags ends at all zeros.
- End-to-end: run "find larger" program with R0=7, R1=4 — R3 = 7. With R0=4, R1=7 — R3 = 7 (the other path).

---

# Curriculum review against the source book (2026-04-30)

The sections above are historical visualization-design notes for individual lessons. This section is a top-down review of the whole curriculum against Scott's *But How Do It Know?*, looking for content gaps, pacing issues, and pedagogical moves the book makes that the curriculum currently leaves on the table.

The shape of the recommendation is: **the curriculum is structurally strong but skips three book chapters that carry real pedagogical weight, and underweights one more.** Each of those is a candidate for a small new lesson or a meaningful expansion of an existing one. Module 4 and Module 5 are not yet sketched — I include book-aligned outlines below so the next planning pass has a starting point.

## Top-priority gap: a dedicated lesson on **Codes**

The book devotes a full chapter to *Codes* — placed deliberately right after *Eight Is Enough* (the byte) and before *Back to the Byte* (the enabler/register). The pedagogical claim is foundational and the book hammers it hard:

> "There is nothing inherent in a byte that has anything to do with a character... The letter is represented by the code. The only thing in the byte is the code."

This is the bridge between hardware (just bits) and meaning (programs, text, pixels, instructions). The same byte `0100 0001` is the number 65, the letter 'A', a particular shade of grey, and a particular CPU instruction — the meaning is *external* to the bits. Every later chapter ("Numbers" derives the binary number code, "Instructions" derives the instruction code, "Another Code" describes ASCII for the keyboard) builds on this idea.

The current curriculum:
- Lesson 9 (`the-byte`) has one paragraph noting "the same byte means different things in different contexts." Useful, but it's a side observation rather than the lesson's centerpiece.
- The roadmap notes for Module 2 explicitly flag this: *"Anything about codes, ASCII, or binary number representation — the book has more material here, and we may want a Lesson 9.5 or 12.5 specifically about codes."*
- No standalone treatment exists.

**Recommendation: add Lesson 9.5 — "Codes" — between The Byte (9) and The Register (10).**

Slug: `codes`. Duration: ~6 minutes. Prerequisites: `["the-byte"]`. Pattern: prose-led with a small interactive byte-decoder.

Body:
- Open with the book's framing: a byte holds 256 patterns; nothing in the byte itself says what a pattern means.
- Introduce ASCII as the first real example. Show the partial table from the book (A–J, uppercase + lowercase). Note the elegant detail: uppercase and lowercase of the same letter differ by a single bit.
- Note that ASCII was *invented by people in committee meetings*, not derived from anything natural. There is no mathematical reason 'A' is `0100 0001`; someone wrote it down, the industry agreed, here we are.
- Foreshadow: the next code we'll meet is the **binary number code** (the next lesson — see below). Later in the curriculum we'll meet the **instruction code** (Module 3) and another encoding for the keyboard (Module 4). All of them are codes layered on top of the same bytes.

Interactive component (`CodeDecoder`): one byte (8 toggles), four parallel readouts of the same bits — "as ASCII character", "as decimal number", "as 8-bit grey shade", "as raw bits". The same eight switches drive all four; the learner sees that nothing in the byte changes, only the code applied to it changes.

This lesson takes ~half an evening to build, costs the curriculum one interactive widget, and pays off across every later lesson where bytes are interpreted differently in different contexts.

## Major gap: a "Binary Numbers" lesson, separate from The Byte

The book's *Numbers* chapter is one of its longest and most carefully paced. It walks: tally marks → Roman numerals → decimal → senary (base-6, motivated by a three-toed sloth and clock minutes) → binary → hexadecimal. The pedagogy is gradual: by the time the learner sees binary, they understand that base-10 is one choice among many and the choice of base is constrained by your number of digits.

The current curriculum compresses this into one paragraph in Lesson 9 (`the-byte`):

> "Bit 0 (rightmost) is worth 1, bit 1 is worth 2, bit 2 is worth 4, then 8, 16, 32, 64, and finally bit 7 (leftmost) is worth 128. Add up the worths of every bit that is on, and that is the decimal value."

That paragraph asks the learner to internalize positional notation in a non-decimal base — in one paragraph, after spending the previous eight lessons thinking only in 0/1. A learner with weak math intuition may glide over it without ever feeling *why* `1101` is 13.

**Recommendation: split out a Lesson 9.7 — "Binary Numbers" — between Codes (9.5) and The Register (10).**

Slug: `binary-numbers`. Duration: ~7 minutes. Prerequisites: `["codes"]`. Pattern: prose-led with a binary-decimal converter widget.

Body:
- Frame as: codes are arbitrary; *one* code is special. The binary number code is the natural one — it requires no committee, it falls out of "what if we used positional notation with two digits instead of ten?".
- Walk the book's senary detour briefly: clock minutes (00–59) actually use a base-6 left digit. The learner already does multi-base arithmetic in everyday life.
- Then derive binary from "what if we only had two symbols?". The right column is 1s, the next is 2s, then 4s, 8s, 16s, 32s, 64s, 128s.
- Connect to the byte: the eight bits' weights are exactly the powers of two, so a byte represents 0–255.
- Note hex briefly as "computer people sometimes group four bits and call it one hex digit, so `0011 1100` = 3C". Don't dwell; the curriculum doesn't use hex elsewhere.

Interactive component (`BinaryNumberConverter`): 8 toggles + a column showing the "value if on" of each bit (128, 64, 32, 16, 8, 4, 2, 1) + a sum box at the bottom. Optional: a "type a decimal, see which bits light up" reverse converter, like the book's example with 246.

This lesson pairs with Codes (9.5) — Codes establishes that meaning is layered on bits; Binary Numbers establishes the one layering that's mathematically natural.

If the existing Lesson 9 (`the-byte`) absorbs the new material instead, the existing decimal/binary readout in `TheByte.tsx` already does the work and the prose just needs expansion. That's a lighter-weight alternative to a whole new lesson — but it leaves the byte lesson long and the codes idea understated.

## Minor gap: the "Logic" chapter

The book has a brief chapter literally called *Logic* between *The Comparator and Zero* and *The Arithmetic and Logic Unit*. It explains why ANDer/ORer/XORer are called *logic* operations (Aristotle: two facts → third fact, AND/OR/XOR fit; the adder doesn't, hence "arithmetic"). Tiny chapter, but it gives the learner the vocabulary "arithmetic and logic" so the ALU's name lands without confusion.

The curriculum jumps directly from `byte-operations` (L15) to `the-alu` (L16). The ALU's name is asserted in L16's prose without etymology.

**Recommendation: don't add a lesson — fold a short paragraph into L15 or L16.** A two-sentence aside in L15's prose (*"ADD/SHR/SHL are called* arithmetic*; AND/OR/XOR/NOT are called* logic *because they take inputs and derive an output the way Aristotle's syllogisms take facts and derive conclusions. The combined unit is therefore the* arithmetic-and-logic *unit — ALU. The name finally makes sense."*) covers the gap.

## Major gap: "What's Next?" — the bridge to instructions

Between *Doing Something Useful, Revisited* and *The First Great Invention*, the book has a chapter called *What's Next?* that opens with a remarkable analogy:

> "Imagine that the job that an employee does at a fast food restaurant gets broken down into its individual elements... Now lets say that there are 256 or less individual actions involved in the job of working at such an establishment. You could then invent a code that would associate one of the states of a byte with each of the individual activities of an employee. Then you could express the sequence of an employee's actions as a sequence of bytes."

This is the conceptual bridge: an action becomes a byte; a job becomes a sequence of bytes; a *program* is born. It's the moment instructions click as "just another code on top of bytes" — and it ties straight back to the Codes lesson.

The curriculum currently jumps from L19 (control section) directly to L20 (instruction cycle). The opening paragraph of L20 asserts "the CPU fetches an instruction from RAM, executes it, repeats" without conceptually motivating *why* an instruction is a byte in the first place.

**Recommendation: add a short prose-only lesson (L19.5) — "From Actions to Programs"** — between Control Section (19) and Instruction Cycle (20).

Slug: `from-actions-to-programs`. Duration: ~5 minutes. Prerequisites: `["control-section"]`. Pattern: pure prose with no widget, like Lesson 14 (module-2-recap).

Body:
- Use the book's fast-food-employee analogy verbatim or near-verbatim — it's that good.
- Connect to the recipes from L19: each recipe row is "an action". A sequence of recipes is "a job". If we put a byte in front of each recipe to *name* it, the byte is an *instruction*.
- Foreshadow: this is yet another code (calling back to L9.5/Codes). The instruction code is invented, like ASCII; we'll get to define it ourselves in the next lesson.
- Closing tease: time to look at the actual instruction cycle.

Cost: low — pure prose, ~250 words. Pays off by making L20 land harder.

## Major gap: "A Few More Words on Arithmetic" — the Turing-completeness moment

Between *The Clear Flags Instruction* and *Tā Daa!*, the book has a chapter called *A Few More Words on Arithmetic* that demonstrates: subtraction via NOT-and-ADD-and-1 (two's complement), multiplication via shift-and-add (with full code), division via repeated subtraction. The book gives the *complete program* for binary multiplication — about 12 instructions, all using primitives the curriculum has already covered.

This is the Turing-completeness moment made concrete. The curriculum's L25 (conditional jumps) lands the Turing-completeness *claim* with prose ("the computer is now Turing-complete"). The book's chapter actually *demonstrates* it: with only ADD, SHR, SHL, JMP, JC, CLF, the CPU multiplies two numbers. No new hardware, just a clever program.

The curriculum's planned L26 (cpu-recap) is currently scoped as "pure prose with a final demonstration widget" running "a slightly bigger pre-loaded program (maybe 10-15 instructions doing something visibly meaningful — multiplying two numbers via repeated addition, or counting from 0 to a target)." This *almost* covers the gap — but it bundles celebration and demonstration. I think they should split.

**Recommendation: rescope L26 as the multiplication-program lesson, and add a separate (very small) closing reflection.**

Concretely:

**L26 — "Subtraction, Multiplication, Division: The Turing-Completeness Moment"**
- Slug: `arithmetic-via-programs` (or keep `cpu-recap` as the slug to preserve URL).
- Duration: ~10 minutes.
- Prerequisites: `["conditional-jumps"]`.
- Pattern: extension of L25's `ConditionalJumpsCycle` widget with the book's multiplication program preloaded.
- Body covers:
  - Subtraction: NOT R1, ADD 1, ADD R0 (the book's exact example: 37 - 21).
  - Multiplication: walk through the book's 12-instruction shift-and-add program, with explicit traces of R0/R1/R2/R3 after each iteration (the book gives these traces; the lesson reproduces them).
  - Division: gestured at, not implemented (the book itself only sketches it).
- The widget extension: extend the existing program-runner from L23/L24/L25 with a new program-picker entry "Multiply 5 × 5". Step through, watch R2 climb to 25.
- The pedagogical payoff is the same as the book's: *the CPU only knows how to ADD, but it can MULTIPLY because shift-and-add IS multiplication, and the loop comes for free from JC*. There's no new hardware; the depth comes from the program.

**L27 — "What We've Built" (closing reflection, ~3 minutes, prose only)**
- Slug: `module-3-recap`.
- The current planned L26 prose, slimmed: survey the journey, name the next module.
- The widget moment is gone — that energy is now in L26.

This costs Module 3 one extra lesson but converts the climax from "celebratory text + pre-loaded demo" to "the lesson where the learner sees a CPU multiply two numbers using only ADD". The latter is dramatically more memorable.

## Pacing: Module 1 lessons 5–7 are structurally identical

Lessons 5 (AND from NAND), 6 (OR from NAND), 7 (XOR from primitives) all use the freeform `CircuitEditor` pattern with a target truth table. The book covers all three in a single chapter (*More Gate Combinations*). The curriculum's expansion to three lessons is justifiable — each gate has its own pedagogical "aha" — but three back-to-back lessons of the same widget pattern risks fatigue.

**Recommendation: don't restructure (these are shipped). But for Module 4 and beyond, watch for the same pattern — three consecutive lessons with the same interactive shape erode novelty.** If the user reports L5–L7 feeling repetitive in user-testing, the cleanest restructure would be to merge OR and XOR into a single "Compositions" lesson where the learner builds OR first as warmup and XOR as the main exercise. That would shorten Module 1 by one lesson without losing pedagogical content.

## Pacing: Module 2 ends well; the L14 recap is well-placed

Module 2's lesson 14 (`module-2-recap`) is a pure-prose pause that lands the static-vs-dynamic boundary. After reading it again, this is exactly the right move — it's the kind of breath the book itself doesn't take but probably should. Keep it.

## Module 4 sketch: peripherals (book chapters 80–87)

The book covers the outside world in seven chapters: *The Outside World*, *The Keyboard*, *The Display Screen*, *Another Code*, *The Final Word on Codes*, *The Disk*, *Excuse Me Ma'am* (interrupts), *That's All Folks*. The technical content is light per chapter — most of the gates have already been seen — but the conceptual content is genuinely new: I/O bus, peripherals, adapters, interrupts, the device-address pattern.

Suggested Module 4 lessons (to be refined when the time comes):

- **L28 — The I/O Bus**: extend the CPU bus with four control wires (I/O, Data/Address, I/O Clk e, I/O Clk s). Introduce the IN/OUT instruction. Widget: extend the CPU diagram with an I/O bus stub and a single dummy peripheral; learner sends bytes back and forth via two new instructions.
- **L29 — The Keyboard**: walk through the book's keyboard adapter (gates #1, #2, the memory bit that latches "I am selected"). Show the program that reads a keystroke into a register. Widget: a real virtual keyboard wired up via the L28 I/O system; pressing a key puts ASCII into a register. Calls back to the Codes lesson (9.5).
- **L30 — The Display Screen**: framebuffer model. The screen is a region of RAM mapped to display addresses; writing a byte to the right address turns on a pixel. The book details the scan-line model; for the curriculum, simplify to a small (8×8?) pixel grid widget where writing to RAM addresses 0–63 lights up pixels.
- **L31 — Disk and Persistence**: how a disk adapter works at the byte-bus level. Light on widget; this is more conceptual than gate-level.
- **L32 — Interrupts**: the *Excuse Me Ma'am* chapter. The CPU is in a loop; how does the keyboard tell it "a key was pressed *now*" without the CPU polling? The interrupt line, the interrupt handler, the resume-after-handler trick. This is genuinely subtle and probably needs a custom widget.
- **L33 — Module 4 recap / End of Hardware**: pure prose, ~3 minutes. Hardware is done. Next is software.

Likely 4–5 lessons total, leaning prose-heavy except L29 and L30.

## Module 5 sketch: software (book chapters 88–101)

The book ends with twelve chapters on software: *Hardware and Software*, *Programs*, *The Operating System*, *Languages*, *The File System*, *Errors*, *Computer Diseases?* (viruses/malware), *Firmware*, *Boots*, *Digital vs. Analog*, *I Lied — Sort Of*, *Full Disclosure*, *Philosophy*. Most are short prose chapters. They share a common arc: now that you understand the hardware, here's how the software stack you actually interact with sits on top of it.

The interactive density should drop sharply in Module 5 — these are reflection lessons, not simulator lessons. The risk is making Module 5 feel like a textbook after four modules of widgets. The mitigation is brevity: each lesson should be 3–5 minutes of prose, not 8–12. Possible structure:

- **L34 — Hardware vs. Software**: the book's framing. A program is just bytes in RAM; hardware doesn't care if the bytes came from the OS, a game, or a virus.
- **L35 — Programs and Languages**: machine code → assembly → high-level languages. Why a `for` loop in JavaScript ultimately becomes JMPs and JCs.
- **L36 — The Operating System**: the program that loads other programs. Memory management, peripheral arbitration, the file system as an abstraction over disk addresses.
- **L37 — Boots and Firmware**: how the computer starts. Where do the *first* instructions come from when RAM is empty?
- **L38 — Errors and Diseases**: what goes wrong. Bugs (the program is wrong), crashes (a JMP to garbage), viruses (a program someone else wrote got into RAM).
- **L39 — Digital vs. Analog**: the philosophical close. Bits are an idealization of voltages; the real hardware is analog underneath. The book's *I Lied — Sort Of* / *Full Disclosure* / *Philosophy* chapters compressed to one closing reflection.

Likely 5–6 lessons. Pure prose throughout; interactive components only where they genuinely help (e.g., a "watch a high-level statement compile to bytes" widget for L35).

## Summary of recommended changes

In rough priority order:

1. **Add L9.5 (Codes)** — biggest pedagogical payoff, foundational concept the book hammers and the curriculum understates.
2. **Rescope L26** — convert from "celebratory recap" to "multiplication-program demo". Add a short L27 for the actual reflection.
3. **Add L19.5 (From Actions to Programs)** — pure prose, fast to build, conceptually bridges control section to instruction cycle.
4. **Add L9.7 (Binary Numbers)** — give binary positional notation its own lesson, paired with Codes.
5. **Tweak L15 or L16 prose** — fold in the "logic" etymology in two sentences; no new lesson.
6. **Sketch Module 4 and 5 in CLAUDE.md** — start with the structures above and refine when the time comes.

Items 1 and 2 are the highest-leverage changes. Item 1 makes the *meaning of bytes* land properly; item 2 turns the Module 3 climax from a recap into a genuine "holy shit, the CPU just multiplied" moment. Items 3 and 4 are smaller. Item 5 is a one-paragraph edit. Item 6 is planning, not building.

None of these require restructuring shipped lessons. All are additive.

---

# User-reported issues from first-pass review (2026-04-30)

The author worked through the shipped curriculum and surfaced seven concrete issues. Five of them are pedagogical — fixable with prose and small interaction tweaks. Two of them are layout/responsive issues that need real engineering. Below is each item with the recommended fix.

## 1. Diagrams are too wide on smartphones

**Symptom:** widget canvases (NAND diagrams, bus diagrams, RAM grid, CPU diagram) overflow the viewport on phones, requiring horizontal scroll or shrinking text to unreadable sizes.

**Root cause:** widgets generally render with fixed pixel widths inside `<svg width="…">` or `<div className="w-[800px]">`-style attributes, with no responsive breakpoint behaviour.

**Recommended fix (codebase-wide):**
- For SVG-based widgets (`CircuitCanvas`, `TheDecoder`, `Bulb`, gate symbols): set `viewBox` and let the SVG scale via CSS (`width: 100%; height: auto`). Never hardcode `width="600"` on an `<svg>` element. The viewBox preserves the coordinate space; CSS handles sizing.
- For HTML-based composite widgets (`CpuDiagram`, `RandomAccessMemory`, `TheBus`): wrap in a CSS grid that drops to a single column under a `~640px` breakpoint. The CPU diagram in particular should rearrange — registers above the bus on mobile, beside on desktop. Tailwind's `sm:flex-row flex-col` plus `min-w-0` on flex children fixes most cases.
- For widgets that genuinely cannot fit (`InstructionCycle`, `RandomAccessMemory`'s 16×16 grid): wrap in a horizontally-scrollable container with a clear scroll affordance (gradient fade-out at the edges) and a small "swipe to see more" hint on first paint. This is the right move for the timeline-style widgets where the *content* really is wider than 320px.
- Audit checklist: open every existing widget at 360px viewport in Chrome DevTools mobile mode, note any horizontal scroll on the *page* (scroll on the *widget* is fine; scroll on the surrounding article body is not).

**Effort:** medium. ~1 day to audit and fix all shipped widgets. The patterns above can mostly be applied as a sweep.

## 2. Diagrams crowd the truth table on desktop

**Symptom:** in the gate-construction lessons (NAND/NOT/AND/OR/XOR), the `CircuitEditor` canvas is wide enough that the truth table beside it pushes off-screen on smaller laptop displays. Learner has to scroll right to check their work.

**Root cause:** canvas-and-table layout assumes a wide viewport (probably ≥1280px). At ~1024px laptop width, the canvas eats the row.

**Recommended fix:**
- Cap canvas width with `max-w-2xl` (≈672px) so the table always has room beside it on desktop.
- Below `lg` breakpoint (≈1024px), stack vertically: canvas on top, table directly below. The truth table is always visible without scrolling — it's the verification UI for the canvas action.
- Make the truth table sticky (`position: sticky; top: 1rem`) inside its column so even on long pages it stays in view as the learner experiments at the canvas.

**Effort:** small. One CSS change in `CircuitEditor.tsx` plus a layout tweak in each gate-construction lesson MDX (or a shared lesson layout component if one exists).

## 3. Circuit Builder is unusable on touch devices

**Symptom:** drag-and-drop is glitchy on touch, and there's no way to delete an individual gate after placing it.

**Root cause:** drag handlers almost certainly use mouse events (`onMouseDown`/`onMouseMove`) rather than pointer events. Touch events fire differently and at different timing — drags get interrupted by browser scroll, taps register as no-op clicks. And: deletion was probably designed as drag-to-trash, which doesn't survive touch UX.

**Recommended fix (this is the largest of the user-reported items):**
- **Replace mouse events with pointer events** throughout `CircuitEditor.tsx` and any drag-source components. `onPointerDown`/`onPointerMove`/`onPointerUp` handle mouse, touch, and pen uniformly. Add `touch-action: none` on the canvas surface to prevent browser scroll from stealing the gesture.
- **Add explicit selection + delete UI**: tapping a placed gate selects it (visible outline + a small `×` button appearing on the gate itself, or a "Delete selected gate" button in the toolbar). Same flow works on mouse and touch. Keyboard equivalent: Delete/Backspace removes the selected gate. Drag-to-trash can stay as a power-user shortcut for mouse but should not be the only path.
- **Add wire deletion**: same pattern — tap a wire to select it, tap the delete button to remove it. Currently if wires are also drag-to-delete-only, they have the same problem.
- **Test on a real device** before claiming the fix works. Mobile DevTools emulation does not reproduce the glitchiness; physical touch latency and gesture interruption are real.

**Effort:** medium-to-large. ~2 days. The pointer-event migration is mechanical; the selection-and-delete UI is a real interaction-design pass that should be tested on phone, tablet, and mouse.

**Bonus:** once selection exists, "show solution" (item 4) becomes much cheaper because the same selection state can drive a "highlight the next correct wire" hint progression.

## 4. Add a "Show solution" button alongside "Show hint"

**Symptom:** the "Show hint" button gives a verbal nudge, but if the learner is genuinely stuck after the hint, there's no escape hatch short of giving up on the lesson.

**Recommended fix:**
- Add a "Show solution" button to `GuidedBuilder` and `CircuitEditor`. The button is **hidden by default** and reveals only after the learner has clicked "Show hint" *and* spent at least ~30 seconds without making progress (or has clicked it twice). The friction is deliberate — we want learners to struggle a bit, not skim — but capping the friction prevents abandonment.
- On click: pop a small confirmation ("Reveal the answer? You can still experiment afterward.") and on confirm, populate the canvas with the correct circuit. The truth table on the right will go all-green.
- Critically: don't lock the learner out of the canvas after revealing. They should be able to *experiment* with the correct solution — toggle inputs, trace wires, even break and rebuild it. The point of the reveal is to convert "I'm stuck" into "now I can see what it should look like" not "you failed, here's the answer".
- A follow-up nudge: after reveal, the lesson body could surface a small "Try it again from scratch?" reset button and a one-line "Most learners get this on the second try once they've seen the structure once."

**Effort:** small-to-medium. The state transition is straightforward; the timing/gating logic and the "experiment after reveal" affordance are the parts that need care.

## 5. L7 (XOR) excludes NAND, but L8 (memory bit) brings it back

**Symptom:** L7's palette is `["AND", "OR", "NOT"]` — explicitly *no* NAND, with the framing "use only the gates you've built yourself." L8 then opens with two cross-coupled NANDs, with no acknowledgement that NAND was just exiled.

**Root cause:** this is a genuine pedagogical inconsistency, not a bug. L5–L7 promote the "we've graduated past the primitive; build from your own gates" frame. L8 needs NAND because the canonical SR latch is two cross-coupled NANDs (or NORs, but the curriculum picks NAND consistently with Module 1's choice of universal gate). The two framings collide.

**Recommended fix (prose only, no code):**

Edit L7's closing tease and L8's opener in tandem:

L7 closing tease (current ends with "the trickiest of the standard gates..."): add a short paragraph re-elevating NAND:

> *"Throughout this module, NAND has been your primitive — every gate you've built reduces to a wiring of NANDs. In the next lesson, NAND comes back to the foreground. We've used it to build computation; we're about to use it to build memory. The same little gate, two of them in a feedback loop, gives a computer the ability to remember. Watch closely — the trick is in the wiring, and it's the most surprising thing in this whole module."*

L8 opener (current opens with "I'm going to show you how a computer remembers..."): add a sentence acknowledging the return:

> *"In the last few lessons we built AND, OR, XOR by composing — using the gates we'd already built rather than reaching for raw NAND. For memory, we go back to NAND, because the cross-coupled latch is most economical at the primitive level. There's no contradiction — the principle is 'use the right level of abstraction for the job.' For computation, that's our higher-level gates. For memory, that's two raw NANDs in a feedback loop. Both are correct."*

This costs two paragraphs of prose and resolves the inconsistency. No widget changes needed.

## 6. L8 introduces pulse semantics without warning

**Symptom:** every prior lesson uses *toggle* inputs — flip a switch, it stays. L8 suddenly uses *momentary* buttons — press, release, the latch remembers. The shift from "steady state" to "time-varying input" is unannounced. Learners reasonably ask: why are we switching from 0/1 to pulses?

**Root cause:** the SR latch's semantics genuinely require pulses (steady-state inputs would either lock the latch in one state forever or — in the worst case — drive it into a metastable state). But the lesson body assumes pulses are obvious and doesn't introduce them as a new modality.

**Recommended fix (prose):**

Insert a paragraph at the start of L8, before the widget, explaining the modality shift explicitly:

> *"One thing changes in this lesson: the inputs. Until now every switch we've drawn has been a* toggle *— flip it on, it stays on, flip it off, it stays off. Memory needs something different. The Set and Reset buttons in the next widget are* momentary*: press one, it briefly puts a 1 on its wire, and the moment you release it, the wire goes back to 0. The latch sees that brief 1, captures it, and holds the new state* after the pulse is gone*. This is the first lesson where time matters — where 'what just happened a moment ago' is a thing the circuit can react to. It's a small shift in how you read the diagram, and it's the foundation of everything time-varying that comes later (the clock, the stepper, the whole CPU)."*

This also pre-loads the learner for L17 (clock signals) and L18 (stepper outputs), where time-varying signals become first-class. Currently L17 has to do that introduction cold; L8 can do half the work.

**Bonus widget tweak:** add a tiny visual cue when a momentary button is being pressed — a brief flash of "1 on the wire" graphic — to make the pulse visible. Otherwise the learner clicks Set, sees the bulb light up, releases, and may not realise that the input wire went back to 0; they may think the wire is still high. Showing the wire's *actual* current value (not just the bulb) makes the "the input is gone but the memory remains" insight visceral.

## 7. The leap from L8 to L9 is too large

**Symptom:** L8 is a deep dive into the internals of one memory bit — feedback loops, pulse semantics, two NANDs you can almost individually trace. L9 then jumps to "eight memory bits in a row, share a set wire, here's the decimal readout." From "look how this latch works" to "now you have a byte" is too fast.

**Root cause:** the curriculum lacks an abstraction step. The book itself slows down here: *Remember When* derives the memory bit, then *Eight Is Enough* explicitly says "we'll never look at the internal NANDs of a memory bit again — from here on it's a black box drawn as M with i/s/o pins." That's the missing move.

**Recommended fix (prose + a small widget tweak):**

Insert a "the memory bit becomes a building block" beat at the start of L9, before introducing the byte. Two paragraphs:

> *"In the last lesson I built one memory bit and traced its NANDs in detail. From here on, I'm not going to draw those NANDs anymore. The memory bit is a building block now — I'll draw it as a single box labeled M, with three pins: input* i*, set* s*, and output* o*. When* s *pulses, whatever's at* i *gets locked in, and shows up at* o *until the next pulse changes it. That's all I need to know to use it.*"
>
> *"This zooming out — taking a thing you understand at the gate level, then treating it as a single block — is how computers actually get built. The next time we zoom in like we did in lesson 8 will be much later, only when we genuinely need to. For most of the rest of this curriculum, every new component is built from blocks you've already understood, without re-deriving them. The byte you're about to meet is the first example: eight memory bits, side by side, sharing one set wire."*

**Bonus widget tweak:** in `TheByte`, render each of the eight stored cells as a labeled `M` block (matching the symbol from the new prose) rather than as an abstract bulb. The visual continuity with L8 — same pin names, same shape, but eight of them — makes the abstraction concrete. The learner sees that the byte is *literally* eight L8 widgets.

**Effort:** small. Prose is ~150 words; the widget tweak is a relabeling of the SVG cells.

## Summary of user-reported fixes

In rough priority order (combining pedagogical impact with effort):

1. **L8 pulse semantics paragraph** (item 6) — pure prose, fastest fix, resolves a real comprehension gap. ~30 minutes.
2. **L9 abstraction-step paragraphs** (item 7) — pure prose, addresses the L8→L9 leap. ~30 minutes.
3. **L7→L8 NAND-return paragraphs** (item 5) — pure prose, resolves the inconsistency. ~30 minutes.
4. **Widget responsive layout sweep** (items 1 and 2 together) — viewBox + breakpoint stacking + sticky truth table. ~1 day.
5. **"Show solution" button** (item 4) — small interaction-design pass plus the reveal/experiment-after flow. ~1 day.
6. **Touch-device fixes for Circuit Builder** (item 3) — pointer-events migration plus selection-and-delete UI. ~2 days. Highest engineering effort but fixes a *blocker* on phones.

Items 1–3 cost about half a working day total and resolve all the pedagogical complaints. Items 4–6 are a meaningful engineering investment but the curriculum isn't really shippable to mobile users without item 6, and item 4 is going to keep coming up the more learners hit it.

If forced to pick a single biggest leverage point: **item 6** (touch fixes) unlocks the entire curriculum for phone-first learners, which is most of the world. The pedagogical fixes are essential but small.
