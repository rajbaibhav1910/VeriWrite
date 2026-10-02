import type { ParaphraseMode, ParaphraseOptions, ParaphraseResult } from "@/types";
import { clamp } from "@/lib/utils";
import { seededRandom, splitSentences, tokenize } from "@/lib/text";

/**
 * Local paraphrase engine: deterministic lexicon-driven rewriting with light
 * syntactic transforms. `similarity` is a 0-1 token-overlap ratio against the
 * input, and `changedWords` counts input tokens that no longer survive.
 */

type Variants = Partial<Record<ParaphraseMode, string>>;

function alt(standard: string, o?: { f?: string; a?: string; s?: string; c?: string; p?: string; u?: string }): Variants {
  const v: Variants = { standard };
  if (o?.f) v.formal = o.f;
  if (o?.a) v.academic = o.a;
  if (o?.s) v.simple = o.s;
  if (o?.c) v.creative = o.c;
  if (o?.p) v.professional = o.p;
  if (o?.u) v.fluency = o.u;
  return v;
}

/** Ordered longest-first at lookup time; keys are lowercase single words. */
const WORDS: Record<string, Variants> = {
  important: alt("significant", { a: "material", s: "key", c: "pivotal", p: "critical", f: "considerable" }),
  significantly: alt("substantially", { s: "a lot", a: "markedly", p: "measurably" }),
  clear: alt("evident", { s: "plain", a: "apparent", p: "unambiguous", c: "distinct" }),
  clearly: alt("plainly", { a: "evidently", s: "very obviously", p: "unambiguously" }),
  common: alt("widespread", { s: "usual", a: "prevalent", c: "familiar", p: "standard" }),
  unusual: alt("atypical", { s: "strange", a: "exceptional", c: "singular" }),
  effective: alt("successful", { s: "it works", a: "efficacious", p: "productive", c: "potent" }),
  efficiently: alt("well", { s: "quickly", p: "productively", a: "economically" }),
  difficult: alt("demanding", { s: "hard", a: "challenging", c: "formidable", p: "complex" }),
  easy: alt("straightforward", { s: "simple", a: "uncomplicated", c: "effortless", p: "manageable" }),
  simple: alt("plain", { s: "basic", a: "uncomplicated", c: "unadorned", p: "streamlined" }),
  complex: alt("involved", { s: "tricky", a: "intricate", c: "layered", p: "sophisticated" }),
  large: alt("considerable", { s: "big", a: "substantial", c: "vast", p: "scaled" }),
  big: alt("major", { s: "large", a: "substantial", c: "weighty", p: "high-impact" }),
  small: alt("modest", { s: "little", a: "limited", c: "compact", p: "minor" }),
  many: alt("numerous", { a: "a great many", c: "plentiful", p: "multiple" }),
  much: alt("considerably", { s: "a lot", a: "far" }),
  several: alt("a number of", { s: "a few", a: "multiple" }),
  various: alt("different", { s: "many", a: "diverse", c: "assorted", p: "a range of" }),
  different: alt("distinct", { s: "other", a: "divergent", c: "varied", p: "alternative" }),
  similar: alt("comparable", { s: "alike", a: "analogous", c: "kindred", p: "aligned" }),
  possible: alt("feasible", { s: "doable", a: "plausible", c: "workable", p: "viable" }),
  likely: alt("probably", { s: "likely to", a: "in all likelihood" }),
  unlikely: alt("doubtful", { s: "not likely", a: "improbable" }),
  obvious: alt("evident", { s: "plain", a: "manifest", c: "staring" }),
  basic: alt("fundamental", { s: "simple", a: "elementary", c: "core", p: "essential" }),
  essential: alt("vital", { s: "needed", a: "indispensable", c: "cardinal", p: "critical" }),
  necessary: alt("required", { s: "needed", a: "indispensable", p: "mandatory" }),
  modern: alt("contemporary", { s: "current", a: "present-day", c: "up-to-date", p: "latest" }),
  traditional: alt("conventional", { s: "long-standing", a: "customary", c: "time-honored", p: "established" }),
  useful: alt("valuable", { s: "helpful", a: "advantageous", c: "handy", p: "practical" }),
  helpful: alt("useful", { s: "good to have", a: "beneficial", c: "informative", p: "practical" }),
  strong: alt("robust", { s: "solid", a: "potent", c: "sturdy", p: "resilient" }),
  weak: alt("fragile", { s: "thin", a: "tenuous", c: "wavering", p: "underperforming" }),
  good: alt("sound", { s: "nice", a: "favourable", c: "worthy", p: "quality" }),
  bad: alt("poor", { s: "not good", a: "adverse", c: "unwelcome", p: "substandard" }),
  great: alt("considerable", { s: "big", a: "marked", c: "formidable", p: "outstanding" }),
  high: alt("elevated", { s: "big", a: "substantial", c: "lofty", p: "premium" }),
  low: alt("reduced", { s: "small", a: "limited", c: "sunken", p: "entry-level" }),
  new: alt("fresh", { s: "recent", a: "novel", c: "untested", p: "next-generation" }),
  old: alt("earlier", { s: "aged", a: "predecessor", c: "vintage", p: "legacy" }),
  fast: alt("rapid", { s: "quick", a: "accelerated", c: "swift", p: "low-latency" }),
  slow: alt("sluggish", { s: "unhurried", a: "protracted", p: "delayed" }),
  careful: alt("deliberate", { s: "safe", a: "meticulous", c: "watchful", p: "rigorous" }),
  thorough: alt("comprehensive", { s: "complete", a: "exhaustive", p: "end-to-end" }),
  show: alt("indicate", { s: "point to", a: "demonstrate", c: "reveal", p: "surface" }),
  shows: alt("indicates", { s: "points to", a: "demonstrates", c: "reveals", p: "surfaces" }),
  showed: alt("indicated", { s: "pointed to", a: "demonstrated", c: "revealed", p: "surfaced" }),
  showing: alt("indicating", { s: "pointing to", a: "demonstrating", c: "revealing", p: "surfacing" }),
  demonstrate: alt("show", { a: "evidence", c: "make visible", p: "illustrate" }),
  demonstrates: alt("shows", { a: "evidences", p: "illustrates" }),
  illustrate: alt("show", { a: "exemplify", c: "paint", p: "document" }),
  use: alt("employ", { s: "use", a: "utilise", c: "reach for", p: "leverage" }),
  uses: alt("employs", { a: "utilises", p: "leverages", c: "draws on" }),
  used: alt("employed", { s: "put to work", a: "utilised", c: "harnessed", p: "leveraged" }),
  using: alt("employing", { s: "with", a: "utilising", c: "harnessing", p: "leveraging" }),
  utilize: alt("use", { s: "use", a: "employ", p: "operationalise" }),
  helps: alt("supports", { s: "lets", a: "facilitates", p: "enables" }),
  help: alt("support", { s: "assist", a: "facilitate", p: "enable" }),
  helped: alt("supported", { s: "aided", a: "facilitated", p: "enabled" }),
  need: alt("require", { s: "want", a: "necessitate", p: "depend on" }),
  needs: alt("requires", { s: "wants", a: "necessitates", p: "depends on" }),
  needed: alt("required", { s: "had to", a: "necessitated", p: "scoped" }),
  make: alt("produce", { s: "build", a: "render", c: "fashion", p: "deliver" }),
  makes: alt("produces", { s: "builds", a: "yields", c: "fashions", p: "delivers" }),
  made: alt("produced", { s: "built", a: "constituted", c: "wrought", p: "delivered" }),
  making: alt("producing", { s: "building", a: "generating", c: "shaping", p: "delivering" }),
  get: alt("obtain", { s: "get", a: "acquire", c: "gather", p: "secure" }),
  gets: alt("obtains", { s: "picks up", a: "acquires", p: "secures" }),
  got: alt("obtained", { s: "had", a: "acquired", p: "secured" }),
  getting: alt("obtaining", { s: "picking up", a: "acquiring", p: "securing" }),
  give: alt("provide", { s: "hand over", a: "afford", c: "offer up", p: "deliver" }),
  gives: alt("provides", { s: "hands over", a: "affords", p: "delivers" }),
  gave: alt("provided", { s: "handed", a: "afforded", p: "delivered" }),
  giving: alt("providing", { s: "handing", a: "affording", p: "delivering" }),
  find: alt("discover", { s: "see", a: "identify", c: "uncover", p: "surface" }),
  finds: alt("discovers", { s: "spots", a: "identifies", c: "uncovers", p: "surfaces" }),
  found: alt("discovered", { a: "identified", c: "uncovered", p: "established" }),
  finding: alt("discovering", { a: "identifying", c: "unearthing", p: "surfacing" }),
  think: alt("consider", { s: "feel", c: "suspect", p: "assess" }),
  thinks: alt("considers", { s: "feels", c: "suspects", p: "assesses" }),
  thought: alt("considered", { s: "felt", c: "suspected", p: "assessed" }),
  know: alt("recognise", { s: "be aware", a: "establish", c: "know well", p: "confirm" }),
  knows: alt("recognises", { s: "is aware", a: "establishes", p: "confirms" }),
  knew: alt("had recognised", { s: "were aware", a: "had established" }),
  understand: alt("grasp", { s: "get", a: "comprehend", c: "read", p: "appreciate" }),
  understands: alt("grasps", { s: "gets", a: "comprehends", p: "appreciates" }),
  believe: alt("hold the view", { s: "think", a: "posit", p: "maintain" }),
  believes: alt("holds the view", { s: "thinks", a: "posits", p: "maintains" }),
  build: alt("construct", { s: "put together", a: "assemble", c: "raise", p: "ship" }),
  builds: alt("constructs", { s: "sets up", a: "assembles", p: "ships" }),
  built: alt("constructed", { s: "put together", a: "assembled", c: "raised", p: "shipped" }),
  building: alt("constructing", { s: "setting up", a: "assembling", p: "shipping" }),
  start: alt("begin", { s: "kick off", a: "initiate", c: "open", p: "launch" }),
  starts: alt("begins", { s: "kicks off", a: "initiates", p: "launches" }),
  started: alt("began", { s: "kicked off", a: "initiated", p: "launched" }),
  starting: alt("beginning", { s: "kicking off", a: "initiating", p: "launching" }),
  begin: alt("start", { a: "commence", c: "set out", p: "initiate" }),
  begins: alt("starts", { a: "commences", p: "initiates" }),
  ended: alt("concluded", { s: "stopped", a: "terminated", p: "wrapped up" }),
  end: alt("conclude", { s: "stop", a: "terminate", p: "wrap up" }),
  stops: alt("halts", { s: "ends", a: "ceases", p: "pauses" }),
  stop: alt("halt", { s: "end", a: "cease", p: "pause" }),
  continue: alt("keep", { s: "go on", a: "persist in", p: "sustain" }),
  improves: alt("strengthens", { s: "makes better", c: "sharpens", p: "lifts" }),
  improve: alt("strengthen", { s: "better", c: "sharpen", p: "lift" }),
  improved: alt("strengthened", { s: "got better", c: "sharpened", p: "lifted" }),
  change: alt("adjust", { s: "shift", a: "modify", c: "reshape", p: "revise" }),
  changes: alt("adjustments", { s: "shifts", a: "modifications", c: "reshapings", p: "revisions" }),
  changed: alt("adjusted", { s: "shifted", a: "modified", c: "reshaped", p: "revised" }),
  create: alt("produce", { s: "make", a: "generate", c: "invent", p: "deliver" }),
  creates: alt("produces", { s: "makes", a: "generates", c: "invents", p: "delivers" }),
  created: alt("produced", { s: "made", a: "generated", c: "invented", p: "delivered" }),
  provide: alt("offer", { s: "give", a: "furnish", c: "supply", p: "deliver" }),
  provides: alt("offers", { s: "gives", a: "furnishes", p: "delivers" }),
  provided: alt("offered", { s: "gave", a: "furnished", p: "delivered" }),
  offers: alt("supplies", { s: "gives", a: "extends", p: "publishes" }),
  offer: alt("supply", { s: "give", a: "extend", p: "publish" }),
  reduce: alt("lower", { s: "cut", a: "diminish", c: "trim", p: "optimise down" }),
  reduces: alt("lowers", { s: "cuts", a: "diminishes", p: "optimises" }),
  reduced: alt("lowered", { s: "cut", a: "diminished", p: "optimised" }),
  increase: alt("raise", { s: "grow", a: "amplify", c: "boost", p: "scale up" }),
  increases: alt("raises", { s: "grows", a: "amplifies", p: "scales up" }),
  increased: alt("rose", { s: "grew", a: "amplified", p: "scaled up" }),
  ensure: alt("make sure", { s: "see to it", a: "guarantee", p: "verify" }),
  ensures: alt("make certain", { s: "see to it", a: "guarantees", p: "verifies" }),
  ensured: alt("made sure", { a: "guaranteed", p: "verified" }),
  allow: alt("permit", { s: "let", a: "enable", p: "authorise" }),
  allows: alt("permits", { s: "lets", a: "enables", p: "authorises" }),
  allowed: alt("permitted", { s: "let", a: "enabled", p: "authorised" }),
  include: alt("cover", { s: "have", a: "encompass", c: "fold in", p: "incorporate" }),
  includes: alt("covers", { s: "has", a: "encompasses", p: "incorporates" }),
  included: alt("covered", { s: "had", a: "encompassed", p: "incorporated" }),
  consider: alt("weigh", { s: "think about", a: "examine", c: "entertain", p: "evaluate" }),
  considers: alt("weighs", { s: "thinks about", a: "examines", p: "evaluates" }),
  considered: alt("weighed", { s: "thought about", a: "examined", p: "evaluated" }),
  decide: alt("determine", { s: "pick", a: "resolve", c: "settle on", p: "approve" }),
  decides: alt("determines", { s: "picks", a: "resolves", p: "approves" }),
  decided: alt("determined", { s: "picked", a: "resolved", p: "approved" }),
  explain: alt("clarify", { s: "spell out", a: "elucidate", c: "unpack", p: "document" }),
  explains: alt("clarifies", { s: "spells out", a: "elucidates", p: "documents" }),
  explained: alt("clarified", { s: "spelled out", a: "elucidated", p: "documented" }),
  suggest: alt("indicate", { s: "hint", a: "propose", c: "float", p: "recommend" }),
  suggests: alt("indicates", { s: "hints at", a: "proposes", c: "floats", p: "recommends" }),
  suggested: alt("indicated", { s: "hinted", a: "proposed", p: "recommended" }),
  recommend: alt("advise", { a: "counsel", p: "endorse" }),
  maintain: alt("sustain", { s: "keep", a: "preserve", p: "uphold" }),
  achieves: alt("reaches", { s: "gets", a: "attains", p: "delivers" }),
  achieve: alt("reach", { s: "get", a: "attain", p: "deliver" }),
  achieved: alt("reached", { s: "got", a: "attained", p: "delivered" }),
  address: alt("handle", { s: "deal with", a: "approach", p: "resolve" }),
  addresses: alt("handles", { s: "deals with", a: "approaches", p: "resolves" }),
  analyze: alt("examine", { s: "look at", a: "interrogate", c: "dissect", p: "assess" }),
  analyse: alt("examine", { s: "look at", a: "interrogate", p: "assess" }),
  assess: alt("evaluate", { s: "judge", a: "appraise", p: "score" }),
  evaluate: alt("assess", { s: "check", a: "appraise", p: "score" }),
  develop: alt("grow", { s: "build", a: "elaborate", c: "cultivate", p: "advance" }),
  implement: alt("put in place", { s: "set up", a: "operationalise", p: "roll out" }),
  identify: alt("recognise", { s: "spot", a: "determine", c: "pinpoint", p: "flag" }),
  generate: alt("produce", { s: "make", a: "yield", c: "spin up", p: "output" }),
  deliver: alt("provide", { s: "hand over", a: "furnish", p: "ship" }),
  supports: alt("underpins", { s: "helps", a: "sustains", p: "enables" }),
  support: alt("underpin", { s: "help", a: "sustain", p: "enable" }),
  manage: alt("handle", { s: "run", a: "administer", c: "steer", p: "oversee" }),
  measures: alt("tracks", { s: "counts", a: "quantifies", p: "reports" }),
  measure: alt("track", { s: "count", a: "quantify", p: "report on" }),
  monitor: alt("watch", { s: "track", a: "observe", p: "oversee" }),
  optimize: alt("fine-tune", { s: "improve", a: "maximise", p: "streamline" }),
  optimise: alt("fine-tune", { s: "improve", a: "maximise", p: "streamline" }),
  adapt: alt("adjust", { s: "fit", a: "accommodate", c: "bend", p: "localise" }),
  adopt: alt("take on", { s: "start using", a: "embrace", p: "implement" }),
  rely: alt("depend", { s: "count on", a: "lean" }),
  problem: alt("issue", { s: "trouble", a: "difficulty", c: "puzzle", p: "risk" }),
  problems: alt("issues", { s: "troubles", a: "difficulties", c: "puzzles", p: "risks" }),
  method: alt("technique", { s: "way", a: "procedure", c: "approach", p: "playbook" }),
  methods: alt("techniques", { s: "ways", a: "procedures", p: "practices" }),
  approach: alt("strategy", { s: "way", a: "methodology", c: "angle", p: "plan" }),
  approaches: alt("strategies", { s: "ways", a: "methodologies", p: "plans" }),
  result: alt("outcome", { s: "answer", a: "consequence", c: "upshot", p: "output" }),
  results: alt("outcomes", { s: "answers", a: "consequences", c: "upshots", p: "outputs" }),
  way: alt("manner", { s: "path", a: "mode", c: "route", p: "practice" }),
  ways: alt("manners", { s: "methods", a: "modes", c: "routes", p: "practices" }),
  thing: alt("element", { s: "part", a: "phenomenon", c: "object", p: "asset" }),
  things: alt("elements", { s: "parts", a: "phenomena", c: "objects", p: "assets" }),
  person: alt("individual", { s: "someone", a: "subject", c: "character", p: "stakeholder" }),
  people: alt("individuals", { s: "folks", a: "participants", c: "crowd", p: "users" }),
  company: alt("organisation", { s: "business", a: "firm", c: "venture", p: "enterprise" }),
  companies: alt("organisations", { s: "businesses", a: "firms", p: "enterprises" }),
  team: alt("group", { s: "crew", a: "cohort", c: "circle", p: "workstream" }),
  idea: alt("concept", { s: "notion", a: "proposition", c: "spark", p: "proposal" }),
  ideas: alt("concepts", { s: "notions", a: "propositions", p: "proposals" }),
  part: alt("component", { s: "piece", a: "segment", c: "fragment", p: "module" }),
  parts: alt("components", { s: "pieces", a: "segments", p: "modules" }),
  point: alt("aspect", { s: "idea", a: "contention", c: "hinge", p: "takeaway" }),
  points: alt("aspects", { s: "ideas", a: "contentions", p: "takeaways" }),
  reason: alt("cause", { s: "why", a: "rationale", c: "motive", p: "driver" }),
  reasons: alt("causes", { s: "whys", a: "rationales", p: "drivers" }),
  example: alt("instance", { s: "case", a: "illustration", c: "specimen", p: "reference" }),
  examples: alt("instances", { s: "cases", a: "illustrations", p: "references" }),
  question: alt("issue", { s: "query", a: "query", c: "riddle", p: "item" }),
  questions: alt("issues", { s: "queries", a: "queries", p: "items" }),
  area: alt("domain", { s: "field", a: "sphere", c: "territory", p: "use case" }),
  areas: alt("domains", { s: "fields", a: "spheres", p: "use cases" }),
  group: alt("set", { s: "bunch", a: "cohort", c: "cluster", p: "segment" }),
  groups: alt("sets", { s: "bunches", a: "cohorts", c: "clusters", p: "segments" }),
  level: alt("degree", { s: "amount", a: "magnitude", c: "tier", p: "maturity" }),
  process: alt("workflow", { s: "steps", a: "procedure", c: "passage", p: "pipeline" }),
  processes: alt("workflows", { s: "steps", a: "procedures", p: "pipelines" }),
  system: alt("framework", { s: "setup", a: "apparatus", c: "machine", p: "platform" }),
  systems: alt("frameworks", { s: "setups", a: "apparatuses", p: "platforms" }),
  information: alt("detail", { s: "facts", a: "data", c: "material", p: "intelligence" }),
  work: alt("effort", { s: "job", a: "labour", c: "craft", p: "engagement" }),
  job: alt("task", { s: "work", a: "assignment", c: "post", p: "role" }),
  jobs: alt("tasks", { s: "jobs", a: "assignments", p: "roles" }),
  goal: alt("objective", { s: "target", a: "aim", c: "ambition", p: "outcome" }),
  goals: alt("objectives", { s: "targets", a: "aims", p: "outcomes" }),
  benefit: alt("advantage", { s: "plus", a: "gain", c: "boon", p: "value" }),
  benefits: alt("advantages", { s: "pluses", a: "gains", p: "value adds" }),
  risk: alt("hazard", { s: "chance", a: "exposure", c: "gamble", p: "liability" }),
  risks: alt("hazards", { s: "chances", a: "exposures", p: "liabilities" }),
  cost: alt("expense", { s: "price", a: "outlay", c: "bill", p: "spend" }),
  costs: alt("expenses", { s: "prices", a: "outlays", p: "spend" }),
  research: alt("investigation", { s: "study", a: "enquiry", c: "dig", p: "discovery work" }),
  study: alt("review", { s: "look", a: "analysis", c: "exploration", p: "assessment" }),
  studies: alt("reviews", { s: "looks", a: "analyses", p: "assessments" }),
  effect: alt("impact", { s: "change", a: "consequence", c: "echo", p: "outcome" }),
  effects: alt("impacts", { s: "changes", a: "consequences", p: "outcomes" }),
  impact: alt("influence", { s: "effect", a: "repercussion", p: "business impact" }),
  impacts: alt("influences", { s: "effects", a: "repercussions", p: "outcomes" }),
  trend: alt("pattern", { s: "move", a: "propensity", c: "drift", p: "trajectory" }),
  trends: alt("patterns", { s: "moves", a: "propensities", p: "trajectories" }),
  structure: alt("makeup", { s: "shape", a: "configuration", c: "skeleton", p: "architecture" }),
  challenge: alt("difficulty", { s: "hard part", a: "obstacle", c: "puzzle", p: "constraint" }),
  challenges: alt("difficulties", { s: "hard parts", a: "obstacles", p: "constraints" }),
  opportunity: alt("chance", { s: "opening", a: "prospect", c: "doorway", p: "initiative" }),
  opportunities: alt("chances", { s: "openings", a: "prospects", p: "initiatives" }),
  requirement: alt("need", { s: "must-have", a: "prerequisite", p: "specification" }),
  requirements: alt("needs", { s: "must-haves", a: "prerequisites", p: "specifications" }),
  conclusion: alt("ending", { s: "takeaway", a: "inference", c: "verdict", p: "close" }),
  context: alt("setting", { s: "background", a: "milieu", c: "frame", p: "landscape" }),
  aspect: alt("feature", { s: "part", a: "facet", c: "angle", p: "dimension" }),
  aspects: alt("features", { s: "parts", a: "facets", p: "dimensions" }),
  element: alt("component", { s: "part", a: "constituent", c: "grain", p: "building block" }),
  choice: alt("option", { s: "pick", a: "alternative", c: " wager", p: "decision" }),
  choices: alt("options", { s: "picks", a: "alternatives", p: "decisions" }),
  ability: alt("capacity", { s: "skill", a: "capability", c: "knack", p: "readiness" }),
  attempt: alt("try", { s: "shot", a: "endeavour", c: "bid", p: "pilot" }),
  attempts: alt("tries", { s: "shots", a: "endeavours", p: "pilots" }),
  extremely: alt("highly", { s: "very", a: "exceptionally", p: "markedly" }),
  remarkably: alt("notably", { s: "very", a: "strikingly" }),
  notably: alt("particularly", { s: "especially", a: "inter alia" }),
  particularly: alt("especially", { s: "mostly", a: "namely", p: "specifically" }),
  especially: alt("particularly", { s: "mostly", a: "chiefly" }),
  primarily: alt("mainly", { s: "mostly", a: "principally", p: "first" }),
  mainly: alt("chiefly", { s: "mostly", a: "principally" }),
  generally: alt("typically", { s: "usually", a: "on the whole", p: "broadly" }),
  usually: alt("typically", { s: "often", a: "as a rule", p: "regularly" }),
  typically: alt("usually", { s: "often", a: "characteristically", p: "regularly" }),
  frequently: alt("often", { s: "a lot", a: "repeatedly", p: "periodically" }),
  occasionally: alt("sometimes", { s: "now and then", a: "intermittently" }),
  always: alt("consistently", { s: "every time", a: "invariably" }),
  never: alt("at no point", { s: "not ever", a: "not once" }),
  quickly: alt("rapidly", { s: "fast", a: "promptly", c: "in a flash", p: "without delay" }),
  slowly: alt("gradually", { s: "slow", a: "leisurely", p: "over time" }),
  easily: alt("readily", { s: "with ease", a: "effortlessly" }),
  actually: alt("in practice", { s: "really", a: "in fact", p: "effectively" }),
  basically: alt("essentially", { s: "at heart", a: "fundamentally" }),
  essentially: alt("fundamentally", { s: "at base", a: "in essence" }),
  furthermore: alt("besides", { s: "also", a: "moreover", p: "in addition" }),
  moreover: alt("besides", { s: "also", a: "furthermore", p: "additionally" }),
  however: alt("even so", { s: "but", a: "nevertheless", p: "that said" }),
  therefore: alt("so", { s: "then", a: "consequently", p: "as a result" }),
  consequently: alt("therefore", { s: "so", a: "accordingly", p: "as a result" }),
  thus: alt("so", { s: "this way", a: "thereby", p: "accordingly" }),
  hence: alt("therefore", { s: "so", a: "accordingly" }),
  additionally: alt("also", { s: "plus", a: "moreover", p: "on top of that" }),
  alternatively: alt("instead", { s: "or", a: "in the alternative" }),
  finally: alt("in the end", { s: "last", a: "in conclusion", p: "to close" }),
  overall: alt("on balance", { s: "all in all", a: "globally", p: "end to end" }),
  instead: alt("rather", { s: "as a swap", a: "in its place" }),
  despite: alt("even with", { s: "still with", a: "notwithstanding" }),
  regarding: alt("about", { s: "on", a: "concerning", p: "as it relates to" }),
  concerning: alt("about", { s: "on", a: "regarding" }),
  within: alt("inside", { s: "in", a: "interior to" }),
  without: alt("lacking", { s: "no", a: "absent" }),
  obtains: alt("secures", { s: "gets", a: "acquires" }),
  requires: alt("needs", { s: "calls for", a: "necessitates", p: "demands" }),
  require: alt("need", { s: "call for", a: "necessitate", p: "demand" }),
  required: alt("needed", { s: "called for", a: "mandatory", p: "required" }),
  exhibits: alt("shows", { s: "has", a: "displays", p: "presents" }),
  exhibit: alt("show", { s: "have", a: "display", p: "present" }),
  reveals: alt("shows", { s: "brings out", a: "discloses", c: "lays bare" }),
  reveal: alt("show", { s: "bring out", a: "disclose", c: "lay bare" }),
  comprises: alt("covers", { s: "has", a: "encompasses", p: "consists of" }),
  consists: alt("is made", { s: "is", a: "comprises" }),
  constitutes: alt("forms", { s: "makes", a: "represents" }),
  represents: alt("stands for", { s: "shows", a: "signifies", p: "reflects" }),
  indicate: alt("suggest", { s: "point to", a: "signify", p: "flag" }),
  indicates: alt("suggests", { s: "points to", a: "signifies", p: "flags" }),
  compare: alt("weigh", { s: "match", a: "contrast", p: "benchmark" }),
  avoid: alt("escape", { s: "skip", a: "preclude", p: "mitigate" }),
  limits: alt("bounds", { s: "caps", a: "constrains", p: "governs" }),
  limit: alt("bound", { s: "cap", a: "constrain", p: "govern" }),
  grows: alt("expands", { s: "gets bigger", a: "increases", p: "scales" }),
  expand: alt("widen", { s: "grow", a: "extend", c: "unfold", p: "scale" }),
  focus: alt("concentration", { s: "center", a: "emphasis", c: "centre point", p: "priority" }),
  success: alt("achievement", { s: "win", a: "attainment", c: "triumph", p: "outperformance" }),
  failure: alt("shortcoming", { s: "miss", a: "deficiency", c: "collapse", p: "loss" }),
  mistake: alt("error", { s: "slip", a: "lapse", c: "blunder", p: "defect" }),
  mistakes: alt("errors", { s: "slips", a: "lapses", c: "blunders", p: "defects" }),
  wrong: alt("incorrect", { s: "off", a: "inaccurate", p: "defective" }),
  right: alt("accurate", { s: "true", a: "correct", p: "on target" }),
  better: alt("stronger", { s: "nicer", a: "superior", c: "keener", p: "improved" }),
  worse: alt("poorer", { s: "bad", a: "deteriorated", p: "underperforming" }),
  least: alt("lowest", { s: "minimum", a: "fewest" }),
  nearly: alt("almost", { s: "close to", a: "approximately", p: "roughly" }),
  almost: alt("nearly", { s: "close to", a: "all but" }),
  enough: alt("sufficient", { s: "plenty", a: "adequate", p: "ample" }),
  aware: alt("conscious", { s: "in the know", a: "cognisant", p: "alert" }),
  stuck: alt("blocked", { s: "fast", a: "immobilised", p: "impeded" }),
  stayed: alt("remained", { s: "kept", a: "persisted" }),
  remain: alt("stay", { s: "keep", a: "persist", p: "hold" }),
  remains: alt("stays", { s: "keeps", a: "persists", p: "holds" }),
  became: alt("turned", { s: "grew" }),
  become: alt("turn", { s: "grow", p: "emerge as" }),
  happens: alt("occurs", { s: "comes up", a: "transpires", p: "lands" }),
  happened: alt("occurred", { s: "came up", a: "transpired" }),
  causing: alt("producing", { s: "making", a: "precipitating", p: "driving" }),
  causes: alt("produces", { s: "makes", a: "precipitates", p: "drives" }),
  cause: alt("source", { s: "reason", a: "origin", p: "driver" }),
  keeps: alt("holds", { s: "has", a: "retains", p: "sustains" }),
  looks: alt("appears", { s: "seems", a: "presents" }),
  seems: alt("appears", { s: "looks", a: "suggests" }),
  seen: alt("observed", { s: "noticed", a: "witnessed", p: "tracked" }),
  told: alt("informed", { s: "said", a: "briefed", p: "notified" }),
  asked: alt("requested", { s: "wondered", a: "queried", p: "raised" }),
  answers: alt("replies", { s: "fixes", a: "resolves", p: "clarifies" }),
  follows: alt("tracks", { s: "comes after", a: "ensues", p: "aligns with" }),
  lacks: alt("misses", { s: "has no", a: "is without", p: "falls short on" }),
  leads: alt("drives", { s: "heads", a: "culminates", p: "steers" }),
  stays: alt("holds", { s: "keeps", a: "remains", p: "retains" }),
  turns: alt("shifts", { s: "becomes", a: " pivots", p: "flips" }),
  tries: alt("attempts", { s: "works at", a: "endeavours", p: "pilots" }),
  waits: alt("holds", { s: "stays put", a: "remains" }),
  wants: alt("seeks", { s: "wishes for", a: "desires", p: "requests" }),
  seeks: alt("looks for", { s: "wants", a: "pursues", p: "requests" }),
  owns: alt("holds", { s: "has", a: "possesses", p: "controls" }),
  pays: alt("covers", { s: "gives", a: "remits", p: "settles" }),
  reads: alt("scans", { s: "goes over", a: "interprets", p: "reviews" }),
  runs: alt("operates", { s: "goes", a: "executes", p: "administers" }),
  sells: alt("markets", { s: "moves", a: "retails", p: "monetises" }),
  sends: alt("transmits", { s: "shots off", a: "dispatches", p: "routes" }),
  sets: alt("establishes", { s: "puts", a: "configures", p: "defines" }),
  takes: alt("captures", { s: "grabs", a: "extracts", p: "consumes" }),
  tells: alt("signals", { s: "shows", a: "discloses", p: "informs" }),
  throws: alt("discards", { s: "tosses", a: "rejects", p: "drops" }),
  views: alt("perspectives", { s: "takes", a: "interpretations", p: "lenses" }),
  speaks: alt("addresses", { s: "talks", a: "articulates", p: "communicates" }),
  spends: alt("uses", { s: "pays out", a: "expends", p: "invests" }),
  plans: alt("designs", { s: "maps", a: "projects", p: "roadmaps" }),
  plays: alt("serves", { s: "takes part", a: "performs", p: "contributes" }),
  picks: alt("selects", { s: "chooses", a: "designates", p: "prioritises" }),
  places: alt("positions", { s: "puts", a: "locates", p: "assigns" }),
  practices: alt("applies", { s: "does", a: "exercises", p: "operates" }),
  brings: alt("delivers", { s: "adds", a: "yields", p: "introduces" }),
  buys: alt("acquires", { s: "picks up", a: "procures", p: "purchases" }),
  calls: alt("terms", { s: "names", a: "designates", p: "flags" }),
  carries: alt("holds", { s: "brings", a: "entails", p: "transports" }),
  catches: alt("detects", { s: "spots", a: "intercepts", p: "flags" }),
  checks: alt("verifies", { s: "tests", a: "examines", p: "audits" }),
  claims: alt("asserts", { s: "says", a: "contends", p: "states" }),
  comes: alt("arises", { s: "shows up", a: "ensues", p: "arrives" }),
  counts: alt("measures", { s: "tallies", a: "enumerates", p: "scores" }),
  covers: alt("spans", { s: "includes", a: "encompasses", p: "addresses" }),
  cuts: alt("trims", { s: "slashes", a: "reduces", p: "optimises" }),
  dies: alt("fails", { s: "ends", a: "ceases", p: "drops" }),
  draws: alt("attracts", { s: "pulls", a: "elicits", p: "engages" }),
  drops: alt("declines", { s: "falls", a: "diminishes", p: "deprecates" }),
  ends: alt("closes", { s: "stops", a: "terminates", p: "wraps" }),
  faces: alt("confronts", { s: "meets", a: "encounters", p: "handles" }),
  fails: alt("falls short", { s: "misses", a: "does not succeed", p: "breaks down" }),
  feels: alt("senses", { s: "has", a: "perceives", p: "registers" }),
  fills: alt("populates", { s: "tops up", a: "occupies", p: "loads" }),
  fits: alt("suits", { s: "works", a: "conforms", p: "aligns" }),
  fixes: alt("resolves", { s: "mends", a: "rectifies", p: "patches" }),
  gains: alt("acquires", { s: "gets", a: "attains", p: "captures" }),
  goes: alt("proceeds", { s: "moves", a: "advances", p: "scales" }),
  hears: alt("receives", { s: "gets word", a: "perceives" }),
  holds: alt("retains", { s: "keeps", a: "maintains", p: "carries" }),
  hurts: alt("damages", { s: "harms", a: "impairs", p: "degrades" }),
  loses: alt("forfeits", { s: "drops", a: "is deprived of", p: "concedes" }),
  means: alt("implies", { s: "is about", a: "signifies", p: "entails" }),
  meets: alt("satisfies", { s: "hits", a: "fulfils", p: "targets" }),
  moves: alt("shifts", { s: "steps", a: "progresses", p: "transitions" }),
  notes: alt("observes", { s: "points out", a: "remarks", p: "records" }),
  opens: alt("launches", { s: "starts", a: "initiates", p: "unlocks" }),
  orders: alt("sequences", { s: "asks for", a: "arranges", p: "prioritises" }),
  passes: alt("clears", { s: "gets by", a: "transpires", p: "advances" }),
  pulls: alt("draws", { s: "brings", a: "extracts", p: "retrieves" }),
  pushes: alt("drives", { s: "sends", a: "propels", p: "champions" }),
  raises: alt("lifts", { s: "brings up", a: "escalates", p: "surfaces" }),
  reaches: alt("hits", { s: "gets to", a: "attains", p: "arrives at" }),
  removes: alt("drops", { s: "takes out", a: "eliminates", p: "deletes" }),
  saves: alt("preserves", { s: "keeps", a: "retains", p: "archives" }),
  says: alt("states", { s: "tells", a: "asserts", p: "reports" }),
  sees: alt("observes", { s: "notices", a: "perceives", p: "reviews" }),
  ships: alt("delivers", { s: "sends", a: "dispatches", p: "releases" }),
  shuts: alt("closes", { s: "stops", a: "terminates", p: "deactivates" }),
  visits: alt("accesses", { s: "goes to", a: "attends", p: "engages" }),
  walks: alt("steps", { s: "goes", a: "proceeds" }),
  wins: alt("prevails", { s: "gets it", a: "triumphs", p: "outperforms" }),
  writes: alt("drafts", { s: "puts down", a: "records", p: "documents" }),
  growth: alt("expansion", { s: "rise", a: "proliferation", c: "swelling", p: "scale-up" }),
  price: alt("cost", { a: "valuation", c: "figure", p: "unit economics" }),
  prices: alt("costs", { a: "valuations", p: "unit economics" }),
  weather: alt("conditions", { a: "meteorological pattern", c: "elements", p: "climate signal" }),
  market: alt("trade", { a: "marketplace", c: "current", p: "category" }),
  markets: alt("trades", { a: "marketplaces", p: "categories" }),
  supply: alt("stock", { a: "availability", c: "reserve", p: "inventory" }),
  demand: alt("appetite", { s: "want", a: "requirement", p: "pipeline" }),
  product: alt("output", { s: "made thing", a: "commodity", c: "artefact", p: "deliverable" }),
  products: alt("outputs", { a: "commodities", p: "deliverables" }),
  global: alt("worldwide", { a: "transnational", c: "planetary", p: "cross-region" }),
  local: alt("nearby", { s: "close to home", a: "subnational", c: "neighbourhood", p: "on-the-ground" }),
  region: alt("zone", { s: "area", a: "territory", c: "quarter", p: "market area" }),
  regions: alt("zones", { s: "areas", a: "territories", p: "market areas" }),
  season: alt("cycle", { s: "time of year", a: "period", c: "spell" }),
  seasons: alt("cycles", { s: "times of year", a: "periods" }),
  crops: alt("harvests", { s: "plants", a: "yields" }),
  farm: alt("holding", { s: "smallholding", a: "agricultural estate" }),
  farms: alt("holdings", { s: "smallholdings", a: "agricultural estates" }),
  farmers: alt("growers", { s: "farm workers", a: "agricultural producers", p: "supply partners" }),
  invest: alt("put money into", { a: "commit capital to", p: "fund" }),
  expensive: alt("costly", { s: "steep", a: "capital-intensive", c: "pricey", p: "premium" }),
  cheap: alt("affordable", { s: "low-cost", a: "economical", p: "budget" }),
  frost: alt("cold snap", { s: "freeze" }),
  freeze: alt("halt", { s: "stop", a: "stagnate", p: "lock" }),
  shock: alt("jolt", { s: "upset", a: "disruption", c: "rupture", p: "variance event" }),
  shocks: alt("jolts", { a: "disruptions", p: "variance events" }),
  reacts: alt("responds", { s: "answers", a: "adjusts", c: "flinches", p: "signals" }),
  react: alt("respond", { s: "answer", a: "adjust", p: "signal" }),
  decade: alt("ten-year stretch", { s: "long time" }),
  quarter: alt("one in four", { s: "fourth", a: "trimester", p: "business unit" }),
  roughly: alt("about", { s: "near", a: "approximately", p: "in the order of" }),
  approximately: alt("about", { s: "near", a: "in the order of" }),
  condition: alt("state", { s: "shape", a: "precondition", c: "setup", p: "posture" }),
  conditions: alt("circumstances", { s: "setups", a: "preconditions", p: "constraints" }),
  switch: alt("shift", { s: "swap", a: "transition", c: "pivot", p: "migrate" }),
  switches: alt("shifts", { s: "swaps", a: "transitions", p: "migrates" }),
  alternatives: alt("options", { s: "other choices", a: "substitutes", c: "detours", p: "fallbacks" }),
  exposure: alt("vulnerability", { s: "risk", a: "susceptibility", p: "downside" }),
  reward: alt("pay off", { s: "pay", a: "compensate", p: "incentivise" }),
  rewards: alt("pays off", { a: "compensates", p: "incentivises" }),
  field: alt("domain", { s: "area", a: "discipline", c: "terrain", p: "practice" }),
  fields: alt("domains", { s: "areas", a: "disciplines", p: "practices" }),
  nature: alt("character", { s: "kind", a: "constitution", c: "essence" }),
  source: alt("origin", { s: "start", a: "provenance", c: "well", p: "feed" }),
  sources: alt("origins", { a: "provenances", p: "feeds" }),
  pattern: alt("regularity", { s: "shape", a: "configuration", c: "rhyme", p: "trend" }),
  patterns: alt("regularities", { s: "shapes", p: "trends" }),
  scale: alt("size", { s: "amount", a: "magnitude", c: "reach", p: "footprint" }),
  range: alt("spread", { s: "set", a: "spectrum", c: "field", p: "portfolio" }),
  share: alt("portion", { s: "part", a: "proportion", c: "slice", p: "penetration" }),
  stage: alt("phase", { s: "step", a: "tier", p: "gate" }),
  stages: alt("phases", { s: "steps", a: "tiers", p: "gates" }),
  phase: alt("stage", { s: "part", a: "period", p: "milestone" }),
  steps: alt("moves", { s: "parts", a: "procedures", p: "actions" }),
  tool: alt("instrument", { s: "kit", p: "capability" }),
  tools: alt("instruments", { s: "kit", a: "apparatus", p: "capabilities" }),
  users: alt("people", { s: "folks", a: "participants", p: "customers" }),
  customers: alt("clients", { s: "buyers", a: "patrons", p: "accounts" }),
  clients: alt("customers", { s: "buyers", a: "patrons", p: "accounts" }),
  output: alt("result", { s: "work", a: "yield", c: "product", p: "throughput" }),
  quality: alt("standard", { s: "how good", a: "calibre", p: "grade" }),
  quantity: alt("amount", { s: "how much", a: "volume" }),
  amount: alt("quantity", { s: "load", a: "magnitude", p: "volume" }),
  numbers: alt("figures", { s: "counts", a: "numerical values", p: "metrics" }),
  figure: alt("shape", { s: "number", a: "tabulation", c: "silhouette", p: "metric" }),
  value: alt("worth", { s: "use", a: "magnitude", p: "business case" }),
  values: alt("worths", { a: "magnitudes", p: "priorities" }),
  decline: alt("drop", { s: "fall", a: "deterioration", p: "contraction" }),
  shift: alt("change", { s: "move", a: "transition", c: "swivel", p: "realignment" }),
  shifts: alt("changes", { s: "moves", a: "transitions", p: "realignments" }),
  shape: alt("form", { s: "look", a: "configuration", c: "mould", p: "influence" }),
  force: alt("pressure", { s: "pull", a: "impetus", c: "current", p: "driver" }),
  power: alt("strength", { s: "reach", a: "capacity", c: "grip", p: "leverage" }),
  order: alt("arrangement", { s: "plan", a: "sequence", c: "command", p: "backlog" }),
  space: alt("room", { s: "gap", a: "extent", c: "void", p: "headroom" }),
  time: alt("period", { s: "while", a: "duration", c: "stretch", p: "cycle time" }),
  times: alt("occasions", { s: "moments", a: "epochs" }),
  moment: alt("instant", { s: "point", a: "juncture", c: "flash", p: "checkpoint" }),
  head: alt("top", { s: "front", a: "leading edge" }),
  side: alt("flank", { s: "edge", a: "aspect", p: "dimension" }),
  bottom: alt("base", { s: "lowest part", a: "nadir", p: "floor" }),
  top: alt("peak", { s: "highest", a: "apex", c: "crown", p: "headline" }),
  line: alt("row", { s: "mark", a: "series", c: "thread", p: "track" }),
  lines: alt("rows", { a: "series", p: "tracks" }),
  page: alt("sheet", { s: "screen", a: "folio", p: "view" }),
  pages: alt("sheets", { s: "screens", a: "folios", p: "views" }),
  record: alt("account", { s: "note", a: "register", c: "trace", p: "log" }),
  records: alt("accounts", { a: "registers", p: "logs" }),
  report: alt("account", { s: "write-up", a: "bulletin", c: "dispatch", p: "readout" }),
  reports: alt("accounts", { a: "bulletins", p: "readouts" }),
  section: alt("part", { s: "bit", a: "division", c: "slice", p: "module" }),
  version: alt("form", { s: "build", a: "recension", p: "release" }),
  chance: alt("possibility", { s: "shot", a: "probability", c: "opening", p: "odds" }),
  likelihood: alt("probability", { s: "chance", a: "propensity" }),
  action: alt("move", { s: "step", a: "intervention", c: "stroke", p: "task" }),
  actions: alt("moves", { s: "steps", a: "interventions", p: "tasks" }),
  decision: alt("call", { s: "choice", a: "determination", c: "verdict", p: "sign-off" }),
  decisions: alt("calls", { s: "choices", a: "determinations", p: "sign-offs" }),
  difference: alt("gap", { s: "change", a: "disparity", c: "divide", p: "variance" }),
  degree: alt("level", { s: "amount", a: "extent", c: "shade", p: "rating" }),
  purpose: alt("aim", { s: "point", a: "intention", c: "mission", p: "objective" }),
  matter: alt("issue", { s: "thing", a: "subject", c: "affair", p: "topic" }),
  truth: alt("reality", { s: "facts", a: "veracity", c: "core", p: "ground truth" }),
  light: alt("clarity", { s: "glow", a: "illumination", p: "visibility" }),
  sound: alt("solid", { s: "good", a: "valid", c: "full", p: "reliable" }),
  staff: alt("team", { s: "people", a: "personnel", p: "headcount" }),
  skill: alt("capability", { s: "talent", a: "competency", p: "proficiency" }),
  skills: alt("capabilities", { s: "talents", a: "competencies", p: "proficiencies" }),
  knowledge: alt("expertise", { s: "know-how", a: "familiarity", p: "intellectual property" }),
  evidence: alt("support", { s: "proof", a: "testimony", c: "trail", p: "data points" }),
  proof: alt("evidence", { s: "showing", a: "demonstration", p: "validation" }),
  theory: alt("model", { s: "idea", a: "hypothesis", c: "framework of thought", p: "thesis" }),
  model: alt("frame", { s: "example", a: "paradigm", p: "reference" }),
  models: alt("frames", { s: "examples", a: "paradigms", p: "references" }),
  case: alt("instance", { s: "situation", a: "scenario", c: "pocket", p: "use case" }),
  cases: alt("instances", { s: "situations", a: "scenarios", p: "use cases" }),
  factor: alt("element", { s: "part", a: "determinant", c: "lever", p: "driver" }),
  factors: alt("elements", { s: "parts", a: "determinants", p: "drivers" }),
  basis: alt("base", { s: "start", a: "foundation", p: "groundwork" }),
  future: alt("ahead", { s: "later", a: "prospective period", c: "tomorrow", p: "roadmap" }),
  past: alt("earlier", { s: "before", a: "antecedent period", c: "yesterday" }),
  present: alt("current", { s: "now", a: "contemporary", p: "in-flight" }),
  early: alt("soon", { s: "before", a: "premature", p: "up front" }),
  later: alt("afterwards", { s: "then", a: "subsequently", p: "next" }),
  recent: alt("latest", { s: "new", a: "short-term", p: "just-shipped" }),
  recently: alt("lately", { s: "not long ago", a: "of late", p: "this cycle" }),
  today: alt("nowadays", { s: "now", a: "at present", p: "in the current cycle" }),
  nowhere: alt("not anywhere", { s: "no place" }),
  everywhere: alt("throughout", { s: "all over", a: "ubiquitously" }),
  somewhere: alt("some place", { s: "around" }),
  something: alt("a certain element", { s: "a thing", a: "an entity" }),
  someone: alt("a person", { s: "somebody", a: "an individual" }),
  nothing: alt("not one thing", { s: "zero", a: "naught" }),
  everything: alt("the whole of it", { s: "all of it", a: "the totality" }),
  itself: alt("alone", { s: "it", a: "per se" }),
  myself: alt("personally", { s: "me" }),
  others: alt("other people", { s: "the rest", a: "counterparts" }),
  none: alt("not one", { s: "no", a: "nil" }),
  more: alt("additional", { s: "extra", a: "further", p: "incremental" }),
  most: alt("the majority of", { s: "nearly all", a: "the greater part of" }),
  such: alt("these kinds of", { s: "like", a: "of this nature" }),
  same: alt("identical", { s: "equal", a: "congruent", p: "shared" }),
  only: alt("sole", { s: "just", a: "exclusive", p: "single-focus" }),
  even: alt("still", { s: "also", a: "moreover" }),
  just: alt("simply", { s: "only", a: "merely" }),
  still: alt("even now", { s: "yet", a: "nevertheless" }),
  yet: alt("still", { s: "so far", a: "hitherto" }),
  then: alt("after that", { s: "next", a: "thereupon" }),
  now: alt("at this point", { s: "today", a: "presently", p: "in the current cycle" }),
  here: alt("in this place", { s: "around", a: "herewith" }),
  though: alt("even so", { s: "but", a: "albeit" }),
  until: alt("up to the point", { s: "till", a: "save when" }),
  since: alt("because", { s: "as", a: "inasmuch as" }),
  after: alt("once", { s: "later than", a: "subsequent to" }),
  before: alt("prior to", { s: "earlier than", a: "in advance of" }),
  above: alt("over", { s: "up", a: "aforementioned" }),
  below: alt("under", { s: "down", a: "hereinafter" }),
  across: alt("throughout", { s: "over", a: "crosswise", p: "end-to-end" }),
  toward: alt("in the direction of", { s: "to", a: "with a view to" }),
  around: alt("roughly", { a: "in the vicinity of", p: "about" }),
  between: alt("among", { s: "in the middle of", a: "inter" }),
  against: alt("contrary to", { s: "versus", a: "in opposition to", p: "versus" }),
  inside: alt("within", { s: "in", a: "interior to" }),
  outside: alt("beyond", { s: "out of", a: "extramural", p: "off-platform" }),
  along: alt("down", { s: "with", a: "in tandem with" }),
  under: alt("beneath", { s: "below", a: "subordinate to" }),
  over: alt("above", { s: "past", a: "in excess of" }),
  during: alt("across", { s: "while", a: "in the course of", p: "throughout" }),
  because: alt("since", { s: "as", a: "inasmuch as", p: "because" }),
  about: alt("around", { s: "near", a: "concerning", p: "on" }),
  like: alt("similar to", { s: "like", a: "analogous to", c: "along the lines of" }),
  differs: alt("varies", { s: "changes", a: "diverges", c: "parts ways", p: "deviates" }),
  vary: alt("differ", { s: "change", a: "diverge", p: "vary by segment" }),
  varies: alt("differs", { s: "changes", a: "diverges", p: "tracks" }),
  spread: alt("reach", { s: "stretch", a: "dissemination", c: "drift", p: "penetration" }),
  tracks: alt("follows", { s: "watches", a: "logs", p: "monitors" }),
  driven: alt("shaped", { s: "caused", a: "propelled", p: "underpinned" }),
  drives: alt("shapes", { s: "causes", a: "propels", p: "underpins" }),
  drive: alt("shape", { s: "cause", a: "propel", p: "underpin" }),
  key: alt("central", { s: "main", a: "pivotal", c: "cardinal", p: "critical" }),
  main: alt("primary", { s: "big", a: "principal", c: "leading", p: "core" }),
  major: alt("significant", { s: "big", a: "considerable", c: "weighty", p: "flagship" }),
  minor: alt("secondary", { s: "small", a: "trivial", p: "low-priority" }),
  direct: alt("plain", { s: "straight", a: "unmediated", c: "point-blank", p: "first-line" }),
  full: alt("complete", { s: "whole", a: "comprehensive", c: "unabridged", p: "end-to-end" }),
  half: alt("portion", { s: "part", a: "moiety" }),
  whole: alt("entire", { s: "full", a: "aggregate", c: "unbroken", p: "end-to-end" }),
  total: alt("combined", { s: "all", a: "aggregate", c: "sum", p: "overall" }),
  final: alt("closing", { s: "last", a: "terminal", c: "final", p: "go-live" }),
  next: alt("following", { s: "then", a: "subsequent", p: "upcoming" }),
  last: alt("previous", { s: "end", a: "ultimate", p: "prior" }),
  first: alt("earliest", { s: "start", a: "initial", c: "opening", p: "top-priority" }),
  each: alt("every", { s: "all", a: "respective" }),
  every: alt("each", { s: "all", a: "any given" }),
  given: alt("provided", { s: "shown", a: "premised", p: "scoped" }),
  based: alt("grounded", { s: "built", a: "founded", p: "anchored" }),
  taken: alt("captured", { s: "got", a: "extracted", p: "consumed" }),
  known: alt("recognised", { s: "understood", a: "established", p: "documented" }),
  shown: alt("demonstrated", { s: "revealed", a: "evidenced", p: "reported" }),
  put: alt("place", { s: "set", a: "position", c: "park", p: "assign" }),
  set: alt("establish", { s: "put", a: "configure", p: "define" }),
  run: alt("operate", { s: "go", a: "execute", p: "administer" }),
  try: alt("attempt", { s: "shot", a: "endeavour", c: "bid", p: "pilot" }),
  turn: alt("shift", { s: "change", a: "pivot", c: "twist", p: "transition" }),
  call: alt("term", { s: "name", a: "designate", p: "flag" }),
  place: alt("position", { s: "spot", a: "locate", p: "assign" }),
  keep: alt("hold", { s: "have", a: "retain", p: "sustain" }),
  take: alt("capture", { s: "grab", a: "extract", p: "consume" }),
  note: alt("remark", { s: "point out", a: "observe", p: "record" }),
  look: alt("review", { s: "glance", a: "examination", c: "gaze", p: "audit" }),
  want: alt("wish for", { s: "like", a: "desire", p: "request" }),
  aim: alt("goal", { s: "plan", a: "intention", c: "shot", p: "objective" }),
  plan: alt("design", { s: "map", a: "project", p: "roadmap" }),
  play: alt("serve", { s: "take part", a: "perform", p: "contribute" }),
  answer: alt("reply", { s: "fix", a: "resolution", p: "clarification" }),
  check: alt("verify", { s: "test", a: "examine", p: "audit" }),
  cut: alt("trim", { s: "slash", a: "reduce", p: "optimise" }),
  drop: alt("decline", { s: "fall", a: "diminution", p: "deprecation" }),
  gain: alt("acquire", { s: "get", a: "attain", p: "capture" }),
  hold: alt("retain", { s: "keep", a: "maintain", p: "carry" }),
  pass: alt("clear", { s: "get by", a: "transpire", p: "advance" }),
  pull: alt("draw", { s: "bring", a: "extract", p: "retrieve" }),
  push: alt("drive", { s: "send", a: "propel", p: "champion" }),
  raise: alt("lift", { s: "bring up", a: "escalate", p: "surface" }),
  reach: alt("hit", { s: "get to", a: "attain", p: "arrive at" }),
  save: alt("preserve", { s: "keep", a: "retain", p: "archive" }),
  ship: alt("deliver", { s: "send", a: "dispatch", p: "release" }),
  view: alt("perspective", { s: "take", a: "interpretation", p: "lens" }),
  walk: alt("step", { s: "go", a: "proceed" }),
  win: alt("prevail", { s: "succeed", a: "triumph", p: "outperform" }),
  write: alt("draft", { s: "put down", a: "record", p: "document" }),
  pick: alt("select", { s: "choose", a: "designate", p: "prioritise" }),
  seek: alt("look for", { s: "want", a: "pursue", p: "target" }),
  wait: alt("hold", { s: "pause", a: "remain pending", p: "queue" }),

};

