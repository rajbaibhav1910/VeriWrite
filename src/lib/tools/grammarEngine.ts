import type { ConfidenceLevel, GrammarIssue, IssueCategory } from "@/types";
import { splitParagraphs, splitSentences } from "@/lib/text";

/**
 * Rule-based grammar and style checker. Every rule reports offsets into the
 * ORIGINAL text so the editor can highlight and accept fixes without re-parsing.
 * Advisory rules (passive voice, wordiness, tense hints) report a suggestion
 * that equals the original when no safe literal replacement exists.
 */

interface RuleMatch {
  start: number;
  end: number;
  original: string;
  suggestion: string;
  explanation: string;
  /** When set, the match is dropped if the replaced text equals the original. */
  advisory?: boolean;
}

interface RuleContext {
  text: string;
}

interface Rule {
  id: string;
  category: IssueCategory;
  confidence: ConfidenceLevel;
  run: (ctx: RuleContext) => RuleMatch[];
}

/** Helper for the many rules that are one regex over the whole text. */
function regexRule(
  id: string,
  category: IssueCategory,
  confidence: ConfidenceLevel,
  pattern: RegExp,
  build: (match: RegExpMatchArray) => Omit<RuleMatch, "start" | "end" | "original"> | null,
): Rule {
  return {
    id,
    category,
    confidence,
    run: ({ text }) => {
      const out: RuleMatch[] = [];
      const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
      let match: RegExpExecArray | null = re.exec(text);
      while (match !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const built = build(match);
        if (built) out.push({ start, end, original: text.slice(start, end), ...built });
        if (re.lastIndex === match.index) re.lastIndex += 1;
        match = re.exec(text);
      }
      return out;
    },
  };
}

function preserveCase(source: string, replacement: string) {
  if (source.length === 0) return replacement;
  if (source === source.toUpperCase() && /[A-Z]{2,}/.test(source)) return replacement.toUpperCase();
  if (/[A-Z]/.test(source[0] ?? "")) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  return replacement;
}

