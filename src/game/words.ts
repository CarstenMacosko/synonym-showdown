// Starter words and their accepted synonyms, grouped by difficulty tier.
//
// This is a hand-curated prototype list. It will later be generated from WordNet + Moby
// (both free for commercial use) and reviewed, so every ranked ruling is the same for everyone.
//
// `decoys` are related-but-wrong words that bots use when they bluff.
// A synonym entry like "willful/wilful" lists spellings of one word: either is accepted, and they count as the same word.

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

  {
    word: 'funny',
    tier: 'easy',
    synonyms: list(`amusing, hilarious, humorous, comical, comic, witty, entertaining, laughable, droll, hysterical,
      sidesplitting, uproarious, riotous, zany, jocular, jokey, silly, farcical, absurd, ridiculous, ludicrous,
      wacky, goofy, waggish, facetious, priceless, rib-tickling, slapstick, odd, strange, weird, peculiar,
      curious, bizarre, suspicious, fishy`),
    decoys: list('happy, loud, cute, smart, friendly, nice, lucky, cheerful'),
  },
  {
    word: 'scared',
    tier: 'easy',
    synonyms: list(`afraid, frightened, fearful, terrified, petrified, alarmed, anxious, nervous, panicky, startled,
      spooked, timid, horrified, shaken, jumpy, jittery, apprehensive, intimidated, unnerved, panicked,
      panic-stricken, terror-stricken, cowardly, fainthearted, chicken, skittish, trembling, worried, uneasy,
      aghast, daunted`),
    decoys: list('sad, tired, angry, sick, lonely, cold, quiet, weak'),
  },
  {
    word: 'old',
    tier: 'easy',
    synonyms: list(`elderly, aged, ancient, aging/ageing, senior, antique, vintage, mature, gray/grey, gray-haired,
      venerable, decrepit, geriatric, hoary, long-lived, antiquated, outdated, obsolete, old-fashioned, dated,
      archaic, prehistoric, bygone, former, previous, earlier, past, olden, primeval, timeworn, worn, used,
      secondhand, stale, experienced, veteran, seasoned`),
    decoys: list('wise, tired, slow, sick, weak, dusty, broken, quiet'),
  },
  {
    word: 'rich',
    tier: 'easy',
    synonyms: list(`wealthy, affluent, prosperous, well-off, well-to-do, loaded, moneyed, opulent, flush,
      comfortable, privileged, filthy-rich, plush, luxurious, lavish, sumptuous, abundant, plentiful, ample,
      copious, fertile, fruitful, productive, lush, luxuriant, creamy, heavy, full-bodied, flavorful/flavourful,
      vivid, vibrant, resonant, costly, expensive, precious, valuable`),
    decoys: list('famous, lucky, happy, greedy, smart, shiny, proud, busy'),
  },
  {
    word: 'quiet',
    tier: 'easy',
    synonyms: list(`silent, hushed, soft, muted, low, faint, muffled, noiseless, soundless, inaudible, peaceful,
      calm, still, tranquil, serene, placid, restful, undisturbed, sleepy, secluded, private, isolated,
      reserved, shy, reticent, taciturn, introverted, retiring, uncommunicative, subdued, mild, gentle,
      unobtrusive, discreet, low-key, mute, speechless, tight-lipped`),
    decoys: list('slow, small, empty, dark, lonely, lazy, sad, bored'),
  },
  {
    word: 'walk',
    tier: 'easy',
    synonyms: list(`stroll, amble, saunter, stride, march, hike, trek, tramp, trudge, plod, wander, ramble, roam,
      pace, step, tread, stomp, strut, promenade, toddle, shuffle, mosey, traipse, perambulate, ambulate,
      meander, patrol, prowl, sashay, waddle, lumber, journey, travel, go, advance, escort, accompany, lead,
      guide`),
    decoys: list('run, jump, crawl, swim, climb, fly, sit, dance'),
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
      knackered, run-down, tuckered, dog-tired, worn, stale, hackneyed, trite, overused, clichéd`),
    decoys: list('sick, lazy, sad, slow, old, hungry, weak, calm'),
  },
  {
    word: 'ask',
    tier: 'medium',
    synonyms: list(`inquire/enquire, question, query, quiz, interrogate, request, beg, plead, petition, demand,
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

  {
    word: 'lazy',
    tier: 'medium',
    synonyms: list(`idle, indolent, slothful, sluggish, lethargic, inactive, inert, listless, languid, torpid,
      slack, shiftless, lax, apathetic, unmotivated, work-shy/workshy, loafing, remiss, negligent,
      lackadaisical, slow, dilatory, otiose, unenergetic, lifeless`),
    decoys: list('tired, bored, messy, rude, quiet, dirty, selfish, grumpy'),
  },
  {
    word: 'ugly',
    tier: 'medium',
    synonyms: list(`unattractive, hideous, homely, plain, unsightly, unlovely, grotesque, monstrous, repulsive,
      repugnant, revolting, gross, disgusting, ghastly, horrid, horrible, nasty, vile, frightful, awful,
      terrible, unpleasant, offensive, objectionable, foul, unpleasing, unprepossessing, ill-favored/ill-favoured,
      misshapen, deformed, disfigured, hostile, menacing, ominous, threatening, sinister, dangerous, unappealing,
      beastly`),
    decoys: list('dirty, old, fat, rude, mean, stupid, weird, messy'),
  },
  {
    word: 'honest',
    tier: 'medium',
    synonyms: list(`truthful, sincere, candid, frank, open, genuine, trustworthy, honorable/honourable, upright,
      ethical, moral, principled, decent, fair, just, scrupulous, straightforward, forthright, direct, blunt,
      outspoken, plainspoken, upfront, reliable, dependable, reputable, law-abiding, righteous, virtuous,
      aboveboard, legit, legitimate, real, true, faithful, straight, unvarnished, true-blue`),
    decoys: list('brave, kind, friendly, nice, smart, humble, polite, quiet'),
  },
  {
    word: 'destroy',
    tier: 'medium',
    synonyms: list(`demolish, ruin, wreck, annihilate, obliterate, devastate, raze, level, flatten, crush,
      shatter, smash, eradicate, exterminate, eliminate, kill, slay, dismantle, sabotage, undo, spoil, mar,
      trash, total, nuke, gut, decimate, ravage, extinguish, quash, squash, torpedo, scuttle, sink, break,
      defeat, vanquish, overwhelm, consume`),
    decoys: list('hurt, attack, fight, hit, steal, throw, drop, lose'),
  },
  {
    word: 'eager',
    tier: 'medium',
    synonyms: list(`keen, enthusiastic, avid, zealous, ardent, fervent, passionate, impatient, anxious, itching,
      raring, champing, longing, yearning, hungry, thirsty, desirous, wishful, willing, ready, motivated,
      committed, devoted, earnest, intent, gung-ho, psyched, excited, agog, wholehearted, fervid, vehement, hot`),
    decoys: list('happy, busy, proud, brave, fast, nervous, loud, lucky'),
  },
  {
    word: 'clumsy',
    tier: 'medium',
    synonyms: list(`awkward, ungainly, gawky, graceless, inept, bumbling, blundering, lumbering, bungling, klutzy,
      maladroit, uncoordinated, heavy-handed, ham-fisted, butterfingered, accident-prone, inelegant,
      ungraceful, lumpish, clunky, cumbersome, unwieldy, bulky, gauche, inexpert, unskillful/unskilful, oafish,
      galumphing, stumbling, tactless, unpolished, crude`),
    decoys: list('slow, lazy, stupid, silly, messy, weak, shy, loud'),
  },

  // ---------- HARD ----------
  {
    word: 'obstinate',
    tier: 'hard',
    synonyms: list(`stubborn, headstrong, willful/wilful, pigheaded, mulish, inflexible, intransigent, obdurate,
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
    synonyms: list(`sociable, outgoing, friendly, convivial, extroverted/extraverted/extrovert, affable,
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
      morose, somber/sombre, doleful, woeful, wistful, pensive, blue, unhappy, lugubrious, dispirited,
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
  {
    word: 'frugal',
    tier: 'hard',
    synonyms: list(`thrifty, economical, sparing, prudent, careful, penny-pinching, parsimonious, stingy, miserly,
      tight, tightfisted, cheap, mean, niggardly, scrimping, abstemious, provident, conserving, saving,
      budget-conscious, meager/meagre, scanty, paltry, modest, plain, simple, spartan, austere, ascetic`),
    decoys: list('poor, greedy, humble, lazy, quiet, small, honest, clever'),
  },
  {
    word: 'mundane',
    tier: 'hard',
    synonyms: list(`ordinary, everyday, commonplace, routine, dull, boring, humdrum, banal, monotonous, tedious,
      prosaic, pedestrian, run-of-the-mill, unremarkable, unexciting, workaday, quotidian, uneventful,
      tiresome, unvaried, earthly, worldly, terrestrial, secular, temporal, material, physical, corporeal,
      normal, typical, usual, regular, standard, customary, average, vanilla, ho-hum`),
    decoys: list('simple, sad, slow, lazy, old, cheap, quiet, ugly'),
  },
  {
    word: 'lethargic',
    tier: 'hard',
    synonyms: list(`sluggish, lazy, idle, inactive, inert, lifeless, listless, languid, torpid, sleepy, drowsy,
      tired, weary, fatigued, exhausted, enervated, apathetic, indolent, slothful, slow, dull, heavy,
      comatose, somnolent, passive, phlegmatic, lackadaisical, sapped, drained, spiritless, dopey, groggy,
      logy, leaden`),
    decoys: list('sick, sad, bored, calm, shy, old, quiet, hungry'),
  },
  {
    word: 'cryptic',
    tier: 'hard',
    synonyms: list(`mysterious, enigmatic, obscure, puzzling, perplexing, baffling, mystifying, ambiguous, vague,
      unclear, abstruse, arcane, esoteric, recondite, hidden, secret, concealed, veiled, coded, encrypted,
      oracular, sibylline, opaque, impenetrable, incomprehensible, inscrutable, unintelligible, dark, murky,
      occult, elliptical, equivocal, riddling, delphic`),
    decoys: list('scary, ancient, magical, clever, quiet, dangerous, silent, foreign'),
  },
  {
    word: 'arrogant',
    tier: 'hard',
    synonyms: list(`haughty, conceited, proud, vain, egotistical/egotistic, smug, cocky, superior, condescending,
      patronizing/patronising, pompous, snobbish, snooty, stuck-up, high-handed, overbearing, imperious,
      supercilious, disdainful, scornful, contemptuous, self-important, presumptuous, boastful, bigheaded,
      swaggering, lordly, uppity, overconfident, brash, insolent, cavalier, highfalutin, pretentious,
      narcissistic, hubristic, assuming, overweening`),
    decoys: list('rude, mean, rich, jealous, loud, selfish, greedy, angry'),
  },
  {
    word: 'zealous',
    tier: 'hard',
    synonyms: list(`fervent, ardent, passionate, fanatical, enthusiastic, eager, keen, devoted, dedicated,
      committed, earnest, intense, fierce, impassioned, avid, vehement, fervid, militant, rabid, extreme,
      wholehearted, diligent, energetic, spirited, gung-ho, obsessive, single-minded, hardcore, die-hard,
      staunch, steadfast, unwavering, true-blue`),
    decoys: list('angry, brave, loud, proud, strong, busy, happy, religious'),
  },
];

/** The main spelling of a synonym entry: "willful/wilful" -> "willful". */
export function primary(entry: string): string {
  return entry.split('/')[0];
}

/** Every synonym of a starter, one spelling each. */
export function synonymWords(starter: StarterWord): string[] {
  return starter.synonyms.map(primary);
}

export function startersForTier(tier: Tier): StarterWord[] {
  return STARTERS.filter((s) => s.tier === tier);
}