/** Multi-word rewrites applied before single-word substitution. */
const PHRASES: { from: string; to: Variants }[] = [
  { from: "in order to", to: alt("to", { a: "so as to", s: "to", p: "to" }) },
  { from: "due to the fact that", to: alt("because", { a: "owing to", s: "since", p: "because" }) },
  { from: "because of the fact that", to: alt("because", { a: "since", s: "since" }) },
  { from: "a large number of", to: alt("many", { s: "lots of", a: "numerous", p: "multiple" }) },
  { from: "a lot of", to: alt("plenty of", { s: "much", a: "considerable", p: "substantial" }) },
  { from: "lots of", to: alt("a great deal of", { s: "many", a: "numerous" }) },
  { from: "in the event that", to: alt("if", { a: "should", s: "if" }) },
  { from: "with regard to", to: alt("about", { a: "regarding", s: "on", p: "as part of" }) },
  { from: "with respect to", to: alt("about", { a: "concerning", s: "on" }) },
  { from: "at the present time", to: alt("now", { a: "at present", s: "today", p: "today" }) },
  { from: "in the near future", to: alt("shortly", { a: "in the immediate term", s: "soon", p: "next quarter" }) },
  { from: "on a regular basis", to: alt("regularly", { a: "periodically", s: "often", p: "routinely" }) },
  { from: "in spite of", to: alt("despite", { a: "notwithstanding", s: "even with" }) },
  { from: "for the purpose of", to: alt("to", { a: "for the purpose of", s: "for", p: "to" }) },
  { from: "take into account", to: alt("consider", { a: "weigh", s: "factor in", p: "incorporate" }) },
  { from: "play a role in", to: alt("shape", { a: "contribute to", s: "matter for", p: "drive" }) },
  { from: "play a crucial role in", to: alt("be central to", { a: "be pivotal to", s: "matter most in", p: "anchor" }) },
  { from: "has the ability to", to: alt("can", { a: "is able to", s: "can" }) },
  { from: "have the ability to", to: alt("can", { a: "are able to", s: "can" }) },
  { from: "is able to", to: alt("can", { a: "is capable of", s: "can" }) },
  { from: "are able to", to: alt("can", { a: "are capable of", s: "can" }) },
  { from: "it is important to note that", to: alt("notably,", { a: "it should be recognised that", s: "keep in mind that", p: "critically," }) },
  { from: "it is worth noting that", to: alt("notably,", { a: "it is instructive that", s: "interestingly,", p: "worth flagging:" }) },
  { from: "the fact that", to: alt("that", { a: "the circumstance that", s: "that" }) },
  { from: "there are many", to: alt("many", { a: "numerous", s: "plenty of" }) },
  { from: "there is a", to: alt("a", { a: "one", s: "a" }) },
  { from: "made a decision", to: alt("decided", { a: "resolved", s: "chose" }) },
  { from: "came to a conclusion", to: alt("concluded", { a: "reasoned", s: "ended up" }) },
  { from: "gave rise to", to: alt("produced", { a: "precipitated", s: "led to", p: "drove" }) },
  { from: "in addition", to: alt("besides", { a: "moreover", s: "also", p: "on top of that" }) },
  { from: "in conclusion", to: alt("to sum up", { a: "in summary", s: "so", p: "to close" }) },
  { from: "for example", to: alt("for instance", { a: "illustratively", s: "like", p: "such as" }) },
  { from: "think about", to: alt("consider", { a: "examine", s: "think about", p: "assess" }) },
  { from: "invest in", to: alt("put money into", { a: "commit capital to", s: "pay for", p: "fund" }) },
  { from: "within hours", to: alt("quickly", { a: "within a short period", s: "fast" }) },
  { from: "a third of", to: alt("one part in three of", { a: "approximately one third of" }) },
  { from: "for instance", to: alt("as an example", { a: "illustratively", s: "like" }) },
  { from: "as a result", to: alt("so", { a: "consequently", s: "that is why", p: "therefore" }) },
  { from: "in this way", to: alt("this way", { a: "by this means", s: "so" }) },
  { from: "on the other hand", to: alt("by contrast", { a: "conversely", s: "but" }) },
  { from: "in contrast to", to: alt("unlike", { a: "by contrast with", s: "different from" }) },
  { from: "at the same time", to: alt("meanwhile", { a: "simultaneously", s: "also" }) },
  { from: "first of all", to: alt("first", { a: "in the first instance", s: "start by" }) },
  { from: "last but not least", to: alt("finally", { a: "not insignificantly", s: "and lastly" }) },
  { from: "more or less", to: alt("roughly", { a: "approximately", s: "about" }) },
  { from: "and so on", to: alt("among others", { a: "inter alia", s: "like that" }) },
  { from: "such as", to: alt("for example", { a: "including", s: "like", p: "like" }) },
  { from: "used to be", to: alt("had previously been", { a: "had at one time been", s: "had once been" }) },
  { from: "need to", to: alt("have to", { a: "ought to", s: "must", p: "should" }) },
  { from: "has to", to: alt("needs to", { a: "is required to", s: "must" }) },
  { from: "have to", to: alt("need to", { a: "are required to", s: "must" }) },
  { from: "try to", to: alt("work to", { a: "endeavour to", s: "aim to", p: "strive to" }) },
  { from: "want to", to: alt("aim to", { a: "wish to", s: "like to", p: "plan to" }) },
  { from: "going to", to: alt("set to", { a: "poised to", s: "will", p: "scheduled to" }) },
  { from: "a way of", to: alt("a route to", { a: "a means of", s: "a way to" }) },
  { from: "kind of", to: alt("somewhat", { a: "to a degree", s: "sort of" }) },
  { from: "sort of", to: alt("somewhat", { a: "to some extent", s: "kind of" }) },
  { from: "a bit", to: alt("slightly", { a: "marginally", s: "a little" }) },
  { from: "very much", to: alt("greatly", { a: "markedly", s: "a lot" }) },
  { from: "right now", to: alt("currently", { a: "at this juncture", s: "now", p: "today" }) },
  { from: "each and every", to: alt("every", { a: "each", s: "all" }) },
  { from: "in the context of", to: alt("within", { a: "with reference to", s: "in" }) },
  { from: "on the basis of", to: alt("from", { a: "grounded in", s: "using", p: "based on" }) },
  { from: "in terms of", to: alt("for", { a: "with respect to", s: "about", p: "on" }) },
  { from: "based on", to: alt("drawing on", { a: "grounded in", s: "from", p: "informed by" }),
  },
  { from: "in different ways", to: alt("differently", { s: "differently", a: "along distinct lines", p: "by segment" }) },
  { from: "a small number of", to: alt("few", { a: "a limited number of", p: "a narrow set of" }) },
  { from: "in the long run", to: alt("over time", { a: "in the extended term", s: "eventually", p: "across the horizon" }) },
  { from: "depends on", to: alt("hinges on", { a: "is contingent upon", p: "is driven by" }) },
  { from: "lead to", to: alt("produce", { a: "culminate in", s: "cause", p: "drive" }) },
  { from: "leads to", to: alt("produces", { a: "culminates in", s: "causes", p: "drives" }) },
  { from: "carry out", to: alt("run", { a: "conduct", s: "do", p: "execute" }) },
  { from: "look at", to: alt("examine", { a: "scrutinise", s: "check", p: "assess" }) },
  { from: "point out", to: alt("note", { a: "observe", s: "flag", p: "document" }) },
  { from: "set up", to: alt("build", { a: "establish", s: "start", p: "provision" }) },
  { from: "figure out", to: alt("resolve", { a: "determine", s: "work out", p: "diagnose" }) },
  { from: "find out", to: alt("learn", { a: "ascertain", s: "see", p: "verify" }) },
  { from: "come up with", to: alt("produce", { a: "devise", s: "think of", p: "deliver" }) },
  { from: "put together", to: alt("assemble", { a: "compile", s: "build", p: "package" }) },
  { from: "make sure", to: alt("verify", { a: "ensure", s: "check", p: "confirm" }) },
  { from: "as well as", to: alt("and also", { a: "in addition to", s: "plus", p: "along with" }) },
  { from: "rather than", to: alt("instead of", { a: "in preference to", s: "not" }) },
  { from: "whether or not", to: alt("whether", { a: "if", s: "if" }) },
  { from: "so that", to: alt("so", { a: "in order that", s: "to" }) },
  { from: "even though", to: alt("though", { a: "albeit", s: "even if" }) },
];