/** Curated misspellings and confusables; the count the UI quotes is derived from this. */
const MISSPELLINGS: { wrong: string; right: string; why: string }[] = [
  { wrong: "recieve", right: "receive", why: "The i comes before the e in this word." },
  { wrong: "recieved", right: "received", why: "Past tense of receive keeps the same vowel order." },
  { wrong: "recieving", right: "receiving", why: "Receive keeps e-i ordering before -ing." },
  { wrong: "seperate", right: "separate", why: "Separate has an a in the middle, not an e." },
  { wrong: "seperated", right: "separated", why: "Separate keeps the a in the second syllable." },
  { wrong: "definately", right: "definitely", why: "The word is built from definite, so it keeps the i." },
  { wrong: "defiantly", right: "definitely", why: "Defiantly means in a defiant manner; the usual intent is definitely." },
  { wrong: "occured", right: "occurred", why: "Occur doubles the r before -ed." },
  { wrong: "occuring", right: "occurring", why: "Occur doubles the r before -ing." },
  { wrong: "accomodate", right: "accommodate", why: "Accommodate has two c's and two m's." },
  { wrong: "acommodate", right: "accommodate", why: "Accommodate starts with a double c." },
  { wrong: "begining", right: "beginning", why: "Beginning doubles the n." },
  { wrong: "buisness", right: "business", why: "Business keeps the i-s-n-e-s order from busy." },
  { wrong: "busineses", right: "businesses", why: "The plural of business is businesses." },
  { wrong: "calender", right: "calendar", why: "Calendar ends in -ar, not -er." },
  { wrong: "cemetary", right: "cemetery", why: "Cemetery uses e in the middle, not a." },
  { wrong: "changable", right: "changeable", why: "Changeable keeps the e from change." },
  { wrong: "collegue", right: "colleague", why: "Colleague ends in -eague." },
  { wrong: "concious", right: "conscious", why: "Conscious is spelled with -scio-." },
  { wrong: "curiousity", right: "curiosity", why: "Curiosity has no u after the r." },
  { wrong: "differance", right: "difference", why: "Difference ends in -ence, like different." },
  { wrong: "dilemna", right: "dilemma", why: "Dilemma uses a double m, not mn." },
  { wrong: "embaress", right: "embarrass", why: "Embarrass has two r's and two s's." },
  { wrong: "emberrass", right: "embarrass", why: "Embarrass is spelled with an a in the second syllable." },
  { wrong: "enviroment", right: "environment", why: "Environment keeps the n from environ." },
  { wrong: "exersize", right: "exercise", why: "Exercise has an i in the second syllable." },
  { wrong: "experiance", right: "experience", why: "Experience ends in -ence." },
  { wrong: "familar", right: "familiar", why: "Familiar has one a in the second syllable." },
  { wrong: "foriegn", right: "foreign", why: "Foreign is spelled fo-re-ign." },
  { wrong: "freind", right: "friend", why: "Friend keeps the ie order." },
  { wrong: "goverment", right: "government", why: "Government keeps the n from govern." },
  { wrong: "gaurantee", right: "guarantee", why: "Guarantee starts with gua-." },
  { wrong: "harrass", right: "harass", why: "Harass has only one r in English spelling." },
  { wrong: "harrassed", right: "harassed", why: "Harassed keeps a single r before -ed." },
  { wrong: "hygeine", right: "hygiene", why: "Hygiene has no e after the g." },
  { wrong: "imediate", right: "immediate", why: "Immediate doubles the m." },
  { wrong: "independant", right: "independent", why: "Independent ends in -ent." },
  { wrong: "neccessary", right: "necessary", why: "Necessary has one c and two s's." },
  { wrong: "necessery", right: "necessary", why: "Necessary is spelled -sary at the end." },
  { wrong: "occassion", right: "occasion", why: "Occasion has one s." },
  { wrong: "persistances", right: "persistences", why: "Persist keeps the -ence ending." },
  { wrong: "peices", right: "pieces", why: "Piece follows the e-before-i rule here." },
  { wrong: "positon", right: "position", why: "Position keeps the second i." },
  { wrong: "prefered", right: "preferred", why: "Prefer doubles the r before -ed." },
  { wrong: "refered", right: "referred", why: "Refer doubles the r before -ed." },
  { wrong: "recomend", right: "recommend", why: "Recommend has one c and two m's." },
  { wrong: "recomended", right: "recommended", why: "Recommended keeps the double m." },
  { wrong: "resistence", right: "resistance", why: "Resistance uses -ance." },
  { wrong: "sucess", right: "success", why: "Success has two c's and two s's." },
  { wrong: "sucessful", right: "successful", why: "Successful keeps the double c and double s." },
  { wrong: "supercede", right: "supersede", why: "Supersede ends in -sede." },
  { wrong: "tongiht", right: "tonight", why: "Tonight joins tone and night with no extra letter." },
  { wrong: "tomatoe", right: "tomato", why: "Tomato has no trailing e." },
  { wrong: "tommorow", right: "tomorrow", why: "Tomorrow has one m and two r's." },
  { wrong: "tommorrow", right: "tomorrow", why: "Tomorrow has a single m." },
  { wrong: "untill", right: "until", why: "Until has one l at the end." },
  { wrong: "usefull", right: "useful", why: "Useful ends in a single l." },
  { wrong: "vaccum", right: "vacuum", why: "Vacuum has one c and two u's." },
  { wrong: "visable", right: "visible", why: "Visible ends in -ible." },
  { wrong: "wether", right: "whether", why: "Whether is spelled with an h after the e." },
  { wrong: "wierd", right: "weird", why: "Weird breaks the i-before-e rule." },
  { wrong: "wrod", right: "word", why: "Letter order slip in a common word." },
  { wrong: "teh", right: "the", why: "Letter order slip in a common word." },
  { wrong: "adn", right: "and", why: "Letter order slip in a common word." },
  { wrong: "taht", right: "that", why: "Letter order slip in a common word." },
  { wrong: "wiht", right: "with", why: "Letter order slip in a common word." },
  { wrong: "alot", right: "a lot", why: "A lot is two words." },
  { wrong: "cant", right: "can't", why: "The contraction of can not needs an apostrophe." },
  { wrong: "wont", right: "won't", why: "The contraction of will not needs an apostrophe." },
  { wrong: "doesnt", right: "doesn't", why: "The contraction of does not needs an apostrophe." },
  { wrong: "shouldnt", right: "shouldn't", why: "The contraction of should not needs an apostrophe." },
  { wrong: "couldnt", right: "couldn't", why: "The contraction of could not needs an apostrophe." },
  { wrong: "isnt", right: "isn't", why: "The contraction of is not needs an apostrophe." },
  { wrong: "dont", right: "don't", why: "The contraction of do not needs an apostrophe." },
  { wrong: "acheive", right: "achieve", why: "Achieve keeps the i before the e." },
  { wrong: "achive", right: "achieve", why: "Achieve has an e in the middle." },
  { wrong: "adress", right: "address", why: "Address doubles the d." },
  { wrong: "agaisnt", right: "against", why: "Against is spelled a-g-a-i-n-s-t." },
  { wrong: "aparent", right: "apparent", why: "Apparent doubles the p." },
  { wrong: "arguement", right: "argument", why: "Argument drops the e from argue." },
  { wrong: "basicly", right: "basically", why: "Basically keeps the al from basic." },
  { wrong: "beatiful", right: "beautiful", why: "Beautiful starts with beau-." },
  { wrong: "becuase", right: "because", why: "Because is spelled b-e-c-a-u-s-e." },
  { wrong: "beacuse", right: "because", why: "Because keeps the a-u order in the middle." },
  { wrong: "commited", right: "committed", why: "Committed doubles the t." },
  { wrong: "comming", right: "coming", why: "Coming has one m." },
  { wrong: "conciousness", right: "consciousness", why: "Conscious keeps the -sc- spelling." },
  { wrong: "correspondance", right: "correspondence", why: "Correspondence uses -ence." },
  { wrong: "dosen't", right: "doesn't", why: "Doesn't is the contraction of does not." },
  { wrong: "effeciency", right: "efficiency", why: "Efficiency uses -ciency." },
  { wrong: "ellusive", right: "evasive", why: "Elusive means hard to catch; evasive means avoiding the point. Check which is meant." },
  { wrong: "excecute", right: "execute", why: "Execute has one c." },
  { wrong: "fulltime", right: "full-time", why: "The compound adjective is hyphenated." },
  { wrong: "governer", right: "governor", why: "Governor ends in -or." },
  { wrong: "harrassment", right: "harassment", why: "Harassment keeps a single r." },
  { wrong: "inconvienient", right: "inconvenient", why: "Inconvenient keeps the -ent ending." },
  { wrong: "knowlege", right: "knowledge", why: "Knowledge keeps the d from know." },
  { wrong: "liason", right: "liaison", why: "Liaison uses -ai- and -son." },
  { wrong: "maintainance", right: "maintenance", why: "Maintenance uses -e- in the first syllable." },
  { wrong: "manuever", right: "maneuver", why: "Maneuver is spelled with -euv-." },
  { wrong: "millenium", right: "millennium", why: "Millennium doubles the n." },
  { wrong: "neigbor", right: "neighbor", why: "Neighbor keeps the i after the e." },
  { wrong: "noticable", right: "noticeable", why: "Noticeable keeps the e from notice." },
  { wrong: "occurence", right: "occurrence", why: "Occurrence ends in -ence with a double r." },
  { wrong: "paralel", right: "parallel", why: "Parallel has one l in the middle and two at the end." },
  { wrong: "pepole", right: "people", why: "People is spelled p-e-o-p-l-e." },
  { wrong: "persue", right: "pursue", why: "Pursue starts with pur-." },
  { wrong: "posess", right: "possess", why: "Possess has two s's in the middle." },
  { wrong: "priviledge", right: "privilege", why: "Privilege has no d." },
  { wrong: "profesor", right: "professor", why: "Professor doubles the s." },
  { wrong: "prominant", right: "prominent", why: "Prominent uses an o in the second syllable." },
  { wrong: "publically", right: "publicly", why: "Publicly is spelled without an extra l." },
  { wrong: "quierd", right: "queer", why: "Spelling slip; check the intended word." },
  { wrong: "readniess", right: "readiness", why: "Readiness keeps the y from ready." },
  { wrong: "reciept", right: "receipt", why: "Receipt has an e after the c." },
  { wrong: "sincerly", right: "sincerely", why: "Sincerely keeps the e from sincere." },
  { wrong: "soloution", right: "solution", why: "Solution has no second o." },
  { wrong: "speach", right: "speech", why: "Speech is spelled with -eech." },
  { wrong: "surprize", right: "surprise", why: "Surprise uses an s in the middle." },
  { wrong: "temperary", right: "temporary", why: "Temporary uses -por- in the middle." },
  { wrong: "threshhold", right: "threshold", why: "Threshold has one h in the middle." },
  { wrong: "toamte", right: "tomato", why: "Letter order slip." },
  { wrong: "truley", right: "truly", why: "Truly drops the e from true." },
  { wrong: "twelth", right: "twelfth", why: "Twelfth keeps the f from twelve." },
  { wrong: "unforuntately", right: "unfortunately", why: "Unfortunately keeps the -tely ending." },
  { wrong: "vehical", right: "vehicle", why: "Vehicle is spelled with an i after the h." },
  { wrong: "wich", right: "which", why: "Which needs the h." },
  { wrong: "writting", right: "writing", why: "Writing has one t." },
  { wrong: "yeild", right: "yield", why: "Yield keeps the i before the e." },
];

