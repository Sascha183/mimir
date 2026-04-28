import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import JumpInstructionsCycle from './JumpInstructionsCycle';

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

describe('JumpInstructionsCycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts on the JMP loop program with 4 disassembled lines', () => {
    render(<JumpInstructionsCycle />);
    expect(document.querySelectorAll('[data-line-address]')).toHaveLength(4);
  });

  it('switching to JMPR loop program shows 5 disassembled lines', () => {
    render(<JumpInstructionsCycle />);
    act(() => {
      screen.getByRole('radio', { name: /^Loop with JMPR$/ }).click();
    });
    expect(document.querySelectorAll('[data-line-address]')).toHaveLength(5);
  });

  it('JMP loop: after 4 instruction steps R1 = 1 (one iteration of the loop body)', () => {
    render(<JumpInstructionsCycle />);
    // Setup: 2 DATA instructions; loop body: ADD + JMP. So 4 total instructions
    // gets us through one iteration (initialize, then ADD R2,R1).
    clickStepInstruction(3); // DATA R1,0; DATA R2,1; ADD R2,R1
    expect(getRegisterValue('R1')).toBe('1');
  });

  it('JMP loop: after the JMP fires, IAR snaps back to 4', () => {
    render(<JumpInstructionsCycle />);
    clickStepInstruction(4); // DATA R1,0; DATA R2,1; ADD; JMP
    expect(getRegisterValue('IAR')).toBe('4');
  });

  it('JMP loop: 5 loop iterations leave R1 = 5', () => {
    render(<JumpInstructionsCycle />);
    // 2 setup instructions + 5 iterations of (ADD + JMP) = 2 + 5*2 = 12 instructions.
    clickStepInstruction(12);
    expect(getRegisterValue('R1')).toBe('5');
  });

  it('iteration counter increments each time IAR returns to the loop head', () => {
    render(<JumpInstructionsCycle />);
    // After setup (2 instructions), the third instruction (ADD) lands on IAR=4
    // which IS the loop head. So the first cycle that ends with IAR === 4
    // is the JMP at iteration 1. Let's run 4 iterations.
    clickStepInstruction(2 + 4 * 2);
    const counter = screen.getByLabelText('loop iteration count');
    // The counter should have incremented at least 4 times (each JMP back).
    expect(Number(counter.textContent)).toBeGreaterThanOrEqual(4);
  });

  it('JMPR loop: 5 iterations leave R1 = 5', () => {
    render(<JumpInstructionsCycle />);
    act(() => {
      screen.getByRole('radio', { name: /^Loop with JMPR$/ }).click();
    });
    // Setup: 3 instructions; loop body: ADD + JMPR. 3 + 5*2 = 13.
    clickStepInstruction(13);
    expect(getRegisterValue('R1')).toBe('5');
  });

  it('Reset returns to initial state', () => {
    render(<JumpInstructionsCycle />);
    clickStepInstruction(8);
    act(() => {
      screen.getByRole('button', { name: /^Reset$/ }).click();
    });
    expect(getRegisterValue('R1')).toBe('0');
    expect(getRegisterValue('IAR')).toBe('0');
  });

  it('persists program selection across mounts', () => {
    const { unmount } = render(<JumpInstructionsCycle />);
    act(() => {
      screen.getByRole('radio', { name: /^Loop with JMPR$/ }).click();
    });
    unmount();
    render(<JumpInstructionsCycle />);
    expect(screen.getByRole('radio', { name: /^Loop with JMPR$/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
