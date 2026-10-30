import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { RevealCard } from '../RevealCard';
import { colors } from '../theme';

/**
 * GDD 13 §6.3's rarity-tier border, off §11's rank ladder.
 *
 * A colour swap is invisible to every other test in the suite — nothing else reads a border — so
 * this file is the only thing standing between the ladder and a silent re-assignment.
 */
const borderOf = async (grade: string): Promise<unknown> => {
  await render(<RevealCard subject="item_travelers_salve" name="Something" grade={grade} />);

  return StyleSheet.flatten(screen.getByTestId('reveal-card').props.style).borderColor;
};

describe('the rank ladder', () => {
  /** ↯ One ladder for both: the colour names a **rank**, not a table (DECISIONS 2026-08-22). */
  it.each`
    grade         | token            | expected
    ${'common'}   | ${'pewter'}      | ${colors.pewter}
    ${'mortal'}   | ${'pewter'}      | ${colors.pewter}
    ${'uncommon'} | ${'moss'}        | ${colors.moss}
    ${'heroic'}   | ${'moss'}        | ${colors.moss}
    ${'rare'}     | ${'lapis'}       | ${colors.lapis}
    ${'mythic'}   | ${'lapis'}       | ${colors.lapis}
    ${'divine'}   | ${'orchid'}      | ${colors.orchid}
  `('borders a $grade drop in $token', async ({ grade, expected }) => {
    expect(await borderOf(grade as string)).toBe(expected);
  });

  /**
   * ↯ `moss` is **not** `verdigris`. The Reveal Card renders on the battle outcome panel with the
   * combat log still visible, so an uncommon border and §6.2's super-effective callout do share a
   * screen — the 45° between the two hues is what makes that safe, and this pins them apart.
   */
  it('never borders a drop in the super-effective signal', async () => {
    for (const grade of ['common', 'uncommon', 'rare', 'mortal', 'heroic', 'mythic', 'divine']) {
      expect(await borderOf(grade)).not.toBe(colors.verdigris);
    }
  });

  /** A grade the ladder has no step for takes the ordinary card edge, never a borrowed rank. */
  it('falls back to the plain border for an unknown grade', async () => {
    expect(await borderOf('legendary')).toBe(colors.border);
  });

  /**
   * The rank is named in text as well as coloured. The four steps differ by hue rather than
   * brightness, so this is the channel that carries it when the colour cannot (WCAG 1.4.1).
   */
  it('names the grade beside the colour', async () => {
    await render(<RevealCard subject="item_travelers_salve" name="Stormveil" grade="uncommon" flavor="Bottled weather." />);

    expect(screen.getByText('uncommon')).toBeTruthy();
    expect(screen.getByText('Bottled weather.')).toBeTruthy();
  });
});
