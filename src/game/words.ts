// Starter words and their accepted synonyms, grouped by difficulty tier.
//
// This is a hand-curated prototype list. It will later be generated from WordNet + Moby
// (both free for commercial use) and reviewed, so every ranked ruling is the same for everyone.
//
// `decoys` are related-but-wrong words that bots use when they bluff.

export type Tier = 'easy' | 'medium' | 'hard';

export interface StarterWord {
  word: string;
  tier: Tier;
  synonyms: string[];
  decoys: string[];
}

const list = (s: string) => s.trim().split(/\s*,\s*/);

export const STARTERS: StarterWord[] = [
  // ---------- EASY ----------
  {
    word: 'happy',
    tier: 'easy',
    synonyms: list(`glad, joyful, cheerful, content, contented, pleased, delighted, merry, jolly, elated,
      ecstatic, thrilled, overjoyed, upbeat, chipper, gleeful, jovial, blissful, sunny, buoyant, euphoric,
      jubilant, lighthearted, carefree, blithe, satisfied, gratified, exuberant, beaming, smiling, peppy,
      chirpy, cheery, mirthful, convivial, sanguine, rapturous, tickled, radiant, joyous`),
    decoys: list('lucky, funny, friendly, healthy, playful, proud, silly, rich'),
  },
  {
    word: 'sad',
    tier: 'easy',
    synonyms: list(`unhappy, sorrowful, gloomy, glum, miserable, depressed, dejected, downcast, melancholy,
      blue, mournful, despondent, heartbroken, forlorn, woeful, crestfallen, disheartened, downhearted, low,
      morose, somber, doleful, wretched, heavyhearted, dispirited, desolate, grief-stricken, down,
      disconsolate, tearful, cheerless, joyless, lugubrious, sorry, upset`),
    decoys: list('angry, tired, bored, sick, scared, quiet, grumpy, lonely'),
  },
  {
    word: 'big',
    tier: 'easy',
    synonyms: list(`large, huge, giant, enormous, massive, gigantic, immense, vast, colossal, great, sizable,
      hefty, bulky, mammoth, tremendous, jumbo, monumental, substantial, considerable, gargantuan, titanic,
      hulking, whopping, ample, mighty, oversized, king-size, humongous, monstrous, prodigious, extensive,
      voluminous, grand`),
    decoys: list('tall, long, loud, strong, deep, thick, round, wide'),
  },
  {
    word: 'fast',
    tier: 'easy',
    synonyms: list(`quick, rapid, swift, speedy, brisk, hasty, fleet, nimble, express, hurried, accelerated,
      breakneck, expeditious, zippy, snappy, nippy, flying, agile, prompt, supersonic, lightning, meteoric,
      whirlwind, headlong, high-speed, quickly, rapidly, swiftly, speedily`),
    decoys: list('early, sudden, strong, busy, short, sharp, smart, loud'),
  },
  {
    word: 'small',
    tier: 'easy',
    synonyms: list(`little, tiny, mini, miniature, minute, petite, compact, wee, minuscule, teeny, diminutive,
      pint-sized, pocket-sized, slight, modest, microscopic, bitty, puny, undersized, baby, toy, dwarf,
      infinitesimal, short, limited, meager, scant, negligible, trifling, insignificant, itsy-bitsy, teensy`),
    decoys: list('thin, young, light, narrow, weak, low, cute, few'),
  },
  {
    word: 'cold',
    tier: 'easy',
    synonyms: list(`chilly, cool, freezing, frosty, icy, frigid, nippy, wintry, arctic, bitter, raw, glacial,
      frozen, polar, brisk, bleak, numbing, chill, crisp, biting, piercing, shivery, aloof, distant,
      unfriendly, standoffish, cold-hearted, unfeeling, indifferent, unemotional, heartless, gelid`),
    decoys: list('wet, windy, dark, damp, cloudy, rainy, stormy, snowy'),
  },
  {
    word: 'smart',
    tier: 'easy',
    synonyms: list(`intelligent, clever, bright, brilliant, wise, sharp, quick, brainy, gifted, astute, shrewd,
      knowledgeable, savvy, quick-witted, sharp-witted, apt, canny, ingenious, keen, educated, learned,
      scholarly, perceptive, insightful, intellectual, adept, whip-smart, stylish, chic, elegant, dapper,
      neat, fashionable, trim, genius`),
    decoys: list('nerdy, curious, funny, strong, kind, famous, calm, rich'),
  },
  {
    word: 'good',
    tier: 'easy',
    synonyms: list(`fine, great, excellent, nice, superb, wonderful, splendid, decent, satisfactory, acceptable,
      solid, positive, favorable, terrific, outstanding, first-rate, marvelous, admirable, commendable,
      worthy, virtuous, moral, righteous, ethical, kind, upright, honest, capable, skilled, competent,
      proficient, valid, sound, beneficial, pleasant, agreeable, swell, super, stellar, choice, exemplary,
      adequate, tolerable, fantastic`),
    decoys: list('lucky, happy, rich, easy, tall, cheap, quick, famous'),
  },

  // ---------- MEDIUM ----------
  {
    word: 'angry',
    tier: 'medium',
    synonyms: list(`mad, furious, irate, livid, enraged, irritated, annoyed, cross, fuming, incensed, infuriated,
      outraged, heated, irritable, resentful, indignant, seething, raging, wrathful, sore, vexed,
      exasperated, aggravated, agitated, ballistic, choleric, irascible, riled, steamed, hot-tempered,
      bitter, hostile, displeased, provoked, offended, huffy, irked, ireful, apoplectic`),
    decoys: list('sad, jealous, loud, scared, rude, wild, proud, nervous'),
  },
  {
    word: 'brave',
    tier: 'medium',
    synonyms: list(`courageous, bold, fearless, daring, heroic, valiant, gallant, intrepid, plucky, gutsy,
      audacious, dauntless, undaunted, valorous, unafraid, spirited, gritty, stalwart, doughty, lionhearted,
      game, hardy, resolute, adventurous, confident, nervy, spunky, unflinching, stouthearted, venturesome,
      mettlesome, heroical`),
    decoys: list('strong, proud, loyal, honest, noble, calm, famous, kind'),
  },
  {
    word: 'strange',
    tier: 'medium',
    synonyms: list(`odd, weird, bizarre, peculiar, unusual, curious, funny, eccentric, abnormal, uncanny, eerie,
      outlandish, offbeat, quirky, freakish, atypical, unconventional, irregular, extraordinary, mysterious,
      puzzling, baffling, perplexing, unfamiliar, foreign, alien, unknown, new, novel, exotic, kooky, wacky,
      oddball, anomalous, singular, unaccountable, inexplicable`),
    decoys: list('scary, ugly, silly, dark, rude, lonely, sudden, shy'),
  },
  {
    word: 'tired',
    tier: 'medium',
    synonyms: list(`exhausted, weary, sleepy, fatigued, drained, drowsy, spent, beat, bushed, pooped, wiped,
      wearied, jaded, burnt-out, haggard, lethargic, sluggish, listless, flagging, enervated, depleted,
      knackered, run-down, tuckered, dog-tired, worn, stale, hackneyed, trite, overused, clichéd, cliched`),
    decoys: list('sick, lazy, sad, slow, old, hungry, weak, calm'),
  },
  {
    word: 'ask',
    tier: 'medium',
    synonyms: list(`inquire, enquire, question, query, quiz, interrogate, request, beg, plead, petition, demand,
      invite, implore, entreat, solicit, appeal, seek, pose, probe, examine, grill, pump, beseech, apply,
      summon, bid, require, canvass, poll`),
    decoys: list('tell, answer, wonder, say, speak, think, call, talk'),
  },
  {
    word: 'beautiful',
    tier: 'medium',
    synonyms: list(`pretty, lovely, gorgeous, stunning, attractive, handsome, exquisite, elegant, graceful,
      radiant, dazzling, fair, comely, ravishing, alluring, appealing, charming, cute, fine, delightful,
      magnificent, splendid, beauteous, pulchritudinous, bonny, foxy, divine, glamorous, good-looking,
      breathtaking, striking, sublime, picturesque, scenic, fetching`),
    decoys: list('famous, rich, colorful, shiny, clean, tall, young, sweet'),
  },
  {
    word: 'difficult',
    tier: 'medium',
    synonyms: list(`hard, tough, challenging, demanding, arduous, laborious, strenuous, tricky, complicated,
      complex, grueling, taxing, onerous, burdensome, formidable, herculean, uphill, exhausting, punishing,
      rigorous, troublesome, problematic, thorny, knotty, perplexing, intricate, involved, baffling,
      puzzling, stubborn, obstinate, uncooperative, unruly, trying, hairy, rough, backbreaking, exacting,
      toilsome`),
    decoys: list('boring, long, heavy, scary, slow, strange, busy, sharp'),
  },
  {
    word: 'calm',
    tier: 'medium',
    synonyms: list(`peaceful, serene, tranquil, quiet, still, placid, relaxed, composed, collected, cool, mellow,
      untroubled, unruffled, unperturbed, sedate, restful, gentle, mild, balmy, halcyon, level-headed,
      poised, laid-back, easygoing, steady, even-tempered, imperturbable, nonchalant, soothing, smooth,
      windless, motionless, undisturbed, self-possessed, unflappable`),
    decoys: list('sleepy, happy, slow, soft, kind, lazy, shy, bored'),
  },

  // ---------- HARD ----------
  {
    word: 'obstinate',
    tier: 'hard',
    synonyms: list(`stubborn, headstrong, willful, wilful, pigheaded, mulish, inflexible, intransigent, obdurate,
      recalcitrant, unyielding, uncompromising, adamant, immovable, persistent, dogged, tenacious, perverse,
      contrary, refractory, intractable, bullheaded, strong-willed, determined, steadfast, firm, rigid,
      self-willed, wayward, unbending, implacable, relentless, opinionated, ornery, balky, pertinacious,
      contumacious, froward`),
    decoys: list('arrogant, rude, lazy, proud, greedy, annoying, bossy, grumpy'),
  },
  {
    word: 'ephemeral',
    tier: 'hard',
    synonyms: list(`fleeting, transient, transitory, momentary, brief, short-lived, temporary, passing,
      evanescent, impermanent, fugitive, fugacious, short, flitting, volatile, mortal, perishable,
      vanishing, flying, cursory, quick`),
    decoys: list('delicate, magical, ghostly, rare, fragile, dreamy, ancient, sudden'),
  },
  {
    word: 'gregarious',
    tier: 'hard',
    synonyms: list(`sociable, outgoing, friendly, convivial, extroverted, extraverted, extrovert, affable,
      amiable, cordial, genial, companionable, social, hospitable, neighborly, chummy, clubby, warm, jovial,
      fun-loving, congenial, amicable, personable, approachable, people-oriented`),
    decoys: list('loud, popular, talkative, funny, generous, energetic, polite, confident'),
  },
  {
    word: 'benevolent',
    tier: 'hard',
    synonyms: list(`kind, kindly, generous, charitable, compassionate, caring, humane, altruistic, philanthropic,
      good, kindhearted, warmhearted, benign, beneficent, giving, gracious, considerate, magnanimous,
      munificent, liberal, bountiful, openhanded, big-hearted, unselfish, sympathetic, thoughtful, decent,
      tender, well-meaning, goodhearted, helpful`),
    decoys: list('wise, rich, holy, honest, loyal, peaceful, patient, humble'),
  },
  {
    word: 'meticulous',
    tier: 'hard',
    synonyms: list(`careful, precise, thorough, painstaking, scrupulous, conscientious, exact, fastidious,
      punctilious, rigorous, detailed, diligent, particular, finicky, fussy, accurate, perfectionist,
      methodical, strict, exacting, demanding, nitpicky, persnickety, assiduous`),
    decoys: list('clean, smart, slow, patient, busy, quiet, honest, clever'),
  },
  {
    word: 'loquacious',
    tier: 'hard',
    synonyms: list(`talkative, chatty, garrulous, verbose, wordy, voluble, gabby, long-winded, babbling,
      effusive, glib, mouthy, communicative, rambling, gossipy, prolix, windy, blathering, motormouthed,
      expansive, gassy, talky`),
    decoys: list('loud, rude, friendly, smart, funny, noisy, outgoing, bossy'),
  },
  {
    word: 'melancholy',
    tier: 'hard',
    synonyms: list(`sad, sorrowful, gloomy, mournful, despondent, dejected, downcast, depressed, forlorn, glum,
      morose, somber, sombre, doleful, woeful, wistful, pensive, blue, unhappy, lugubrious, dispirited,
      disconsolate, desolate, heavyhearted, low, down, sadness, sorrow, gloom, despair, misery, dejection,
      depression, woe, unhappiness, melancholia`),
    decoys: list('lonely, tired, quiet, angry, bored, dark, sleepy, nostalgic'),
  },
  {
    word: 'ubiquitous',
    tier: 'hard',
    synonyms: list(`everywhere, omnipresent, pervasive, universal, widespread, prevalent, rife, common, global,
      worldwide, inescapable, ever-present, all-pervasive, extensive, all-over`),
    decoys: list('famous, popular, huge, constant, normal, typical, obvious, endless'),
  },
  {
    word: 'candid',
    tier: 'hard',
    synonyms: list(`frank, honest, open, sincere, direct, forthright, straightforward, outspoken, blunt,
      truthful, plainspoken, straight, upfront, unreserved, guileless, ingenuous, artless, aboveboard,
      informal, impromptu, natural, unposed, spontaneous, explicit, forthcoming`),
    decoys: list('brave, rude, kind, loud, polite, simple, humble, clear'),
  },
];

export function startersForTier(tier: Tier): StarterWord[] {
  return STARTERS.filter((s) => s.tier === tier);
}