/** Intensifiers simply go away in the tighter modes. */
const WEED_OUT: ParaphraseMode[] = ["simple", "professional", "fluency"];
const HEDGES: ParaphraseMode[] = ["academic", "formal"];

const MODE_FALLBACK: Record<ParaphraseMode, ParaphraseMode[]> = {
  standard: ["professional"],
  fluency: ["standard", "simple"],
  formal: ["standard", "academic"],
  academic: ["formal", "standard"],
  simple: ["standard", "fluency"],
  creative: ["standard", "fluency"],
  professional: ["formal", "standard"],
};

function pick(variants: Variants, mode: ParaphraseMode, draw: () => number): string | null {
  const chain = [mode, ...MODE_FALLBACK[mode], "standard" as ParaphraseMode];
  const seen = new Set<ParaphraseMode>();
  for (const key of chain) {
    if (seen.has(key)) continue;
    seen.add(key);
    const value = variants[key];
    if (value && !value.startsWith(" ")) return value;
  }
  void draw;
  return null;
}

function matchCase(source: string, replacement: string) {
  if (!/[A-Z]/.test(source[0] ?? "")) return replacement;
  if (source === source.toUpperCase() && /[A-Z]{2,}/.test(source)) return replacement.toUpperCase();
  return replacement[0].toUpperCase() + replacement.slice(1);
}

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyPhrases(body: string, mode: ParaphraseMode, draw: () => number): string {
  let out = body;
  for (const entry of PHRASES) {
    const replacement = pick(entry.to, mode, draw);
    if (!replacement) continue;
    const re = new RegExp(`\\b${escapeRe(entry.from)}\\b`, "gi");
    out = out.replace(re, (found) => matchCase(found, replacement));
  }
  return out;
}

