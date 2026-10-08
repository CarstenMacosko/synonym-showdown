// The starter words players get, hand-picked for having lots of synonyms, 100 per tier.
// Tier = how hard the starter word itself is to think around (easy: everyday words, hard: SAT-style words).

import type { Tier } from '../../src/game/words.ts';

const words = (s: string) => s.trim().split(/\s+/);

export const STARTER_TIERS: Record<Tier, string[]> = {
  easy: words(`
    happy sad big small fast cold smart good funny scared old rich quiet walk
    hot bad nice pretty new young strong weak hard easy loud dirty clean wet dark bright full empty tall short
    thin fat slow cheap poor kind mean cute busy sick hungry safe weird cool great wrong true fake nervous
    crazy silly sleepy sweet gross boring wild shy lucky simple tiny dumb rude soft heavy messy warm
    run jump eat look say talk think help make laugh cry yell fight hit break fix hide win hurry throw grab
    like hate start stop
    friend house idea mess money`),
  medium: words(`
    angry brave strange tired ask beautiful difficult calm lazy ugly honest destroy eager clumsy
    anxious awful careful curious delicious dangerous famous fierce gentle generous greedy grumpy important
    jealous lonely loyal polite proud rare stubborn wise wonderful terrible strict sneaky clever confident
    fancy ancient gloomy cheerful excited bored foolish harsh brief bold cruel tough humble vague fragile
    enormous peaceful hostile
    argue admire annoy avoid believe complain create decide explain grow improve praise protect remember
    shout trick wander worry choose gather hurt rush damage scare celebrate
    anger fear joy trouble danger journey mistake secret chance crowd power plan battle gift goal skill`),
  hard: words(`
    obstinate ephemeral gregarious benevolent meticulous loquacious melancholy ubiquitous candid frugal
    mundane lethargic cryptic arrogant zealous
    ambiguous arduous audacious belligerent cantankerous capricious conspicuous diligent eloquent elusive
    enigmatic exuberant fastidious ferocious flamboyant frivolous gullible haughty immaculate impetuous
    intrepid jovial lavish lucid malicious nonchalant obscure ominous opulent ostentatious pensive pompous
    precarious prudent resilient robust serene shrewd tenacious tranquil trivial turbulent vivid voracious
    wary whimsical wistful callous docile eccentric inept vigilant bleak abundant adamant astute blatant
    abandon alleviate scrutinize exacerbate mitigate deceive procrastinate condemn bolster diminish emulate
    ponder squander thwart vanquish rebuke coerce placate
    chaos dilemma euphoria fervor solace tirade facade hubris debacle menace`),
};
