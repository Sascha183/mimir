import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MemoryBit from './MemoryBit';

describe('MemoryBit', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with the stored bit at 0', () => {
    render(<MemoryBit />);
    expect(screen.getByText(/Stored bit:/)).toHaveTextContent('Stored bit: 0');
  });

  it('clicking Set drives the bit to 1 and holds it after the pulse ends', () => {
    render(<MemoryBit />);
    act(() => {
      screen.getByRole('button', { name: /^Set the memory bit$/i }).click();
    });
    // During the pulse, the stored bit has already been written.
    expect(screen.getByText(/Stored bit:/)).toHaveTextContent('Stored bit: 1');
    // After the pulse expires, the bit is still 1 (the loop holds it).
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText(/Stored bit:/)).toHaveTextContent('Stored bit: 1');
  });

  it('clicking Reset drives the bit back to 0', () => {
    render(<MemoryBit />);
    act(() => {
      screen.getByRole('button', { name: /^Set the memory bit$/i }).click();
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText(/Stored bit:/)).toHaveTextContent('Stored bit: 1');

    act(() => {
      screen.getByRole('button', { name: /^Reset the memory bit$/i }).click();
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText(/Stored bit:/)).toHaveTextContent('Stored bit: 0');
  });

  it('persists the stored bit across mounts via localStorage', () => {
    const { unmount } = render(<MemoryBit />);
    act(() => {
      screen.getByRole('button', { name: /^Set the memory bit$/i }).click();
      vi.advanceTimersByTime(500);
    });
    unmount();

    render(<MemoryBit />);
    expect(screen.getByText(/Stored bit:/)).toHaveTextContent('Stored bit: 1');
  });

  it('the manual Reset button returns the bit to 0', () => {
    render(<MemoryBit />);
    act(() => {
      screen.getByRole('button', { name: /^Set the memory bit$/i }).click();
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText(/Stored bit:/)).toHaveTextContent('Stored bit: 1');

    act(() => {
      screen.getByRole('button', { name: /^Reset to 0$/i }).click();
    });
    expect(screen.getByText(/Stored bit:/)).toHaveTextContent('Stored bit: 0');
  });
});