/** Keys whose readings are often nouns; skip them after a determiner. */
const VERBAL_KEYS = new Set([
  "need", "needs", "help", "support", "focus", "cause", "causes", "attempt", "choice", "work", "risk",
  "cost", "benefit", "impact", "impacts", "effect", "effects", "lead", "leads", "plan", "plans", "play",
  "measure", "measures", "aim", "want", "wants", "call", "calls", "answer", "answers", "check", "checks",
  "cut", "cuts", "drop", "drops", "gain", "hold", "holds", "keep", "keeps", "note", "notes", "order",
  "orders", "pass", "passes", "pull", "pulls", "push", "pushes", "raise", "raises", "reach", "reaches",
  "save", "saves", "set", "sets", "ship", "take", "takes", "use", "uses", "view", "views", "wait", "waits",
  "walk", "win", "write", "writes", "offer", "offers", "pick", "picks", "seek", "seeks", "show", "shows",
  "make", "makes", "give", "gives", "model", "models", "shape", "shapes", "shift", "shifts", "turn", "turns",
  "place", "places", "part", "parts", "point", "points", "way", "ways", "value", "values", "power", "force",
]);
const PRECEDING_NOUN_MARKERS = new Set([
  "the", "a", "an", "this", "that", "these", "those", "his", "her", "its", "their", "our", "your", "my",
  "no", "some", "any", "each", "every", "both", "either", "much", "little", "of", "for", "with", "in", "on", "at", "by", "one",
]);

