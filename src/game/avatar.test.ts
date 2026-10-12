import { describe, expect, it } from 'vitest';
import { defaultAvatar, lockAvatar, lockedPart, randomAvatar, unlockCost } from './avatar';

describe('unlockable parts', () => {
  it('prices the special parts and leaves the rest free', () => {
    expect(unlockCost('hat', 'propeller')).toBe(5);
    expect(unlockCost('eyes', 'shades')).toBe(25);
    expect(unlockCost('hat', 'tophat')).toBe(50);
    expect(unlockCost('hat', 'santa')).toBe(75);
    expect(unlockCost('hat', 'crown')).toBe(100);
    expect(unlockCost('mouth', 'vampire')).toBe(300);
    expect(unlockCost('shape', 'diamond')).toBe(1000);
    expect(unlockCost('extra', 'monocle')).toBe(5000);
    expect(unlockCost('texture', 'shiny')).toBe(10000);
    expect(unlockCost('hat', 'cap')).toBe(0);
    expect(unlockCost('eyes', 'star')).toBe(0);
  });

  it('swaps out parts the player has not earned', () => {
    const fancy = { ...defaultAvatar('x'), hat: 'crown' as const, shape: 'diamond' as const, eyes: 'shades' as const };
    expect(lockAvatar(fancy, 99)).toMatchObject({ hat: 'none', shape: 'round', eyes: 'shades' });
    expect(lockAvatar(fancy, 1000)).toEqual(fancy);
    expect(lockedPart(fancy, 0)?.cost).toBe(100);
    expect(lockedPart(fancy, 1000)).toBeNull();
  });

  it('shuffles only into unlocked parts', () => {
    for (let i = 0; i < 300; i++) expect(lockedPart(randomAvatar(Math.random, 0), 0)).toBeNull();
  });
});
