import { MINUTE_MS, deviceLocalDates, fixedOffsetDates, minuteOf } from '../localDate';
import { READ_WINDOW_HOURS, readWindowFor } from '../provider';
import { edt, edtDates } from './fixtures';

const HOUR_MS = 60 * MINUTE_MS;

describe('local dates', () => {
  it('resolves a fixed offset to the local calendar day', () => {
    // 03:50Z on the 20th is 23:50 on the 19th in EDT — the fixtures §11.5 boundary.
    expect(edtDates.dateOf(Date.parse('2026-07-20T03:50:00Z'))).toBe('2026-07-19');
    expect(edtDates.dateOf(Date.parse('2026-07-20T04:00:00Z'))).toBe('2026-07-20');
  });

  it('finds local midnight', () => {
    expect(edtDates.startOfDay(edt('2026-07-19T18:30'))).toBe(edt('2026-07-19T00:00'));
    expect(edtDates.startOfDay(edt('2026-07-19T00:00'))).toBe(edt('2026-07-19T00:00'));
  });

  it('zero-pads months and days', () => {
    expect(fixedOffsetDates(0).dateOf(Date.parse('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });

  /**
   * The device resolver reads the system zone, which a test cannot pin — so what is asserted is the
   * formatting, which is where the bugs are (a zero-based month, an unpadded day). The offset itself
   * is the platform's.
   */
  it('formats the device zone the same way', () => {
    const now = Date.now();
    const local = new Date(now);
    const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(
      local.getDate(),
    ).padStart(2, '0')}`;

    expect(deviceLocalDates.dateOf(now)).toBe(expected);
    expect(new Date(deviceLocalDates.startOfDay(now)).getHours()).toBe(0);
  });

  it('opens the minute containing an instant', () => {
    expect(minuteOf(edt('2026-07-19T10:00') + 59_999)).toBe(edt('2026-07-19T10:00'));
  });
});

describe('the read window (tech-03 §4.1)', () => {
  const NOW = edt('2026-07-19T18:30');

  it('falls back to 72 hours before the first read', () => {
    const window = readWindowFor(null, NOW, edtDates);

    expect(window.endMs).toBe(NOW);
    expect(window.startMs).toBe(edtDates.startOfDay(NOW - READ_WINDOW_HOURS * HOUR_MS));
  });

  it('starts from the watermark once there is one', () => {
    const watermark = new Date(edt('2026-07-19T06:00')).toISOString();

    expect(readWindowFor(watermark, NOW, edtDates).startMs).toBe(edt('2026-07-19T00:00'));
  });

  /**
   * ↯ The snap to local midnight, which is not in tech-03 §4.1 and without which the high-water
   * scheme loses activity. §8.1 mints `observed_total(date) − mark(date)`, which needs the observed
   * value to be the day's *whole* total. A window opening at 18:00 would make the first daily bucket
   * cover 18:00→midnight only; that partial total sits below the mark already recorded for the day,
   * the delta is zero, and the evening's steps are dropped — permanently, since §8.1 also forbids
   * lowering the mark.
   */
  it('never opens part-way through a day, however recent the watermark', () => {
    const watermark = new Date(edt('2026-07-19T18:00')).toISOString();

    expect(readWindowFor(watermark, NOW, edtDates).startMs).toBe(edt('2026-07-19T00:00'));
  });

  it('ignores a watermark older than the 72-hour floor', () => {
    const stale = new Date(edt('2026-01-01T09:00')).toISOString();

    expect(readWindowFor(stale, NOW, edtDates).startMs).toBe(
      edtDates.startOfDay(NOW - READ_WINDOW_HOURS * HOUR_MS),
    );
  });

  it('treats an unparseable watermark as no watermark rather than as instant zero', () => {
    expect(readWindowFor('not an instant', NOW, edtDates).startMs).toBe(
      edtDates.startOfDay(NOW - READ_WINDOW_HOURS * HOUR_MS),
    );
  });
});
