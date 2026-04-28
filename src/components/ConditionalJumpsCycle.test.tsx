import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ConditionalJumpsCycle from './ConditionalJumpsCycle';

function clickStepInstruction(n = 1) {
  for (let i = 0; i < n; i++) {
    act(() => {
      screen.getByRole('button', { name: /^Step instruction$/ }).click();
    });
  }
}

function getRegisterValue(name: string): string {
  return screen.getByLabelText(`${name} value`).textContent ?? '';
}

function pickScenario(name: string) {
  act(() => {
    screen.getByRole('radio', { name: new RegExp(name) }).click();
  });
}

describe('ConditionalJumpsCycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the flag register with all four flag cells', () => {
    render(<ConditionalJumpsCycle />);
    expect(document.querySelector('[data-flag="carry"]')).not.toBeNull();
    expect(document.querySelector('[data-flag="aLarger"]')).not.toBeNull();
    expect(document.querySelector('[data-flag="equal"]')).not.toBeNull();
    expect(document.querySelector('[data-flag="zero"]')).not.toBeNull();
  });

  it('flag cells start at 0 (off)', () => {
    render(<ConditionalJumpsCycle />);
    document.querySelectorAll('[data-flag]').forEach((cell) => {
      expect(cell.getAttribute('data-on')).toBe('false');
    });
  });

  it('R0 > R1 scenario: after the program completes, R3 = 7', () => {
    render(<ConditionalJumpsCycle />);
    // Default scenario is r0-larger. The program runs 7 instructions
    // (3 DATAs + CMP + JA + ADD + JMP); 7 instruction-clicks walks through
    // the whole program. Going past would let the CPU fetch zeros from
    // beyond the program (which decode to LOAD R0, R0) and eventually
    // overwrite R3 — so we stop right at the end.
    clickStepInstruction(7);
    expect(getRegisterValue('R3')).toBe('7');
  });

  it('R1 > R0 scenario: after the program completes, R3 = 7 (via JA branch)', () => {
    render(<ConditionalJumpsCycle />);
    pickScenario('R1 > R0');
    // r1-larger only runs 6 instructions (JA branches past the JMP).
    clickStepInstruction(6);
    expect(getRegisterValue('R3')).toBe('7');
  });

  it('Equal scenario: after the program completes, R3 = 5', () => {
    render(<ConditionalJumpsCycle />);
    pickScenario('R0 = R1');
    clickStepInstruction(7);
    expect(getRegisterValue('R3')).toBe('5');
  });

  it('R1 > R0 scenario: A larger flag is on after CMP fires (CMP convention: A larger means bus > TMP)', () => {
    render(<ConditionalJumpsCycle />);
    pickScenario('R1 > R0');
    // Setup: 3 DATA cycles + 1 CMP cycle = 4 instructions.
    clickStepInstruction(4);
    expect(
      document
        .querySelector('[data-flag="aLarger"]')
        ?.getAttribute('data-on'),
    ).toBe('true');
  });

  it('R0 > R1 scenario: A larger flag is OFF after CMP fires (since R1 < R0)', () => {
    render(<ConditionalJumpsCycle />);
    clickStepInstruction(4);
    expect(
      document
        .querySelector('[data-flag="aLarger"]')
        ?.getAttribute('data-on'),
    ).toBe('false');
  });

  it('Equal scenario: Equal flag is on after CMP fires; aLarger is off', () => {
    render(<ConditionalJumpsCycle />);
    pickScenario('R0 = R1');
    clickStepInstruction(4);
    expect(
      document.querySelector('[data-flag="equal"]')?.getAttribute('data-on'),
    ).toBe('true');
    expect(
      document.querySelector('[data-flag="aLarger"]')?.getAttribute('data-on'),
    ).toBe('false');
  });

  it('Reset returns to initial state', () => {
    render(<ConditionalJumpsCycle />);
    clickStepInstruction(8);
    act(() => {
      screen.getByRole('button', { name: /^Reset$/ }).click();
    });
    expect(getRegisterValue('R3')).toBe('0');
    expect(getRegisterValue('IAR')).toBe('0');
  });

  it('persists scenario selection across mounts', () => {
    const { unmount } = render(<ConditionalJumpsCycle />);
    pickScenario('R1 > R0');
    unmount();
    render(<ConditionalJumpsCycle />);
    expect(screen.getByRole('radio', { name: /R1 > R0/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
