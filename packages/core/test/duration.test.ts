import { describe, expect, it } from 'vitest';
import { activeIntervals, netDurationMs, toMs } from '../src';
import { HOUR, MIN, pause, session } from './fixtures';

describe('tempo líquido', () => {
  it('sem pausas é a duração', () => {
    const s = session('html', '2026-10-20T10:00:00Z', '2026-10-20T11:00:00Z');
    expect(netDurationMs(s, [], 0)).toBe(HOUR);
  });

  it('desconta pausas fechadas', () => {
    const s = session('html', '2026-10-20T10:00:00Z', '2026-10-20T11:00:00Z');
    const p = [pause(s, '2026-10-20T10:15:00Z', '2026-10-20T10:30:00Z')];
    expect(netDurationMs(s, p, 0)).toBe(45 * MIN);
  });

  it('sessão ativa conta até now', () => {
    const s = session('html', '2026-10-20T10:00:00Z', null);
    expect(netDurationMs(s, [], '2026-10-20T10:40:00Z')).toBe(40 * MIN);
  });

  it('pausa aberta conta até now (não soma tempo)', () => {
    const s = session('html', '2026-10-20T10:00:00Z', null);
    const p = [pause(s, '2026-10-20T10:30:00Z', null)];
    expect(netDurationMs(s, p, '2026-10-20T11:00:00Z')).toBe(30 * MIN);
    expect(netDurationMs(s, p, '2026-10-20T15:00:00Z')).toBe(30 * MIN);
  });

  it('pausa aberta numa sessão encerrada vai até ended_at', () => {
    const s = session('html', '2026-10-20T10:00:00Z', '2026-10-20T11:00:00Z');
    const p = [pause(s, '2026-10-20T10:50:00Z', null)];
    expect(netDurationMs(s, p, '2026-10-21T00:00:00Z')).toBe(50 * MIN);
  });

  it('une pausas sobrepostas, recorta as de fora e ignora as de outra sessão', () => {
    const s = session('html', '2026-10-20T10:00:00Z', '2026-10-20T12:00:00Z');
    const other = session('js', '2026-10-20T10:00:00Z', '2026-10-20T12:00:00Z');
    const p = [
      pause(s, '2026-10-20T10:30:00Z', '2026-10-20T11:00:00Z'),
      pause(s, '2026-10-20T10:45:00Z', '2026-10-20T11:15:00Z'),
      pause(s, '2026-10-20T09:00:00Z', '2026-10-20T10:10:00Z'),
      pause(other, '2026-10-20T11:30:00Z', '2026-10-20T11:50:00Z'),
    ];
    expect(netDurationMs(s, p, 0)).toBe(2 * HOUR - 45 * MIN - 10 * MIN);
    expect(activeIntervals(s, p, 0)).toEqual([
      { start: toMs('2026-10-20T10:10:00Z'), end: toMs('2026-10-20T10:30:00Z') },
      { start: toMs('2026-10-20T11:15:00Z'), end: toMs('2026-10-20T12:00:00Z') },
    ]);
  });

  it('pausa cobrindo a sessão inteira zera', () => {
    const s = session('html', '2026-10-20T10:00:00Z', '2026-10-20T11:00:00Z');
    const p = [pause(s, '2026-10-20T10:00:00Z', '2026-10-20T11:00:00Z')];
    expect(netDurationMs(s, p, 0)).toBe(0);
  });

  it('rejeita data inválida', () => {
    expect(() => toMs('ontem')).toThrow(RangeError);
  });
});