/** Table entries that are debatable rather than wrong, so they never fire. */
const NOISE = new Set(["fulltime"]);

/** A spelling entry only counts if it has a real fix and a reason to show. */
function usableSpelling(entry: { wrong: string; right: string; why: string }) {
  return !NOISE.has(entry.wrong) && entry.why.length > 0 && entry.wrong.trim() !== entry.right.trim();
}

/** How many misspellings the checker actually knows, for copy that states a number. */
export const GRAMMAR_SPELLING_ENTRY_COUNT = MISSPELLINGS.filter(usableSpelling).length;

const CONSONANT_SOUND_VOWELS = /^(once|one|onetime|onwards?|united|unite|uniform|union|unit|utility|universal|universe|university|user|usage|use|useful|ultra|euro|european|ubiquit|utopia|opioid|oval|urea|uterus)/u;
const VOWEL_SOUND_CONSONANTS = /^(honest|honor|honour|hour|heir|humble|hospital|hotel|herb|xm)/u;

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RULES: Rule[] = [
  // Doubled words are almost always a paste or typing slip.
  regexRule("doubled-word", "grammar", "high", /\b([A-Za-z]{2,})[\s\u00a0]+\1\b/giu, (match) => {
    const word = match[1] ?? "";
    const deliberate = new Set(["had", "that", "ha", "oh", "ah", "no", "yes", "maybe", "ever", "never"]);
    if (deliberate.has(word.toLowerCase())) return null;
    return {
      suggestion: word,
      explanation: `“${word} ${word}” repeats the same word. Keep it once unless the repeat is deliberate.`,
    };
  }),

  // a / an choice based on the following sound.
  regexRule("a-an", "grammar", "high", /\b(a|an)\s+([A-Za-z][\w'-]*)/giu, (match) => {
    const article = match[1] ?? "";
    const following = match[2] ?? "";
    const next = following.toLowerCase();
    // Initialisms and single letters (an MBA, the word a) follow sound rules we cannot see.
    if (next.length < 2 || /^[A-Z]{2,}$/u.test(following) || /^x$/i.test(following)) return null;
    // The article follows the sound of the next word, so exceptions go both ways.
    const vowelSound = VOWEL_SOUND_CONSONANTS.test(next) || (/^[aeiou]/u.test(next) && !CONSONANT_SOUND_VOWELS.test(next));
    const correct = vowelSound ? "an" : "a";
    if (correct === article.toLowerCase()) return null;
    return {
      suggestion: `${preserveCase(article, correct)} ${match[2] ?? ""}`,
      explanation: `Use “${correct}” before “${match[2] ?? ""}”; the article follows the sound, not just the letter.`,
    };
  }),

  // Homophone and confusable word pairs judged from the following word.
  {
    id: "homophone",
    category: "grammar",
    confidence: "moderate",
    run: ({ text }) => {
      const checks: { re: RegExp; to: (m: RegExpMatchArray) => string; why: string }[] = [
        { re: /\btheir\s+(is|are|was|were|will|would|have|had|going|been|being|just|never|always)\b/giu, to: (m) => `they're ${m[1] ?? ""}`, why: "They're is the contraction of they are. Their shows ownership." },
        { re: /\bthey're\s+(own|team|company|house|goal|way|role|name|results|data|work|ideas|decision|approach|site|page|report|system|product|first|main|new|better|best|more|less|usual|common|birthday|party|wedding|family|kids|children)\b/giu, to: (m) => `their ${m[1] ?? ""}`, why: "Their shows ownership here. They're means they are." },
        { re: /\bthere\s+(book|team|company|house|goal|role|name|results|data|work|ideas|decision|approach|site|page|report|system|product|own|first|main|usual|common)\b/giu, to: (m) => `their ${m[1] ?? ""}`, why: "Their shows ownership. There points at a place or introduces a clause." },
        { re: /\bits\s+(not|a|an|the|been|going|very|really|important|hard|easy|clear|likely|possible|okay|fine|good|bad|time|best|worst|said|already|just|only|never|always|sometimes|even|getting|becoming|turning|feels|looks|seems|matters|helps|works)\b/giu, to: (m) => `it's ${m[1] ?? ""}`, why: "It's is the contraction of it is. Its shows ownership." },
        { re: /\bit's\s+(own|role|name|job|way|goal|team|company|first|second|main|primary|ability|purpose|responsibility|history|future|past)\b/giu, to: (m) => `its ${m[1] ?? ""}`, why: "Its shows ownership here. It's means it is." },
        { re: /\byour\s+(welcome|going|not|all|sure|right|invited|the|able|ready|looking|done)\b/giu, to: (m) => `you're ${m[1] ?? ""}`, why: "You're is the contraction of you are. Your shows ownership." },
        { re: /\bwe\s+could\s+of\b/giu, to: () => "we could have", why: "Could of is a spelling of could've; the written form is could have." },
        { re: /\b(should|would|could|must)\s+of\b/giu, to: (m) => `${m[1] ?? ""} have`, why: "Should/would/could/must of should be have." },
        { re: /\btoo\s+(the|a|an|this|that|these|those|my|our|your|his|her|their|bed|work|school|home|there)\b/giu, to: (m) => `to ${m[1] ?? ""}`, why: "Too means also or excessively. To is the word that points at a place or thing." },
        { re: /\b(more|less|better|worse|greater|fewer|easier|harder|older|younger|sooner|later|earlier|higher|lower|different)\s+then\b/giu, to: (m) => `${m[1] ?? ""} than`, why: "Comparisons take than. Then marks time or sequence." },
        { re: /\b(the|an|his|her|its|their|no|some|any|direct)\s+affect\b/giu, to: (m) => `${m[1] ?? ""} effect`, why: "Effect is the noun in this position. Affect is the verb." },
        { re: /\bto\s+effect\s+(the|a|an|change|their|our|its)\b/giu, to: (m) => `to affect ${m[1] ?? ""}`, why: "Affect is the verb meaning to influence. Effect as a verb means to bring about and is rare." },
        { re: /\b(loose)\s+(weight|control|track|focus|it|them)\b/giu, to: (m) => `lose ${m[1] ?? ""}`, why: "Lose is the verb. Loose is an adjective meaning not tight." },
        { re: /\badvice\s+(me|him|her|them|us|you)\b/giu, to: (m) => `advise ${m[1] ?? ""}`, why: "Advise is the verb. Advice is the noun." },
        { re: /\bgive\s+me\s+an\s+advise\b/giu, to: () => "give me a piece of advice", why: "Advice is an uncountable noun." },
        { re: /\bprincipal\s+(issue|problem|reason|cause|factor)\b/giu, to: (m) => `principle ${m[1] ?? ""}`, why: "A principle is a rule or belief. Principal means first in rank, or the head of a school." },
        { re: /\bi\b(?!\.)/gu, to: () => "I", why: "The pronoun I is always capitalised." },
        { re: /\bwhere\s+(going|coming|trying|not|sure|done|happy|waiting|looking)\b/giu, to: (m) => `we're ${m[1] ?? ""}`, why: "We're is the contraction of we are. Where asks about place." },
      ];
      const out: RuleMatch[] = [];
      for (const check of checks) {
        check.re.lastIndex = 0;
        let match = check.re.exec(text);
        while (match !== null) {
          const start = match.index;
          const end = start + match[0].length;
          const suggestion = check.to(match);
          out.push({
            start,
            end,
            original: text.slice(start, end),
            suggestion: preserveCase(match[0] ?? "", suggestion) === suggestion ? suggestion : suggestion,
            explanation: check.why,
          });
          check.re.lastIndex = end;
          match = check.re.exec(text);
        }
      }
      return out;
    },
  },

  // Past tenses built by adding -ed to an irregular verb: these forms are never correct.
  {
    id: "over-regularized-past",
    category: "grammar",
    confidence: "high",
    run: ({ text }) => {
      const forms: { wrong: string; right: string }[] = [
        { wrong: "runned", right: "ran" },
        { wrong: "goed", right: "went" },
        { wrong: "eated", right: "ate" },
        { wrong: "buyed", right: "bought" },
        { wrong: "thinked", right: "thought" },
        { wrong: "teached", right: "taught" },
        { wrong: "catched", right: "caught" },
        { wrong: "sleeped", right: "slept" },
        { wrong: "sitted", right: "sat" },
        { wrong: "standed", right: "stood" },
        { wrong: "finded", right: "found" },
        { wrong: "writed", right: "wrote" },
        { wrong: "spoked", right: "spoke" },
        { wrong: "broked", right: "broke" },
        { wrong: "tooken", right: "took" },
        { wrong: "gived", right: "gave" },
        { wrong: "taked", right: "took" },
        { wrong: "comed", right: "came" },
        { wrong: "winned", right: "won" },
        { wrong: "beginned", right: "began" },
        { wrong: "drinked", right: "drank" },
        { wrong: "swimmed", right: "swam" },
        { wrong: "holded", right: "held" },
        { wrong: "feeled", right: "felt" },
        { wrong: "goted", right: "got" },
        { wrong: "choosed", right: "chose" },
        { wrong: "readed", right: "read" },
        { wrong: "maded", right: "made" },
      ];
      const out: RuleMatch[] = [];
      for (const entry of forms) {
        const re = new RegExp(`\\b${entry.wrong}\\b`, "giu");
        let match = re.exec(text);
        while (match !== null) {
          const start = match.index;
          const end = start + (match[0] ?? "").length;
          out.push({
            start,
            end,
            original: text.slice(start, end),
            suggestion: preserveCase(match[0] ?? "", entry.right),
            explanation: `${match[0] ?? ""} is not a word. The past tense of this irregular verb is ${entry.right}.`,
          });
          re.lastIndex = end;
          match = re.exec(text);
        }
      }
      return out;
    },
  },

  // Pronoun case in the two patterns that are reliably wrong.
  {
    id: "pronoun-case",
    category: "grammar",
    confidence: "moderate",
    run: ({ text }) => {
      const checks: { re: RegExp; to: (m: RegExpMatchArray) => string; why: string }[] = [
        { re: /\bbetween\s+you\s+and\s+I\b/giu, to: () => "between you and me", why: "After a preposition the object form is me: between you and me." },
        { re: /\b(me|him|her)\s+and\s+(me|him|her)\s+(was|were|am|is|are|will|would|can|could|did|do|have|had)\b/giu, to: (m) => {
          const verb = (m[3] ?? "").toLowerCase();
          const plural = verb === "was" ? "were" : verb === "am" || verb === "is" ? "are" : verb === "does" ? "do" : verb === "has" ? "have" : verb;
          return `${m[1] === "her" ? "She" : "He"} and I ${plural}`;
        }, why: "A subject taking a verb takes the subject forms, and the verb has to agree with a plural subject: she/he and I." },
      ];
      const out: RuleMatch[] = [];
      for (const check of checks) {
        check.re.lastIndex = 0;
        let match = check.re.exec(text);
        while (match !== null) {
          const start = match.index;
          const end = start + (match[0] ?? "").length;
          out.push({
            start,
            end,
            original: text.slice(start, end),
            suggestion: check.to(match),
            explanation: check.why,
          });
          check.re.lastIndex = end;
          match = check.re.exec(text);
        }
      }
      return out;
    },
  },

  // Curated misspelling table.
  {
    id: "misspelling",
    category: "spelling",
    confidence: "high",
    run: ({ text }) => {
      const out: RuleMatch[] = [];
      for (const entry of MISSPELLINGS) {
        if (!usableSpelling(entry)) continue;
        const re = new RegExp(`\\b${escapeRe(entry.wrong.trim())}\\b`, "giu");
        let match = re.exec(text);
        while (match !== null) {
          const start = match.index;
          const end = start + match[0].length;
          out.push({
            start,
            end,
            original: text.slice(start, end),
            suggestion: preserveCase(match[0] ?? "", entry.right),
            explanation: `${match[0] ?? ""} is usually a misspelling of ${entry.right.trim()}. ${entry.why}`,
          });
          re.lastIndex = end;
          match = re.exec(text);
        }
      }
      return out;
    },
  },

  // Spacing and punctuation mechanics.
  regexRule("space-before-punctuation", "punctuation", "high", /\S+\s+([,.;:!?])(?=\s|$)/giu, (match) => ({
    suggestion: (match[0] ?? "").replace(/\s+([,.;:!?])(?=\s|$)/u, "$1"),
    explanation: "Do not put a space before punctuation.",
  })),
  {
    id: "run-on-boundary",
    category: "punctuation",
    confidence: "high",
    run: ({ text }) => {
      const re = /(?<=[a-z0-9])([.!?])(?=[A-Za-z])/gu;
      const out: RuleMatch[] = [];
      let match = re.exec(text);
      while (match !== null) {
        const start = (match.index ?? 0);
        const end = start + 1;
        out.push({
          start,
          end,
          original: text.slice(start, end),
          suggestion: `${match[1] ?? ""} `,
          explanation: "Two sentences are pressed together. Add a space after the full stop.",
        });
        re.lastIndex = end;
        match = re.exec(text);
      }
      return out;
    },
  },
  regexRule("double-space", "style", "moderate", /\S {2,}\S/gu, (match) => ({
    suggestion: (match[0] ?? "").replace(/ {2,}/gu, " "),
    explanation: "Extra spaces between words show up in the rendered text. Use one.",
  })),

  // "later to, to buy" — the same word twice with a comma in between.
  regexRule("repeated-word", "punctuation", "high", /\b([A-Za-z]{2,}),\s+\1\b/giu, (match) => {
    const first = (match[0] ?? "").split(",")[0] ?? "";
    return {
      suggestion: first,
      explanation: `“${first}” appears twice in a row with a comma between, which reads as a typing slip. Keep one.`,
    };
  }),

  // Comma splices.
  {
    id: "comma-splice",
    category: "punctuation",
    confidence: "moderate",
    run: ({ text }) => {
      const out: RuleMatch[] = [];
      const conjunctive = /\b[a-z]{2,}\s*,\s*(however|therefore|moreover|nevertheless|thus|instead|meanwhile|otherwise|indeed|furthermore|additionally|consequently|secondly|finally|first)\s/giu;
      let match = conjunctive.exec(text);
      while (match !== null) {
        const full = match[0] ?? "";
        const commaAt = full.indexOf(",");
        const start = match.index + commaAt;
        const end = start + 1;
        const adverb = (full.match(/,\s*(\w+)/u)?.[1] ?? "").toLowerCase();
        out.push({
          start,
          end,
          original: text.slice(start, end),
          suggestion: `; ${adverb},`,
          explanation: `“${adverb}” links two complete sentences, so a comma is not enough. Use a semicolon or start a new sentence.`,
        });
        conjunctive.lastIndex = match.index + full.length - 1;
        match = conjunctive.exec(text);
      }
      const starters = /\b[a-z]{2,}\s*,\s*(It|This|That|These|Those|He|She|They|We|You|There|Their|Some|Many|Most|All|Both|Several|Research|Studies|People|Teams|Users|Companies)\s+(was|were|is|are|has|have|had|did|do|does|can|could|will|would|should|may|might|seem|seems|need|needs|want|wants|show|shows)\b/gu;
      match = starters.exec(text);
      while (match !== null) {
        const full = match[0] ?? "";
        const commaAt = full.indexOf(",");
        const start = match.index + commaAt;
        const end = start + 1;
        out.push({
          start,
          end,
          original: text.slice(start, end),
          suggestion: text.slice(start, end),
          explanation: "This looks like two complete sentences joined by a comma. A full stop or semicolon usually reads better.",
          advisory: true,
        });
        starters.lastIndex = match.index + full.length - 1;
        match = starters.exec(text);
      }
      return out;
    },
  },

  // Subject/verb agreement, from narrow and reliable patterns.
  {
    id: "agreement",
    category: "grammar",
    confidence: "high",
    run: ({ text }) => {
      const pairs: { re: RegExp; to: (m: RegExpMatchArray) => string; why: string; advisory?: boolean }[] = [
        { re: /\b(each|every|one|none|either|neither|many)\s+of\s+the\s+(\w+)\s+(are|were|have|do)\b/giu, to: (m) => `${m[1] ?? ""} of the ${m[2] ?? ""} ${m[3] === "are" ? "is" : m[3] === "were" ? "was" : m[3] === "have" ? "has" : "does"}`, why: "Each, every, one and either take a singular verb, even when a plural noun follows of." },
        { re: /\b(he|she|it|this|that|everyone|someone|anyone|nobody|nothing|something|everything)\s+(have|are|were|do|don't)\b/giu, to: (m) => `${m[1] ?? ""} ${m[2] === "have" ? "has" : m[2] === "are" || m[2] === "were" ? "is" : m[2] === "do" ? "does" : "doesn't"}`, why: "This subject is singular, so the verb needs the singular form." },
        { re: /\b(we|they|you|these|those|both|many|several|few)\s+(has|is|was|does|doesn't)\b/giu, to: (m) => `${m[1] ?? ""} ${m[2] === "has" ? "have" : m[2] === "does" ? "do" : m[2] === "doesn't" ? "don't" : "are"}`, why: "This subject is plural, so the verb needs the plural form." },
        { re: /\bthere's\s+(\w+)s\b/giu, to: (m) => `there are ${m[1] ?? ""}s`, why: "There's does not agree with a plural noun. Use there are." },
        { re: /\bpeople\s+(is|was|has)\b/giu, to: (m) => `people ${m[1] === "has" ? "have" : "are"}`, why: "People is plural in English, so it takes are/were/have." },
        { re: /\b(everyone|everybody|someone|somebody|anyone|anybody|nobody|no-one)\s+(are|were|have|their)\b/giu, to: (m) => `${m[1] ?? ""} ${m[2] === "are" ? "is" : m[2] === "were" ? "was" : m[2] === "have" ? "has" : "their"}`, why: "Everyone and somebody are grammatically singular." },
        { re: /\bthe\s+(list|set|team|group|number|variety|series|range)\s+of\s+\w+\s+(are|were|have)\b/giu, to: (m) => `the ${m[1] ?? ""} of ${m[3] ?? ""} ${m[4] === "are" ? "is" : m[4] === "were" ? "was" : "has"}`, why: "The subject here is the collective noun, which is singular." },
        { re: /\bdata\s+(is|was|has)\b/giu, to: (m) => `data ${m[1] === "has" ? "have" : m[1] === "was" ? "were" : "are"}`, why: "In formal writing data takes a plural verb. Whichever you choose, use it consistently across the document.", advisory: true },
      ];
      const out: RuleMatch[] = [];
      for (const pair of pairs) {
        pair.re.lastIndex = 0;
        let match = pair.re.exec(text);
        while (match !== null) {
          const start = match.index;
          const end = start + (match[0] ?? "").length;
          const suggestion = pair.to(match);
          out.push({
            start,
            end,
            original: text.slice(start, end),
            suggestion: "advisory" in pair && pair.advisory ? text.slice(start, end) : suggestion,
            explanation: pair.why,
          });
          pair.re.lastIndex = Math.max(end, start + 1);
          match = pair.re.exec(text);
        }
      }
      return out.filter((item) => item.suggestion !== undefined);
    },
  },

  // A singular subject carrying a plural or base-form verb ("the dog don't",
  // "she write"). Deliberately narrow: everyday verbs whose third-person form is
  // the word plus -s, and a veto when the word in front could make the subject an
  // object ("let it work") or a subjunctive clause ("ask that she write").
  {
    id: "subject-verb",
    category: "grammar",
    confidence: "high",
    run: ({ text }) => {
      const BARE_VERBS = [
        "write", "read", "think", "say", "tell", "ask", "work", "play", "help", "learn",
        "listen", "talk", "walk", "run", "live", "love", "hate", "need", "want", "use",
        "look", "sound", "seem", "remember", "forget", "agree", "decide", "expect",
        "explain", "mention", "believe", "arrive", "start", "stop", "sit", "stand",
        "win", "lose", "cost", "fall", "stay", "turn", "grow", "speak", "spend",
        "smile", "laugh", "leave", "return", "open", "close", "answer", "suggest",
      ];
      /** Collective or irregular subjects whose number the rule will not guess. */
      const AMBIGUOUS = new Set([
        "people", "police", "children", "men", "women", "cattle", "youth", "data",
        "staff", "team", "crew", "family", "committee", "group", "number", "couple",
        "majority", "public", "news", "series", "species",
      ]);
      /** Words that are pronouns, so they cannot be the noun of a noun phrase. */
      const PRONOUNS = new Set([
        "he", "she", "it", "they", "we", "you", "i", "him", "them", "us", "me",
        "who", "what", "this", "that", "these", "those", "someone", "anyone",
      ]);
      /** Preceding words that put the following noun in object position ("let the dog do it",
       * "I saw her brother do it"), or make the clause subjunctive ("ask that she write").
       * Only these veto the match, so a real error after "of them." still gets caught.
       */
      const NOT_SUBJECT = new Set([
        "make", "makes", "made", "making", "let", "lets", "letting", "have", "has",
        "had", "having", "help", "helps", "helped", "see", "sees", "saw", "seen",
        "hear", "hears", "heard", "watch", "watches", "watched", "notice", "notices",
        "noticed", "keep", "keeps", "kept", "find", "finds", "found", "feel", "feels",
        "felt", "can", "could", "will", "would", "shall", "should", "may", "might",
        "must", "do", "does", "did", "don't", "doesn't", "didn't", "not", "that",
        "if", "whether",
      ]);

      const subjectRe = String.raw`(?:the|a|an|this|that|his|her|its|my|our|their|every|no)\s+([a-z][a-z'’-]*)|(?:(?:he|she|it|everyone|someone|anyone|nobody|everybody)\b)`;

      const blockedAt = (index: number) =>
        (text.slice(0, index).match(/[A-Za-z'’]+/gu) ?? [])
          .slice(-2)
          .some((word) => NOT_SUBJECT.has(word.toLowerCase()));

      const scans: { re: RegExp; kind: "do" | "bare" }[] = [
        { re: new RegExp(`\\b(${subjectRe})\\s+(don't|do)\\b`, "giu"), kind: "do" },
        {
          re: new RegExp(`\\b(${subjectRe})\\s+(${BARE_VERBS.join("|")})\\b(?!s\\b)`, "giu"),
          kind: "bare",
        },
      ];

      const out: RuleMatch[] = [];
      for (const scan of scans) {
        scan.re.lastIndex = 0;
        let match: RegExpExecArray | null = scan.re.exec(text);
        while (match !== null) {
          const start = match.index;
          const end = start + match[0].length;
          const phrase = match[1] ?? "";
          /** The noun only exists in the determiner branch; a pronoun subject has none. */
          const noun = (match[2] ?? "").toLowerCase();
          const verb = match[3] ?? "";
          // "that she write" is a subjunctive clause, not a disagreement, so a
          // pronoun in the noun slot vetoes the match. A plural in form ("the dogs",
          // "the analysis") is left alone too.
          const pluralInForm =
            noun.length > 1 && /s/u.test(noun[noun.length - 1] ?? "") && !/(?:ss|us|is)$/u.test(noun);
          const fixed =
            scan.kind === "do"
              ? `${phrase} ${verb === "don't" ? "doesn't" : "does"}`
              : `${phrase} ${verb}s`;
          if (
            !blockedAt(start) &&
            !PRONOUNS.has(noun) &&
            !AMBIGUOUS.has(noun) &&
            !pluralInForm &&
            fixed !== text.slice(start, end)
          ) {
            out.push({
              start,
              end,
              original: text.slice(start, end),
              suggestion: fixed,
              explanation:
                scan.kind === "do"
                  ? `“${phrase}” is a singular subject, so the verb is “${verb === "don't" ? "doesn't" : "does"}”.`
                  : `“${phrase}” is a singular subject, so “${verb}” needs the -s ending: “${verb}s”.`,
            });
          }
          scan.re.lastIndex = Math.max(end, start + 1);
          match = scan.re.exec(text);
        }
      }
      return out;
    },
  },

  // Wordiness flags that do have a safe literal replacement.
  {
    id: "wordiness",
    category: "style",
    confidence: "high",
    run: ({ text }) => {
      const map: { from: string; to: string; why: string }[] = [
        { from: "in order to", to: "to", why: "In order to is longer than it needs to be." },
        { from: "due to the fact that", to: "because", why: "Because says the same thing in one word." },
        { from: "in the event that", to: "if", why: "If is the plain conditional." },
        { from: "at this point in time", to: "now", why: "Now is enough." },
        { from: "a large number of", to: "many", why: "Many is shorter and just as clear." },
        { from: "has the ability to", to: "can", why: "Can carries the same meaning." },
        { from: "have the ability to", to: "can", why: "Can carries the same meaning." },
        { from: "is able to be", to: "can be", why: "The shorter form reads more clearly." },
        { from: "it is important to note that", to: "note that", why: "The announcement adds length, not meaning." },
        { from: "in spite of the fact that", to: "although", why: "Although is one word for the same idea." },
        { from: "for the purpose of", to: "to", why: "To is enough in most sentences." },
        { from: "on a regular basis", to: "regularly", why: "One adverb replaces the phrase." },
        { from: "each and every", to: "every", why: "The doublet adds nothing." },
        { from: "first and foremost", to: "first", why: "First already puts it first." },
        { from: "completely eliminate", to: "eliminate", why: "Eliminate is already absolute." },
        { from: "advance planning", to: "planning", why: "Planning is forward-looking by definition." },
        { from: "past history", to: "history", why: "History is past by definition." },
        { from: "final outcome", to: "outcome", why: "Outcome is the final result." },
      ];
      const out: RuleMatch[] = [];
      for (const entry of map) {
        const re = new RegExp(`\\b${escapeRe(entry.from)}\\b`, "giu");
        let match = re.exec(text);
        while (match !== null) {
          const start = match.index;
          const end = start + (match[0] ?? "").length;
          out.push({
            start,
            end,
            original: text.slice(start, end),
            suggestion: preserveCase(match[0] ?? "", entry.to),
            explanation: entry.why,
          });
          re.lastIndex = end;
          match = re.exec(text);
        }
      }
      return out;
    },
  },

  // Passive voice is a style hint, never an error, so accepting it changes nothing.
  {
    id: "passive-voice",
    category: "style",
    confidence: "low",
    run: ({ text }) => {
      const re = /\b(?<aux>is|are|was|were|be|been|being)\s+(?<verb>\w+(?:ed|en))\b(?<by>\s+by\b)?/giu;
      const out: RuleMatch[] = [];
      let match = re.exec(text);
      while (match !== null) {
        const start = match.index;
        const end = start + (match[0] ?? "").length;
        const withAgent = Boolean(match.groups?.by);
        out.push({
          start,
          end,
          original: text.slice(start, end),
          suggestion: text.slice(start, end),
          explanation: withAgent
            ? "Passive construction with a stated actor. Naming the actor first usually reads stronger."
            : "Passive construction. Passive is fine when the actor is unknown or unimportant.",
          advisory: true,
        });
        re.lastIndex = end;
        match = re.exec(text);
      }
      return out;
    },
  },

  // Tense-sequence hints: reported speech past + present.
  {
    id: "tense-sequence",
    category: "clarity",
    confidence: "low",
    run: ({ text }) => {
      const re = /\b(?<said>said|noted|argued|found|showed|reported|believed|claimed|mentioned|observed)\s+that\s+(?<rest>\w{1,20}\s+){0,4}?(?<verb>is|are)\b/giu;
      const out: RuleMatch[] = [];
      let match = re.exec(text);
      while (match !== null) {
        const verb = (match.groups?.verb ?? "").toLowerCase();
        const verbAt = (match[0] ?? "").toLowerCase().lastIndexOf(verb);
        const start = match.index + verbAt;
        const end = start + verb.length;
        out.push({
          start,
          end,
          original: text.slice(start, end),
          suggestion: text.slice(start, end),
          explanation: `Reporting verb in the past followed by “${verb}”. Keep the sequence consistent, or make it present on purpose if the claim still holds.`,
          advisory: true,
        });
        re.lastIndex = Math.max(end, match.index + 1);
        match = re.exec(text);
      }
      return out;
    },
  },

  // Sentence-level mechanics: terminal punctuation and capital starts.
  {
    id: "sentence-mechanics",
    category: "punctuation",
    confidence: "high",
    run: ({ text }) => {
      const out: RuleMatch[] = [];
      for (const paragraph of splitParagraphs(text)) {
        const spans = splitSentences(paragraph.text);
        for (const span of spans) {
          const absStart = paragraph.start + span.start;
          const absEnd = paragraph.start + span.end;
          const body = text.slice(absStart, absEnd);
          const words = body.split(/\s+/u);
          if (words.length < 3) continue;
          const first = words[0] ?? "";
          if (/^["'“(\[]/.test(first)) continue;
          if (/^[a-z]/u.test(first) && !/^\d/u.test(first)) {
            const endOfFirst = absStart + first.length;
            out.push({
              start: absStart,
              end: endOfFirst,
              original: first,
              suggestion: first.charAt(0).toUpperCase() + first.slice(1),
              explanation: "Start a sentence with a capital letter.",
            });
          }
          if (!/[.!?…:]["'”’)\]]*$/u.test(body)) {
            const tail = words.slice(-1)[0] ?? "";
            const tailStart = absEnd - tail.length;
            out.push({
              start: tailStart,
              end: absEnd,
              original: text.slice(tailStart, absEnd),
              suggestion: `${tail}.`,
              explanation: "This sentence has no full stop. Add terminal punctuation.",
            });
          }
        }
      }
      return out;
    },
  },
];

/** Advisory matches must never be applied; keep them out of the accept flow. */
function isApplicable(issue: Pick<GrammarIssue, "suggestion" | "original">) {
  return issue.suggestion !== issue.original && issue.suggestion.length > 0;
}

/**
 * A correction that replaces a capitalised word keeps that capital, so "Their
 * going" becomes "They're going" rather than a lower-case sentence opening the
 * next pass would have to flag again.
 */
function keepOpeningCase(original: string, suggestion: string) {
  const wasCapital = original[0] !== undefined && original[0] === original[0].toUpperCase() && /[A-Z]/u.test(original[0]);
  const isLetter = suggestion[0] !== undefined && /[a-z]/u.test(suggestion[0]);
  return wasCapital && isLetter ? suggestion[0].toUpperCase() + suggestion.slice(1) : suggestion;
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}

const PRIORITY: Record<ConfidenceLevel, number> = { "very-high": 3, high: 2, moderate: 1, low: 0 };

export function checkGrammar(text: string): GrammarIssue[] {
  const collected: GrammarIssue[] = [];
  for (const rule of RULES) {
    const ctx: RuleContext = { text };
    for (const match of rule.run(ctx)) {
      if (match.start === match.end) continue;
      if (text.slice(match.start, match.end) !== match.original) continue;
      if (match.original.trim().length === 0) continue;
      if (!match.advisory && match.suggestion === match.original) continue;
      const suggestion = match.advisory
        ? match.suggestion
        : keepOpeningCase(match.original, match.suggestion);
      if (!match.advisory && suggestion === match.original) continue;
      collected.push({
        id: `${rule.id}-${match.start}-${match.end}`,
        category: rule.category,
        start: match.start,
        end: match.end,
        original: match.original,
        suggestion,
        explanation: match.explanation,
        confidence: rule.confidence,
        state: "open",
      });
    }
  }

  collected.sort((a, b) => a.start - b.start || PRIORITY[b.confidence] - PRIORITY[a.confidence]);
  const kept: GrammarIssue[] = [];
  for (const issue of collected) {
    const clash = kept.find((existing) => overlaps(existing, issue));
    if (clash) {
      // Two rules fired on the same span: keep the more specific (higher-priority) one.
      if (PRIORITY[issue.confidence] > PRIORITY[clash.confidence] && issue.start === clash.start) {
        kept[kept.indexOf(clash)] = issue;
      }
      continue;
    }
    kept.push(issue);
  }
  return kept;
}

/** Applies every fix a user accepted (or the given subset), from the end backwards. */
export function applyFixes(text: string, issues: GrammarIssue[]): string {
  const actionable = issues
    .filter((issue) => issue.state !== "ignored" && isApplicable(issue))
    .filter((issue) => text.slice(issue.start, issue.end) === issue.original)
    .sort((a, b) => b.start - a.start);
  let out = text;
  for (const issue of actionable) {
    out = out.slice(0, issue.start) + issue.suggestion + out.slice(issue.end);
  }
  return out;
}

export const GRAMMAR_RULE_COUNT = RULES.length;
