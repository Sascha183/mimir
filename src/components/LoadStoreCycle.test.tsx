import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import LoadStoreCycle from './LoadStoreCycle';

function clickStep(n = 1) {
  for (let i = 0; i < n; i++) {
    act(() => {
      screen.getByRole('button', { name: /^Step$/ }).click();
    });
  }
}

function pickGroup(group: string, name: string) {
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

describe('LoadStoreCycle', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts on LOAD R0, R1', () => {
    render(<LoadStoreCycle />);
    const opGroup = screen.getByRole('radiogroup', { name: 'op' });
    const loadBtn = Array.from(opGroup.querySelectorAll('button')).find(
      (b) => b.textContent === 'LOAD',
    );
    expect(loadBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('LOAD byte for R0, R1 is 1 (= 0b00000001)', () => {
    render(<LoadStoreCycle />);
    expect(screen.getByLabelText('instruction byte as decimal')).toHaveTextContent('1');
  });

  it('STORE R0, R0 byte is 16 (= 0b00010000)', () => {
    render(<LoadStoreCycle />);
    pickGroup('op', 'STORE');
    pickGroup('reg A', 'R0');
    pickGroup('reg B', 'R0');
    expect(screen.getByLabelText('instruction byte as decimal')).toHaveTextContent('16');
  });

  it('LOAD R0, R1 cycle: R1 holds 99 after the cycle', () => {
    render(<LoadStoreCycle />);
    clickStep(7);
    expect(getRegisterValue('R1')).toBe('99');
  });

  it('switching to STORE R0, R2 and running writes 42 into RAM[5]', () => {
    render(<LoadStoreCycle />);
    pickGroup('op', 'STORE');
    pickGroup('reg A', 'R0');
    pickGroup('reg B', 'R2');
    clickStep(7);
    // RAM cell 5 should have value 42 in the diagram.
    const cell = document.querySelector('[data-addr="5"]');
    expect(cell).not.toBeNull();
    expect(cell!.textContent).toContain('42');
  });

  it('changing the picker resets the simulator to step 0', () => {
    render(<LoadStoreCycle />);
    clickStep(4);
    pickGroup('op', 'STORE');
    expect(getRegisterValue('IAR')).toBe('0');
  });

  it('persists picker state across mounts', () => {
    const { unmount } = render(<LoadStoreCycle />);
    pickGroup('op', 'STORE');
    pickGroup('reg A', 'R3');
    pickGroup('reg B', 'R2');
    unmount();
    render(<LoadStoreCycle />);
    const opGroup = screen.getByRole('radiogroup', { name: 'op' });
    const storeBtn = Array.from(opGroup.querySelectorAll('button')).find(
      (b) => b.textContent === 'STORE',
    );
    expect(storeBtn).toHaveAttribute('aria-checked', 'true');
  });
});