function applyWords(body: string, mode: ParaphraseMode, density: number, draw: () => number): string {
  const pieces = body.split(/(\s+)/);
  let previousWord = "";
  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i];
    if (!piece || /^\s+$/.test(piece)) continue;
    const trail = piece.match(/[^\p{L}\p{N}']+$/u)?.[0] ?? "";
    const lead = piece.match(/^[^\p{L}\p{N}']+/u)?.[0] ?? "";
    const core = piece.slice(lead.length, piece.length - trail.length);
    if (core.length < 3) { previousWord = ""; continue; }
    if (/\d/.test(core)) { previousWord = ""; continue; }
    // Mid-sentence capitals usually mark proper nouns; leave them alone.
    if (core[1] && core[1] === core[1].toUpperCase() && /[A-Z]/.test(core[1])) { previousWord = ""; continue; }
    const key = core.toLowerCase();
    const entry = WORDS[key];
    if (!entry) { previousWord = key; continue; }
    if (VERBAL_KEYS.has(key) && PRECEDING_NOUN_MARKERS.has(previousWord)) { previousWord = key; continue; }
    previousWord = key;
    if (draw() > density) continue;
    const replacement = pick(entry, mode, draw);
    if (!replacement || replacement.toLowerCase() === key) continue;
    pieces[i] = lead + matchCase(core, replacement) + trail;
  }
  return pieces.join("");
}

function dropWeeds(body: string, mode: ParaphraseMode): string {
  if (!WEED_OUT.includes(mode)) return body;
  return body.replace(/\b(very|really|quite|basically|actually|just|quite simply|in fact)\b\s+/gi, "");
}

/** Words that are never proper nouns, so they may be lowercased after a hedge. */
const LOWERCASE_SAFE = new Set(["the", "a", "an", "this", "these", "such", "most", "many", "some", "in", "for", "it", "there", "their", "when", "while", "although", "because", "research", "cities", "data", "work", "people", "systems", "models", "results"]);

function addHedges(body: string, mode: ParaphraseMode, draw: () => number): string {
  if (!HEDGES.includes(mode)) return body;
  if (draw() > 0.4) return body;
  const openers = ["On the evidence, ", "In practice, ", "Broadly, ", "In most cases, "];
  const first = body.match(/^\S+/u)?.[0]?.replace(/[^\p{L}]/gu, "").toLowerCase() ?? "";
  if (!LOWERCASE_SAFE.has(first)) return body;
  const opener = openers[Math.floor(draw() * openers.length)] ?? openers[0];
  return opener + body.charAt(0).toLowerCase() + body.slice(1);
}

function adjustContractions(body: string, mode: ParaphraseMode): string {
  if (mode === "formal" || mode === "academic" || mode === "professional") {
    return body
      .replace(/\bcan't\b/gi, "cannot")
      .replace(/\bdon't\b/gi, "do not")
      .replace(/\bdoesn't\b/gi, "does not")
      .replace(/\bdidn't\b/gi, "did not")
      .replace(/\bit's\b/gi, "it is")
      .replace(/\bthat's\b/gi, "that is")
      .replace(/\bthere's\b/gi, "there is")
      .replace(/\bwon't\b/gi, "will not")
      .replace(/\bshouldn't\b/gi, "should not")
      .replace(/\bcouldn't\b/gi, "could not")
      .replace(/\bwouldn't\b/gi, "would not")
      .replace(/\baren't\b/gi, "are not")
      .replace(/\bisn't\b/gi, "is not")
      .replace(/\byou'll\b/gi, "you will")
      .replace(/\bwe're\b/gi, "we are")
      .replace(/\bI'm\b/g, "I am");
  }
  if (mode === "simple" || mode === "fluency") {
    return body
      .replace(/\bdo not\b/gi, "don't")
      .replace(/\bcannot\b/gi, "can't")
      .replace(/\bit is\b/gi, "it's")
      .replace(/\bthat is\b/gi, "that's")
      .replace(/\bthere is\b/gi, "there's")
      .replace(/\bwe are\b/gi, "we're")
      .replace(/\byou will\b/gi, "you'll")
      .replace(/\bare not\b/gi, "aren't")
      .replace(/\bis not\b/gi, "isn't")
      .replace(/\bwill not\b/gi, "won't");
  }
  return body;
}

/** Clause reordering that keeps every token inside the same sentence. */
function reorderClauses(body: string, mode: ParaphraseMode): string {
  if (mode === "standard") return body;
  const leading = body.match(/^(?<sub>Although|While|Because|Since|If|When|Unless)\s+(?<a>[^,.!?;]+),\s+(?<b>[A-Z][^!?]*)$/u);
  if (leading?.groups) {
    const { sub, a, b } = leading.groups;
    const marker = sub.toLowerCase();
    return `${b.trim()}, ${marker} ${a.charAt(0).toLowerCase()}${a.slice(1)}`;
  }
  const trailing = body.match(/^(?<b>[A-Z][^,.!?;]+),\s+(?<sub>because|since|although|when|if|unless)\s+(?<a>[^!?]+)$/u);
  if (trailing?.groups) {
    const { sub, a, b } = trailing.groups;
    return `${sub.charAt(0).toUpperCase()}${sub.slice(1)} ${a}, ${b.charAt(0).toLowerCase()}${b.slice(1)}`;
  }
  return body;
}

/** Only the safest passive shape: `The X was VERBed by Y.` */
function devoice(body: string, mode: ParaphraseMode): string {
  if (!(mode === "simple" || mode === "fluency" || mode === "creative")) return body;
  const m = body.match(/^The (?<obj>[^,.!?;]+?) was (?<verb>[a-z]+ed) by (?<agent>[^,.!?;]+)$/u);
  if (!m?.groups) return body;
  const { obj, verb, agent } = m.groups;
  if (/\d/.test(obj) || /\d/.test(agent)) return body;
  const agentClean = agent.charAt(0).toUpperCase() + agent.slice(1);
  return `${agentClean} ${verb} the ${obj}`;
}

const SPECIFIED_HEADS = /^(the|a|an|our|their|this|these|our)\s/iu;

/** Attribution framing: "The study notes that Y" becomes "According to the study, Y". */
function reframe(body: string, mode: ParaphraseMode): string {
  if (mode === "standard") return body;
  const m = body.match(/^(?<who>[A-Z][^.!?]{1,48}?)\s+(?<verb>notes?|says?|states?|argues?|explains?|points out)\s+that\s+(?<rest>[a-z][^!?]*)$/u);
  if (!m?.groups) return body;
  const who = m.groups.who.trim();
  // Only reframe when the actor is a specified party, so bare pronouns and quantifiers stay put.
  if (!SPECIFIED_HEADS.test(who)) return body;
  return `According to ${who.charAt(0).toLowerCase() + who.slice(1)}, ${m.groups.rest.trim()}`;
}

function transformSentence(body: string, mode: ParaphraseMode, density: number, draw: () => number): string {
  if (body.trim().length === 0) return body;
  let out = applyPhrases(body, mode, draw);
  out = adjustContractions(out, mode);
  out = reorderClauses(out, mode);
  out = reframe(out, mode);
  out = applyWords(out, mode, density, draw);
  out = dropWeeds(out, mode);
  out = devoice(out, mode);
  out = addHedges(out, mode, draw);
  return out;
}

/** Longest-common-subsequence length over lowercased token streams. */
export function lcsLength(a: string[], b: string[]) {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[b.length];
}

export function countChangedTokens(input: string, output: string) {
  const a = tokenize(input).map((t) => t.toLowerCase());
  const b = tokenize(output).map((t) => t.toLowerCase());
  return a.length - lcsLength(a, b);
}

export function paraphrase(text: string, options: ParaphraseOptions): ParaphraseResult {
  const mode: ParaphraseMode = options.mode ?? "standard";
  const rawLevel = Number.isFinite(options.synonymLevel) ? options.synonymLevel : 0.6;
  const density = clamp(rawLevel <= 0 ? 0.6 : rawLevel > 1 ? rawLevel / 100 : rawLevel, 0.05, 1);
  const draw = seededRandom(`${mode}|${density}|${options.variant ?? 0}|${text}`);

  const spans = splitSentences(text);
  const pieces: { start: number; end: number; replacement: string }[] = [];
  for (const span of spans) {
    const term = span.text.match(/[.!?]+["'”’)\]]*$/u)?.[0] ?? "";
    const body = term ? span.text.slice(0, span.text.length - term.length) : span.text;
    const transformed = transformSentence(body, mode, density, draw);
    if (!term) {
      pieces.push({ start: span.start, end: span.end, replacement: transformed });
      continue;
    }
    const trimmed = transformed.replace(/\s+$/, "");
    const endsWithTerm = /[.!?]$/.test(trimmed);
    pieces.push({
      start: span.start,
      end: span.end,
      replacement: endsWithTerm ? trimmed : `${trimmed}${term}`,
    });
  }

  let output = text;
  for (let i = pieces.length - 1; i >= 0; i -= 1) {
    const piece = pieces[i];
    output = output.slice(0, piece.start) + piece.replacement + output.slice(piece.end);
  }

  const inTokens = tokenize(text).map((t) => t.toLowerCase());
  const outTokens = tokenize(output).map((t) => t.toLowerCase());
  const shared = lcsLength(inTokens, outTokens);
  const similarity = inTokens.length === 0 ? 1 : Math.round((shared / Math.max(inTokens.length, outTokens.length)) * 1000) / 1000;

  return {
    output,
    changedWords: inTokens.length - shared,
    similarity,
    mode,
  };
}

export const PARAPHRASE_MODES: { id: ParaphraseMode; label: string; note: string }[] = [
  { id: "standard", label: "Standard", note: "Balanced wording changes that keep your structure." },
  { id: "fluency", label: "Fluency", note: "Smoother, more natural connectors and phrasing." },
  { id: "formal", label: "Formal", note: "Expanded forms and a more elevated register." },
  { id: "academic", label: "Academic", note: "Hedged, precise, citation-friendly wording." },
  { id: "simple", label: "Simple", note: "Shorter words and fewer decorations." },
  { id: "creative", label: "Creative", note: "More adventurous vocabulary and reframing." },
  { id: "professional", label: "Professional", note: "Direct, business-ready phrasing." },
];
