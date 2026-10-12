import { describe, expect, it } from 'vitest';
import { defaultAvatar, lockAvatar, randomAvatar, unlockCost } from './avatar';

describe('hat unlocks', () => {
  it('prices the special hats and leaves the rest free', () => {
    expect(unlockCost('hat', 'tophat')).toBe(50);
    expect(unlockCost('hat', 'crown')).toBe(100);
    expect(unlockCost('hat', 'cap')).toBe(0);
    expect(unlockCost('eyes', 'star')).toBe(0);
  });

  it('takes off hats the player has not earned', () => {
    const crown = { ...defaultAvatar('x'), hat: 'crown' as const };
    expect(lockAvatar(crown, 99).hat).toBe('none');
    expect(lockAvatar(crown, 100).hat).toBe('crown');
  });

  it('shuffles only into unlocked hats', () => {
    for (let i = 0; i < 300; i++) expect(unlockCost('hat', randomAvatar(Math.random, 0).hat)).toBe(0);
  });
});
