import { describe, expect, it } from 'vitest';
import {
  customPeriod,
  elapsedDays,
  monthPeriod,
  periodDayKeys,
  previousPeriod,
  todayPeriod,
  weekPeriod,
} from '../src';
import { NY, SP } from './fixtures';

describe('semana começa na segunda', () => {
  it('domingo pertence à semana iniciada na segunda anterior', () => {
    const w = weekPeriod('2026-10-25T15:00:00Z', SP); // domingo
    expect(w.start).toBe('2026-10-19T03:00:00.000Z');
    expect(w.end).toBe('2026-10-26T03:00:00.000Z');
    expect(w.first_day).toBe('2026-10-19');
    expect(w.last_day).toBe('2026-10-25');
    expect(w.days).toBe(7);
  });

  it('usa o fuso: domingo 23:30 em SP já é segunda em UTC, mas ainda é a semana anterior', () => {
    expect(weekPeriod('2026-10-26T02:30:00Z', SP).first_day).toBe('2026-10-19');
    expect(weekPeriod('2026-10-26T03:00:00Z', SP).first_day).toBe('2026-10-26');
  });

  it('segunda 00:00 local abre a semana', () => {
    expect(weekPeriod('2026-10-19T03:00:00Z', SP).first_day).toBe('2026-10-19');
  });
});

describe('hoje e mês, com horário de verão', () => {
  it('dia de início do horário de verão em NY tem 23 h', () => {
    const d = todayPeriod('2026-03-08T15:00:00Z', NY);
    expect(d.start).toBe('2026-03-08T05:00:00.000Z');
    expect(d.end).toBe('2026-03-09T04:00:00.000Z');
    expect(d.days).toBe(1);
  });

  it('dia de fim do horário de verão em NY tem 25 h', () => {
    const d = todayPeriod('2026-11-01T15:00:00Z', NY);
    expect(d.start).toBe('2026-11-01T04:00:00.000Z');
    expect(d.end).toBe('2026-11-02T05:00:00.000Z');
  });

  it('mês em SP (UTC-3 fixo)', () => {
    const m = monthPeriod('2026-10-24T12:00:00Z', SP);
    expect(m.start).toBe('2026-10-01T03:00:00.000Z');
    expect(m.end).toBe('2026-11-01T03:00:00.000Z');
    expect(m.days).toBe(31);
  });

  it('mês em NY atravessando o fim do horário de verão', () => {
    const m = monthPeriod('2026-11-15T12:00:00Z', NY);
    expect(m.start).toBe('2026-11-01T04:00:00.000Z');
    expect(m.end).toBe('2026-12-01T05:00:00.000Z');
    expect(m.days).toBe(30);
  });

  it('fevereiro e 31/12 viram o mês certo', () => {
    expect(monthPeriod('2026-02-10T12:00:00Z', SP).days).toBe(28);
    const dez = monthPeriod('2026-12-31T23:00:00Z', SP); // 20:00 local
    expect(dez.first_day).toBe('2026-12-01');
    expect(dez.last_day).toBe('2026-12-31');
  });
});

describe('período personalizado e anterior', () => {
  it('personalizado é inclusivo nos dois dias', () => {
    const p = customPeriod('2026-10-20', '2026-10-22', SP);
    expect(p.start).toBe('2026-10-20T03:00:00.000Z');
    expect(p.end).toBe('2026-10-23T03:00:00.000Z');
    expect(periodDayKeys(p)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
  });

  it('personalizado invertido é erro', () => {
    expect(() => customPeriod('2026-10-22', '2026-10-20', SP)).toThrow(RangeError);
  });

  it('anterior da semana é a semana anterior', () => {
    const prev = previousPeriod(weekPeriod('2026-10-24T12:00:00Z', SP));
    expect(prev.first_day).toBe('2026-10-12');
    expect(prev.last_day).toBe('2026-10-18');
    expect(prev.end).toBe('2026-10-19T03:00:00.000Z');
  });

  it('anterior tem o mesmo número de dias, inclusive cruzando DST', () => {
    const week = weekPeriod('2026-03-10T12:00:00Z', NY); // semana de 09/03
    const prev = previousPeriod(week); // 02/03 a 08/03, contém o dia de 23 h
    expect(prev.start).toBe('2026-03-02T05:00:00.000Z');
    expect(prev.end).toBe('2026-03-09T04:00:00.000Z');
    expect(prev.days).toBe(7);
  });

  it('anterior de um mês de 31 dias são os 31 dias antes', () => {
    const prev = previousPeriod(monthPeriod('2026-10-10T12:00:00Z', SP));
    expect(prev.first_day).toBe('2026-08-31');
    expect(prev.last_day).toBe('2026-09-30');
    expect(prev.days).toBe(31);
  });

  it('dias decorridos', () => {
    const w = weekPeriod('2026-10-21T12:00:00Z', SP); // quarta
    expect(elapsedDays(w, '2026-10-21T12:00:00Z')).toBe(3);
    expect(elapsedDays(w, '2026-10-19T03:00:00Z')).toBe(1);
    expect(elapsedDays(w, '2026-12-01T00:00:00Z')).toBe(7);
    expect(elapsedDays(w, '2026-01-01T00:00:00Z')).toBe(1);
  });
});
