import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AluInstructionsCycle from './AluInstructionsCycle';

function clickStep(n = 1) {
  for (let i = 0; i < n; i++) {
    act(() => {
      screen.getByRole('button', { name: /^Step$/ }).click();
    });
  }
}

function pickOp(name: string) {
  act(() => {
    screen
      .getByRole('radiogroup', { name: 'op' })
      .querySelector(`button[aria-checked][role="radio"][type="button"]`); // sanity touch
    const target = Array.from(
      screen.getByRole('radiogroup', { name: 'op' }).querySelectorAll('button'),
    ).find((b) => b.textContent === name);
    if (!target) throw new Error(`No op button: ${name}`);
    (target as HTMLButtonElement).click();
  });
}

function pickReg(group: 'reg A' | 'reg B', name: string) {
  act(() => {
    const target = Array.from(
      screen.getByRole('radiogroup', { name: group }).querySelectorAll('button'),
    ).find((b) => b.textContent === name);
    if (!target) throw new Error(`No ${group} button: ${name}`);
    (target as HTMLButtonElement).click();
  });
}

function getRegisterValue(name: string): string {
  return screen.getByLabelText(`${name} value`).textContent ?? '';
}

describe('AluInstructionsCycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts on ADD R2, R3', () => {
    render(<AluInstructionsCycle />);
    // Default picker state shows ADD as the active op chip.
    const opGroup = screen.getByRole('radiogroup', { name: 'op' });
    const addBtn = Array.from(opGroup.querySelectorAll('button')).find(
      (b) => b.textContent === 'ADD',
    );
    expect(addBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('the byte display shows the encoded instruction byte (decimal)', () => {
    render(<AluInstructionsCycle />);
    // ADD R2, R3 → 0b1000_1011 = 139
    expect(screen.getByLabelText('instruction byte as decimal')).toHaveTextContent('139');
    expect(screen.getByLabelText('instruction byte as binary')).toHaveTextContent(
      '10001011',
    );
  });

  it('changing the op resets the simulator to step 0', () => {
    render(<AluInstructionsCycle />);
    clickStep(3);
    expect(getRegisterValue('IAR')).not.toBe('0'); // fetch advanced IAR by step 3
    pickOp('XOR');
    expect(getRegisterValue('IAR')).toBe('0'); // back to initial state
  });

  it('a full ADD cycle with R2=9, R3=3 produces R3=12', () => {
    render(<AluInstructionsCycle />);
    clickStep(7);
    expect(getRegisterValue('R3')).toBe('12'); // 9 + 3
  });

  it('switching to AND R0, R1 then running gives R1 = 12 & 5 = 4', () => {
    render(<AluInstructionsCycle />);
    pickOp('AND');
    pickReg('reg A', 'R0');
    pickReg('reg B', 'R1');
    clickStep(7);
    expect(getRegisterValue('R1')).toBe('4');
  });

  it('switching to CMP shows blurb mentioning flags', () => {
    render(<AluInstructionsCycle />);
    pickOp('CMP');
    // The expected line should mention "doesn't write back".
    expect(screen.getByText(/doesn't write back/i)).toBeInTheDocument();
  });

  it('persists picker state across mounts', () => {
    const { unmount } = render(<AluInstructionsCycle />);
    pickOp('XOR');
    pickReg('reg A', 'R0');
    pickReg('reg B', 'R1');
    unmount();
    render(<AluInstructionsCycle />);
    const opGroup = screen.getByRole('radiogroup', { name: 'op' });
    const xorBtn = Array.from(opGroup.querySelectorAll('button')).find(
      (b) => b.textContent === 'XOR',
    );
    expect(xorBtn).toHaveAttribute('aria-checked', 'true');
  });
});
