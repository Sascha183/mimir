import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import OperationsCounter, { formatDuration } from './OperationsCounter';

describe('OperationsCounter', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders with count 0 and "1 per second" selected by default', () => {
    render(<OperationsCounter />);

    const display = screen.getByLabelText(/operations performed so far/i);
    expect(display).toHaveTextContent(/^0$/);

    const oneBtn = screen.getByRole('button', { name: /^1 per second$/i });
    expect(oneBtn).toHaveAttribute('aria-pressed', 'true');

    const thousandBtn = screen.getByRole('button', {
      name: /^1,000 per second$/i,
    });
    expect(thousandBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking "1,000 per second" makes that button the active speed', () => {
    render(<OperationsCounter />);

    const oneBtn = screen.getByRole('button', { name: /^1 per second$/i });
    const thousandBtn = screen.getByRole('button', {
      name: /^1,000 per second$/i,
    });

    fireEvent.click(thousandBtn);

    expect(thousandBtn).toHaveAttribute('aria-pressed', 'true');
    expect(oneBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('Reset returns the count to 0 (verified via a localStorage-seeded non-zero start)', () => {
    // Seed a non-zero count so we can confirm Reset zeroes it out.
    window.localStorage.setItem(
      'hciw:operations-counter',
      JSON.stringify({ count: 42, speed: 1000 }),
    );
    render(<OperationsCounter />);

    const display = screen.getByLabelText(/operations performed so far/i);
    expect(display).toHaveTextContent(/^42$/);

    const thousandBtn = screen.getByRole('button', {
      name: /^1,000 per second$/i,
    });
    expect(thousandBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /^reset$/i }));

    expect(display).toHaveTextContent(/^0$/);
    const oneBtn = screen.getByRole('button', { name: /^1 per second$/i });
    expect(oneBtn).toHaveAttribute('aria-pressed', 'true');
    expect(thousandBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('formatDuration', () => {
  it('handles values below 1 second as "0 seconds"', () => {
    expect(formatDuration(0)).toBe('0 seconds');
    expect(formatDuration(0.4)).toBe('0 seconds');
  });

  it('singular vs plural for seconds', () => {
    expect(formatDuration(1)).toBe('1 second');
    expect(formatDuration(2)).toBe('2 seconds');
    expect(formatDuration(59)).toBe('59 seconds');
  });

  it('crosses into minutes at 60 seconds', () => {
    expect(formatDuration(60)).toBe('1 minute');
    expect(formatDuration(120)).toBe('2 minutes');
  });

  it('crosses into hours at 1 hour', () => {
    expect(formatDuration(3600)).toBe('1 hour');
    expect(formatDuration(7200)).toBe('2 hours');
  });

  it('crosses into days at 1 day', () => {
    expect(formatDuration(86400)).toBe('1 day');
    expect(formatDuration(86400 * 5)).toBe('5 days');
  });

  it('shows months between 30 days and 365 days', () => {
    // ~60 days is ~2 months
    expect(formatDuration(86400 * 60)).toMatch(/^2 months$/);
  });

  it('crosses into years at 1 year', () => {
    // 365.25 days × 86400 sec/day
    const oneYearSec = 365.25 * 86400;
    expect(formatDuration(oneYearSec)).toBe('1 year');
  });

  it('reports tens of years exactly', () => {
    const tenYearsSec = 10 * 365.25 * 86400;
    expect(formatDuration(tenYearsSec)).toBe('10 years');
  });

  it('rounds to the nearest hundred years at and above 100 years', () => {
    const oneHundredYearsSec = 100 * 365.25 * 86400;
    expect(formatDuration(oneHundredYearsSec)).toBe('100 years');

    const oneThousandYearsSec = 1000 * 365.25 * 86400;
    expect(formatDuration(oneThousandYearsSec)).toBe('1,000 years');

    const thirtyTwoThousandYearsSec = 32000 * 365.25 * 86400;
    expect(formatDuration(thirtyTwoThousandYearsSec)).toBe('32,000 years');
  });
});
