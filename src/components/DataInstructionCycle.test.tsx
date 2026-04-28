import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DataInstructionCycle from './DataInstructionCycle';

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

describe('DataInstructionCycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the program listing with 5 lines', () => {
    render(<DataInstructionCycle />);
    expect(document.querySelectorAll('[data-line-address]')).toHaveLength(5);
  });

  it('starts with R0=0 and R1=0; first program line is DATA R0, 5', () => {
    render(<DataInstructionCycle />);
    expect(getRegisterValue('R0')).toBe('0');
    expect(getRegisterValue('R1')).toBe('0');
    const firstLine = document.querySelector('[data-line-address="0"]');
    expect(firstLine?.textContent).toContain('DATA R0, 5');
  });

  it('after one Step-instruction click, R0 holds 5 and IAR has advanced by 2', () => {
    render(<DataInstructionCycle />);
    clickStepInstruction(1);
    expect(getRegisterValue('R0')).toBe('5');
    expect(getRegisterValue('IAR')).toBe('2');
  });

  it('after two Step-instruction clicks, R1 holds 3', () => {
    render(<DataInstructionCycle />);
    clickStepInstruction(2);
    expect(getRegisterValue('R1')).toBe('3');
  });

  it('after three Step-instruction clicks (DATA, DATA, ADD), R1 holds 8', () => {
    render(<DataInstructionCycle />);
    clickStepInstruction(3);
    expect(getRegisterValue('R1')).toBe('8');
  });

  it('after the full program (5 Step-instruction clicks), RAM[14] holds 8', () => {
    render(<DataInstructionCycle />);
    clickStepInstruction(5);
    const cell = document.querySelector('[data-addr="14"]');
    expect(cell?.textContent).toContain('8');
  });

  it('the current line in the program listing follows IAR through cycles', () => {
    render(<DataInstructionCycle />);
    // Initially current line is the one at address 0.
    expect(
      document.querySelector('[data-line-address="0"][data-current="true"]'),
    ).not.toBeNull();

    clickStepInstruction(1);
    // After one cycle (DATA R0, 5), IAR = 2, so the line at address 2 is current.
    expect(
      document.querySelector('[data-line-address="2"][data-current="true"]'),
    ).not.toBeNull();
  });

  it('Reset returns the program and registers to their initial state', () => {
    render(<DataInstructionCycle />);
    clickStepInstruction(3);
    expect(getRegisterValue('R1')).toBe('8');
    act(() => {
      screen.getByRole('button', { name: /^Reset$/ }).click();
    });
    expect(getRegisterValue('R1')).toBe('0');
    expect(getRegisterValue('IAR')).toBe('0');
  });

  it('Run advances the simulator on a setInterval', () => {
    render(<DataInstructionCycle />);
    act(() => {
      screen.getByRole('button', { name: /^Run$/ }).click();
    });
    // Default 800 ms; advance 7 ticks (~one instruction cycle worth).
    act(() => {
      vi.advanceTimersByTime(800 * 7);
    });
    // After ~1 cycle of DATA R0, 5: R0 holds 5.
    expect(getRegisterValue('R0')).toBe('5');
  });
});
