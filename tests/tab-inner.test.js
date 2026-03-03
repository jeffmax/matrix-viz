// ══════════════════════════════════════════════════
// Tests for Inner Product tab (tab-inner.js)
// ══════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import { ipInit, ipRender, ipFwd, ipBack, ipReset, ipPause,
         ipResize, getIpState } from '../js/tab-inner.js';

describe('Inner Product tab', () => {
  beforeEach(() => {
    ipInit(true);
    ipReset();
  });

  it('initializes with 3 elements and step = -1', () => {
    const s = getIpState();
    expect(s.ipStep).toBe(-1);
    expect(s.ipN).toBe(3);
    expect(s.ipA.length).toBe(3);
    expect(s.ipB.length).toBe(3);
  });

  it('step forward increments ipStep', () => {
    ipFwd();
    expect(getIpState().ipStep).toBe(0);
    ipFwd();
    expect(getIpState().ipStep).toBe(1);
  });

  it('step back decrements ipStep', () => {
    ipFwd(); ipFwd(); // step=1
    ipBack();
    expect(getIpState().ipStep).toBe(0);
    ipBack();
    expect(getIpState().ipStep).toBe(-1);
  });

  it('step back from -1 stays at -1', () => {
    ipBack();
    expect(getIpState().ipStep).toBe(-1);
  });

  it('cannot step past last term', () => {
    ipFwd(); ipFwd(); ipFwd(); // step=2 (max for n=3)
    ipFwd(); // should not go past
    expect(getIpState().ipStep).toBe(2);
  });

  it('reset sets step back to -1', () => {
    ipFwd(); ipFwd();
    ipReset();
    expect(getIpState().ipStep).toBe(-1);
  });

  it('resize changes vector length', () => {
    ipResize(2); // 3→5
    const s = getIpState();
    expect(s.ipN).toBe(5);
    expect(s.ipA.length).toBe(5);
    expect(s.ipB.length).toBe(5);
  });

  it('resize preserves existing values', () => {
    const before = getIpState();
    ipResize(1); // 3→4
    const after = getIpState();
    expect(after.ipA[0]).toBe(before.ipA[0]);
    expect(after.ipA[1]).toBe(before.ipA[1]);
    expect(after.ipA[2]).toBe(before.ipA[2]);
  });

  it('resize resets step to -1', () => {
    ipFwd(); ipFwd();
    ipResize(1);
    expect(getIpState().ipStep).toBe(-1);
  });

  it('resize respects min=1 and max=8', () => {
    ipResize(-10); // clamp to 1
    expect(getIpState().ipN).toBe(1);
    ipResize(20); // clamp to 8
    expect(getIpState().ipN).toBe(8);
  });

  it('renders without errors', () => {
    ipRender();
    const display = document.getElementById('innerDisplay');
    expect(display.innerHTML).not.toBe('');
  });

  it('renders products in display', () => {
    ipInit(false); // all 1s
    ipRender();
    const display = document.getElementById('innerDisplay');
    // With all 1s, each product is 1 and sum is 3
    expect(display.innerHTML).toContain('3');
  });
});
