export interface LegalSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface LegalDocument {
  slug: string;
  kind: "Policy" | "Terms" | "Trust";
  title: string;
  summary: string;
  updatedOn: string;
  sections: LegalSection[];
  footnote: string;
}

const privacy: LegalDocument = {
  slug: "privacy",
  kind: "Policy",
  title: "Privacy Policy",
  summary:
    "How VeriWrite handles the text you paste, the documents you upload and the preferences you save: what leaves your browser, what stays in it, and for how long.",
  updatedOn: "22 September 2026",
  sections: [
    {
      heading: "Analysis runs on your device by default",
      paragraphs: [
        "VeriWrite keeps your writing local unless you ask otherwise. With no backend configured, every tool, detection, paraphrasing, grammar and summarizing alike, runs in your browser against the bundled engine, and the text you are working on goes nowhere else.",
        "When a backend is configured, the text you ask a tool to process is transmitted there, processed and returned. Where the two paths differ on retention, subprocessors or your rights, this page says so instead of describing one product as though it were the other.",
      ],
    },
    {
      heading: "What is processed to run an analysis",
      paragraphs: [
        "To produce a report we need the text itself. Everything else is derived from it or is a record of the run, stored beside the result so a number can be traced back to the settings that produced it.",
        "If you upload a file rather than pasting text, we accept TXT, DOCX and PDF. Each upload is checked against the allowed types and a size limit before it is parsed, and the extracted plain text is what the tools operate on.",
      ],
      list: [
        "Text you type or paste, and plain text extracted from an upload",
        "Derived measurements: boundaries, word counts, readability and rhythm statistics",
        "Detection output: probabilities, classifications, confidence and the signals that fired",
        "Run metadata: tool, engine identifier and version, timestamp, processing time",
        "Account data if you create one: name, email address, plan, usage counters",
      ],
    },
    {
      heading: "What stays in your browser",
      paragraphs: [
        "Local state is stored in localStorage under keys that all begin with the prefix vw., so the entries are named vw.theme, vw.documents, vw.history and vw.preferences. The prefix stops a shared origin from colliding with another application, and it makes clearing VeriWrite data auditable.",
        "If storage is unavailable, through private browsing, a disabled setting or a quota exhausted by a very large document, the app holds that state in memory for the session only. Nothing is queued to be written later.",
      ],
      list: [
        "vw.theme and vw.sidebar: interface choices",
        "vw.preferences: display options and the two privacy switches below",
        "vw.documents and vw.folders: saved drafts and their organization",
        "vw.history: past analyses, each holding its result so an entry reopens with no network",
        "vw.usage and vw.session: quota counters and your current session",
      ],
    },
    {
      heading: "Retention",
      paragraphs: [
        "Free-plan history is kept for 30 days, and Pro and Team remove that cap. Saved documents stay until you delete them, and an analysis stored with a history entry goes when the entry goes. On a deployment with a backend, retention is enforced there on the same rules and your browser copy is a cache of it.",
        "Deleting content removes it from the working store promptly; copies linger in backups and fall out on the rotation schedule rather than on the minute. Shared report links stay reachable until they are revoked, so review which are active before circulating an analysis widely.",
      ],
    },
    {
      heading: "Two switches that are yours",
      paragraphs: [
        "Settings holds two privacy switches and both do what their labels say. storeDocuments controls whether your text and results are saved at all; with it off, analyses still run and you can still export the output, but no copy of your text is retained. It is on by default because most people want their history.",
        "improveModels is off by default and nothing about the product is worse for leaving it off. Turning it on opts your future analyses into the pool used to evaluate and tune engines; material collected earlier is not swept in. No data flows sit behind these two settings.",
      ],
    },
    {
      heading: "The plagiarism checker in this build",
      paragraphs: [
        "The originality scanner compares your text against a bundled reference corpus, not against the live web, and the interface says so on every match result. A scan that finds nothing is not evidence that a passage is unique; it is evidence that nothing matched the sources that were searched.",
        "Because the comparison happens inside the product, this feature does not submit your text to external search indices or to third-party paper repositories. If a future version queries outside sources, that change appears here before it ships, with what is sent and to whom.",
      ],
    },
    {
      heading: "Service providers and subprocessors",
      paragraphs: [
        "A hosted deployment of VeriWrite depends on a few other companies to exist: somewhere to run servers, something to handle card payments, something to deliver transactional email, and, where analysis is routed onward, a provider that serves those requests. We describe the roles generically because the vendor list is a deployment detail.",
        "Each provider acts on our instructions under a written agreement and receives the minimum it needs to do its job. We do not sell personal data and we do not share it for advertising.",
      ],
      list: [
        "Hosting and delivery: running the application and serving its files",
        "Payment processing: cards and invoices; we do not see full card numbers",
        "Email delivery: receipts and the quota alerts you asked for",
        "Model or API providers, where a deployment uses one",
        "Logging and abuse prevention, which records request metadata",
      ],
    },
    {
      heading: "Your rights and how to use them",
      paragraphs: [
        "You can ask what we hold about you, take a portable copy, correct anything inaccurate, and ask us to delete your content and close your account. Where your local law adds rights such as objection or restriction, we do not condition them on a payment or on more identification than confirming the request belongs to the account.",
        "Most of this is quicker in the app. Settings clears local data, the workspace deletes documents and history, and Account handles export and closure. For anything the interface does not cover, open a request from the Help Center; a request about somebody else's document needs that person involved first, and a complaint to a supervisory authority remains available wherever the law gives you one.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        "VeriWrite is built for students, editors, publishers and professionals, and is not directed at children. An account holder must be old enough to accept the Terms where they live; on institutional plans, the organization administering the account is responsible for who uses it.",
        "We do not knowingly collect personal data from children below the age floor that applies to them; where an institution uses the product with younger students, that installation should run with storeDocuments restricted. If you believe a child has given us personal data, tell us through the Help Center and we will remove it.",
      ],
    },
    {
      heading: "If something goes wrong",
      paragraphs: [
        "No policy makes a breach impossible, so here is what happens if we have one. We investigate and contain first, then notify the people affected and any customer or authority who needs to know, without waiting for the picture to be complete: what was involved, when it happened, and what you should do next.",
        "Administrators of hosted deployments are told as well, and an incident affecting availability rather than confidentiality is published first on the status page reachable from Help. Security reports from outside the product are welcome through the Help Center, and we do not treat good-faith research as an attack.",
      ],
    },
  ],
  footnote:
    "This policy describes VeriWrite as currently shipped. If you use a deployment run by your employer, school or another organization, that organization's policies also apply to what it does with your content, and its administrator may hold capabilities this page does not describe. Material changes get a dated revision here and, where they narrow what we collect or how long we keep it, a note in the app.",
};

const terms: LegalDocument = {
  slug: "terms",
  kind: "Terms",
  title: "Terms of Service",
  summary:
    "The agreement between you and VeriWrite: what you may use the tools for, what a detection score is allowed to decide, and who owns what.",
  updatedOn: "22 September 2026",
  sections: [
    {
      heading: "Accepting these terms",
      paragraphs: [
        "These terms are the contract for using VeriWrite. By running an analysis, saving a document, sharing a report or paying for a plan, you agree to them.",
        "On an institutional account they bind you and the organization that provisioned your seat, and its own rules come first wherever the two overlap. If you cannot agree, stop using the product and close your account.",
      ],
    },
    {
      heading: "Your license to use VeriWrite",
      paragraphs: [
        "We grant a personal, non-exclusive, non-transferable, revocable license to use the tools for your own writing and for work you are authorized to do. That covers using the output: reading a report, exporting it, quoting it in your own material, and publishing analysis you have reviewed.",
        "It does not cover reselling raw access, exposing our detectors as your own service, reverse engineering the bundled engine to game it, scraping the product, or presenting VeriWrite scores as certified proof of authorship. To build something commercial on our output, talk to us through the Help Center first.",
      ],
    },
    {
      heading: "You keep your content",
      paragraphs: [
        "The text you paste, upload or write stays yours, and nothing here takes that. We take only the permission needed to run the product: hosting what you ask us to save, transmitting it to a backend where the deployment uses one, converting a file into plain text, computing metrics and keeping a copy in history.",
        "That license ends when you delete the content, except that copies linger briefly in backups and that reports you already shared stay visible until the link is revoked. You are responsible for having the right to submit whatever you process, including other people's writing.",
      ],
    },
    {
      heading: "Plans, quotas and rate limits",
      paragraphs: [
        "VeriWrite sells three plans, Free, Pro and Team, each defined by quota rather than by gating accuracy behind a price. The pricing page table is authoritative.",
        "Counters reset monthly on your billing cycle and unused allowance does not roll over. Reaching a limit stops that tool rather than truncating an analysis halfway, and tells you which limit you hit and when it resets.",
        "Rate limits apply on every plan so the product stays responsive for everyone. Bulk submission loops, attempts to probe the engine for its thresholds and credential abuse against sign-in are throttled or blocked while they run. A single analysis needs at least 15 words and takes no more than 100,000.",
      ],
      list: [
        "Free: 20 analyses and 5,000 words a month, 10 saved documents, 30 days of history",
        "Pro: 500 analyses and 250,000 words, 2,000 paraphrasing runs, 100 plagiarism scans",
        "Team: 2,500 analyses and 1,000,000 words a month, shared folders, admin controls",
        "Seats: one on Free and Pro, five or more on Team; a seat is a person, not a device",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: [
        "You agree not to use VeriWrite to cause harm or to break the law. The list below is not exhaustive; the test we apply is whether a use is one that a person whose writing we are analyzing would recognize as fair.",
        "Where we see a use on this list we may throttle, suspend or end the account involved, and we may report criminal conduct to the appropriate authority. Except where notice would expose other users to continued harm, we tell you what we saw and why.",
      ],
      list: [
        "Unlawful, fraudulent or harassing activity, including preparing it with our tools",
        "Processing documents you have no right to hold, such as private correspondence",
        "Publishing a report about someone's writing without their knowledge, outside a duty you hold",
        "Trying to identify, contact or embarrass a person on the strength of a score",
        "Uploading malicious files or evading limits with extra accounts",
        "Mass-producing text with our writing tools to deceive a reader or a platform",
      ],
    },
    {
      heading: "Do not use detection output to decide anything about a person",
      paragraphs: [
        "This is the most important clause in these terms. VeriWrite's output is an estimate about a text, and it must never be the basis for a consequential determination about a person: any decision affecting their rights, education, livelihood or freedom.",
        "The reasons are on the AI Detection Limitations page and are not technicalities: accuracy depends on length, language and genre, careful human writing is flagged routinely, and polished machine writing passes often.",
        "You may use a report as one input in a process where a human reads the work and hears from the writer. If you use VeriWrite in a review process, you agree to tell the person affected that a detector was used, to show them the result with its confidence, and to give them a route to challenge the outcome.",
      ],
      list: [
        "Admissions, enrollment and academic standing, including misconduct findings and sanctions",
        "Employment: hiring, promotion, contract award, review and termination",
        "Legal or quasi-legal outcomes: evidence, filings, immigration, insurance, benefits",
        "Professional licensing, certification and disciplinary proceedings",
        "Any action restricting access to a service or opportunity because of a score",
      ],
    },
    {
      heading: "No guarantee of accuracy",
      paragraphs: [
        "Detection and originality results are best-effort estimates. We do not warrant that a score reflects how a document was written, that it will agree with another tool, or that any document will yield a usable result at all. Short, non-English, heavily edited or list-like text can produce output we would not defend.",
        "The writing tools are the same: paraphrasing, summarizing, translating and grammar suggestions change meaning in ways you must check before submitting anything you did not review word by word. Every report records which engine and version produced it, and a rerun may differ.",
        "The plagiarism scanner in this build compares against a bundled reference corpus rather than the live web, so a clean scan is not proof of originality.",
      ],
    },
    {
      heading: "Disclaimers and the limits of our liability",
      paragraphs: [
        "The product is provided as it is, without warranties as to fitness, availability, accuracy or outcome, and your statutory rights in your jurisdiction are unaffected by that sentence. To the fullest extent the law allows, we are not liable for indirect, incidental, special or consequential losses, or for lost profits, lost data or goodwill.",
        "Our total liability for anything arising from your use of VeriWrite is capped at the fees you paid in the twelve months before the event that gave rise to the claim, and at zero on a free account. Those caps do not apply to liability that cannot lawfully be limited.",
      ],
    },
    {
      heading: "Suspension, termination and changes",
      paragraphs: [
        "You can stop using VeriWrite at any time and close your account from Account. Export your documents and reports first: closure removes your copies on the retention schedule in the Privacy Policy, and we cannot reconstruct deleted work afterward.",
        "We may suspend or end an account that breaches these terms, threatens other users or the service, or has gone unpaid; outside serious abuse or non-payment we give notice and a chance to fix the problem.",
        "We may change these terms as the product changes. Material changes, and any change to the clause on consequential determinations, are announced in the app before they take effect.",
      ],
    },
  ],
  footnote:
    "These terms describe a commercial product and are not legal advice to you. Institutional customers can ask for an agreement written to match their procurement process through the Help Center; where a signed agreement exists between you and VeriWrite, that document prevails over this page. Read the clause on consequential determinations twice before you build a workflow on top of a score.",
};

const cookies: LegalDocument = {
  slug: "cookies",
  kind: "Policy",
  title: "Cookie Policy",
  summary:
    "The storage technologies VeriWrite uses in your browser, how long each entry lives, and why most of what makes the interface yours is not a cookie at all.",
  updatedOn: "22 September 2026",
  sections: [
    {
      heading: "What this policy covers",
      paragraphs: [
        "This page describes the small storage technologies VeriWrite uses in your browser: cookies, and the localStorage entries that do most of the work in this product. It is written for a reader who wants to know what gets stored, for how long, and whether it can be turned off without losing the application.",
        "The short answer is that VeriWrite sets very little. There are no advertising cookies, no social plug-ins and no cross-site trackers in this build, and the state that customizes the interface lives on your own device under names you can read.",
      ],
    },
    {
      heading: "Strictly necessary cookies",
      paragraphs: [
        "On a deployment with accounts and a backend, a handful of cookies have to exist for the product to function. They are set when you sign in or start work that needs a server, they are first-party, and they are used for nothing beyond keeping that session intact.",
        "Blocking them does not make the app quieter; it makes the signed-in features stop working, because the request that fetches your history no longer knows who it came from. Since they serve no marketing purpose, most privacy frameworks place them outside the consent requirement.",
      ],
      list: [
        "Session identifier: keeps you signed in, and ends when you sign out or close the browser",
        "Security and request-integrity values: protect forms and the upload endpoint from cross-site requests",
        "Load-balancing affinity, where a deployment uses it: routes requests to the server holding your analysis",
      ],
    },
    {
      heading: "Preferences live in localStorage, not cookies",
      paragraphs: [
        "The choices that customize the interface never touch the cookie jar. Theme, sidebar state, display density, reduced motion and which parts of a report you want shown are stored in localStorage under keys prefixed vw.: your browser writes them, your browser reads them, and they are not attached to requests to a server.",
        "The theme deserves a note because from the outside it behaves like a cookie. A short script in the page head reads vw.theme before the interface paints, so dark mode does not flash white on first load. That read is local and adds nothing to what leaves your machine.",
      ],
    },
    {
      heading: "Measurement and analytics",
      paragraphs: [
        "This build ships no third-party analytics. Where a deployment enables usage measurement, it is first-party and aggregate, counting things like which tools were opened and which quota was reached rather than recording what you analyzed, and analysis text is never part of it.",
        "Your local quota counters sit in vw.usage so the app can warn you before a limit arrives. If a future release adds a measurement or error-reporting service, it appears here with its purpose and lifetime, bound by the no-advertising rule below.",
      ],
    },
    {
      heading: "How long entries persist",
      paragraphs: [
        "Cookie lifetimes and localStorage lifetimes are different mechanisms with the same practical answer: they last until something clears them. Session cookies end when the browser closes; local entries end when you delete them in the app, when you clear site data for VeriWrite, or when the quota forces them out, in which case the app falls back to memory rather than discarding them quietly.",
        "Local storage is scoped to a browser profile, so signing in on a laptop does not pull your locally saved documents onto your phone. That is a consequence of local-first design rather than a gap we plan to close by copying your files to a server.",
      ],
      list: [
        "Session cookies: until you sign out or close the browser",
        "Security cookies: the shorter of the session and the lifetime the deployment sets",
        "vw.theme, vw.sidebar and vw.preferences: indefinitely, on that browser profile only",
        "vw.documents, vw.folders and vw.history: until you delete them; Free history expires after 30 days",
        "vw.usage and vw.session: until the monthly reset or the session ends",
      ],
    },
    {
      heading: "No advertising trackers in this build",
      paragraphs: [
        "VeriWrite sets no advertising cookies, loads no ad networks, embeds no social media widgets, and does not fingerprint your browser to recognize you on other sites. We sell a subscription, which means we have no reason to build a profile of you to sell to somebody else.",
        "We do not sell or share personal data for advertising, and we let no third party place scripts on the application's pages. Where a step genuinely requires an external service, such as a hosted payment checkout, it happens on that provider's page under that provider's policy and is named in the Privacy Policy rather than smuggled in as a pixel.",
      ],
    },
    {
      heading: "Managing your choices",
      paragraphs: [
        "You have three working levers. Your browser controls cookies and site data for the whole origin, and blocking everything still leaves you able to run local analyses while signed-in features become unavailable. Settings can reset your preferences, and the app offers one action that clears every vw.-prefixed key it owns, which removes saved documents and local history too.",
        "That action cannot be undone, and it does not touch anything a backend holds for your account; server-side copies follow the retention rules in the Privacy Policy. Export from the workspace first if there is anything you want to keep.",
      ],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "If this page begins to describe a cookie or tracker that is not here today, the change is real and we will have said so here first, with a date. Additions that require consent get a prompt in the interface, not a quiet edit to a footer link.",
        "Questions about a particular entry, what it is for and why the app needs it, belong in the Help Center. We would rather answer one than have you guess from a name in a settings panel.",
      ],
    },
  ],
  footnote:
    "VeriWrite's storage choices are auditable by design: keys carry a prefix so you can list them, and the analysis pipeline is local so you can watch the network tab stay quiet while it runs. This page is the description; your browser's developer tools are the verification.",
};

const responsibleAi: LegalDocument = {
  slug: "responsible-ai",
  kind: "Trust",
  title: "Responsible AI",
  summary:
    "What VeriWrite's detector claims, what it refuses to claim, how we test a change before shipping it, and the weaknesses we publish rather than hide.",
  updatedOn: "22 September 2026",
  sections: [
    {
      heading: "Our position in two paragraphs",
      paragraphs: [
        "VeriWrite exists to help a reader understand a piece of writing, not to hand them a verdict. Every number in the product is an estimate with a confidence level attached, every signal is an observation about the text in front of the detector, and no output is proof of who typed something or of why.",
        "That is a product decision rather than a legal hedge. We could show one red percentage and call it done; the interface would feel more certain and be much less true. What you get instead is the evidence, the sentences it came from, and the engine and version that produced it.",
      ],
    },
    {
      heading: "What the model layer claims",
      paragraphs: [
        "The bundled engine reads a document, splits it into sentences, measures statistical properties of the prose, and reports how strongly those properties resemble patterns we associate with machine-generated writing. Its evidence is surface evidence: rhythm, vocabulary spread, connective tissue, structural repetition.",
        "The line between what it says and what people hear from it is the thing we are most careful about, so here it is written down.",
      ],
      list: [
        "It claims only that this text carries signals more common in machine-written than in human-written reference material",
        "It does not claim to identify which model, if any, produced a document",
        "It does not detect watermarks, metadata or provenance of any kind",
        "It does not measure intent, authorship or honesty",
        "It cannot tell you whether a particular person wrote a particular sentence",
      ],
    },
    {
      heading: "Why short texts score worse",
      paragraphs: [
        "A detector needs evidence, and two sentences provide almost none. A document at the fifteen-word minimum we accept can produce a figure that is arithmetically valid and analytically empty. Confidence comes from how much text there is, how consistently its sentences point the same way, and how far the result sits from the middle of the scale.",
        "Short passages also sit near the boundary between classifications, where one edited sentence can flip the label. So analyze at least a few hundred words, and treat anything shorter as a reason to read the text rather than to act on the score.",
      ],
    },
    {
      heading: "Why non-English texts score worse",
      paragraphs: [
        "VeriWrite accepts thirteen languages for analysis and the results are not equally good in all of them. Several of the clearest cues the engine uses, contraction rates, first-person markers, common connectives and hedge words, were assembled from English, and other languages either have no equivalent list or a thinner one.",
        "Segmentation is a second fault line: sentence boundaries in Chinese, Japanese and Thai are not marked by spaces and full stops the way they are in English, and scripts that run right to left or punctuate differently get read with less precision. For many non-English documents confidence is therefore low, and that is stated in the report rather than hidden.",
        "If you work mainly in one of these languages, tell us which through the Help Center; language coverage is where user reports move our roadmap fastest.",
      ],
    },
    {
      heading: "Language and genre bias",
      paragraphs: [
        "Any detector that encodes an idea of what formal writing looks like will punish writers who fit that mold. Edited prose, published journalism, legal drafting, scientific methods sections and writing by non-native English speakers all trend toward even sentences, cautious hedging and standard connectives, which are exactly the patterns a statistical detector reads as machine-like.",
        "This is a fairness problem before it is an accuracy problem. A careful academic and a language model can produce structurally similar paragraphs, and a tool that cannot separate them must not sit where that difference decides something about a person.",
      ],
    },
    {
      heading: "What we publish about the local engine",
      paragraphs: [
        "The engine that ships in the browser today is a weighted heuristic, not a trained neural classifier. It is transparent, in that the signals it reports are the signals it uses, and it is considerably weaker than a well-trained model. We would rather describe where it fails than have you find out during a review.",
        "Each of the following is a known failure mode rather than a hypothetical one.",
      ],
      list: [
        "Uniform human prose: evenly paced formal writing is flagged often, with false confidence",
        "Non-English text: English-tuned cues underfire or misfire and confidence drops",
        "Heavily edited text: two or three human passes erase most of what the engine keys on",
        "List-like technical writing: parallel structures and repeated openings trip the structural signals",
        "Fragments and quoted matter: fragments are pinned mid-scale, dragging mixed documents with them",
        "Boundary sensitivity: results near a cutoff move under small unintended edits",
      ],
    },
    {
      heading: "No automatic accusations",
      paragraphs: [
        "The product never says cheating, fraud or plagiarized. Signal explanations describe what was observed rather than who is at fault, and confidence display is on by default so a person being assessed cannot have the uncertainty stripped from their own report.",
        "We also do not score in secret: analyses happen when somebody asks for one, and there is no background queue grading saved documents, no ranking of users by AI probability, and no score attached to an account. Because reports are shareable by link, the disclaimer travels with the report instead of living on a page nobody opens.",
      ],
    },
    {
      heading: "A human has to decide",
      paragraphs: [
        "Every workflow we support ends with a person reading the writing. Where an institution uses VeriWrite in a review process, the minimum that makes the process defensible is: a human reads the document, the writer is shown the result and its confidence, they get a genuine chance to respond, and someone who did not make the first call can reverse it.",
        "Detection output may raise a question; it may not be the reason a question gets answered. Our Terms prohibit consequential determinations about people, and we hold that line by refusing to build the features that would make it easy: no bulk auto-flagging, no automated sanction workflow, no red-and-green pass-or-fail mode.",
      ],
    },
    {
      heading: "How we evaluate a change",
      paragraphs: [
        "Engines are versioned and evaluated before they ship. A candidate runs against a fixed corpus of human writing, machine writing, machine writing edited by hand and translations of the same documents, and we look at false positives on human text first because that is the failure that hurts somebody.",
        "A version that regresses on any measure below does not become the default, and a change to how the four classifications are derived is treated as a new engine rather than a patch. We publish no single accuracy figure, because a number computed on a corpus we chose would mean very little; the weaknesses above are the honest form of the same information.",
      ],
      list: [
        "False-positive rate on human writing, by language and by genre",
        "Detection rate on machine text at comparable confidence, so caution is not mistaken for accuracy",
        "Stability across reruns of the same document and across engine versions",
        "Short-document behavior, so we know where the tool stops being useful",
        "Regression review of every threshold change before it becomes the default",
      ],
    },
  ],
  footnote:
    "Responsible AI in this product means constraints we accept because they are true rather than badges we display because they are popular. This page is reviewed whenever an engine changes. If you find a document where VeriWrite is confidently wrong, send it through the Help Center with the analysis identifier and engine version from the report, and it becomes material for the evaluation set described above.",
};

const aiDetectionLimitations: LegalDocument = {
  slug: "ai-detection-limitations",
  kind: "Trust",
  title: "AI Detection Limitations",
  summary:
    "Why a detection score is an estimate about a text and never proof about a person: the mechanisms behind false positives and false negatives, and everything else that moves the number.",
  updatedOn: "22 September 2026",
  sections: [
    {
      heading: "What a score measures, and what confidence adds",
      paragraphs: [
        "VeriWrite reports a probability between 0 and 100 that a passage carries statistical patterns we associate with machine-generated writing. It is not the percentage of the document a machine wrote, not a measure of how much help the author had, and not a statement about the author.",
        "The number comes from measurable properties of the prose: how evenly sentence lengths fall, how often connectives and parallel openings recur, how much the vocabulary repeats, how present contractions and first-person markers are. Nothing in that chain looks up who wrote what.",
        "Confidence, the other half of the result, is shown as low, moderate, high or very high. It rises with length and with agreement between sentences and falls near a classification boundary.",
      ],
    },
    {
      heading: "The four classifications, and why they are not two",
      paragraphs: [
        "VeriWrite refuses a binary. Each document is split into four buckets that sum to one hundred percent of the words analyzed, and the label is chosen only when the distribution and the probability agree.",
        "The buckets are word-weighted, so read the breakdown before you read the label.",
      ],
      list: [
        "AI-generated: most of the words sit at the top of the scale",
        "AI-generated & AI-refined: machine-leaning text a person has revised",
        "Human-written & AI-refined: mostly human prose with machine-assisted passages inside it",
        "Human-written: the majority of words sit low, with no strong machine-leaning share",
      ],
    },
    {
      heading: "AI assistance is a category, not a verdict",
      paragraphs: [
        "The two middle classes are not approximations of a true answer; for most documents people submit, they are the answer. A writer who drafts by hand and then has a model tighten three paragraphs has produced a genuinely mixed artifact, and a detector that reports only human or AI is lying with better formatting.",
        "Institutions want a bright line, and the honest response is that the line sits in the text rather than in the tool. A workable policy names permitted assistance, treats the mixed categories as normal, and asks whether the writer can explain and reproduce their own work.",
      ],
    },
    {
      heading: "False positives: why careful human writing gets flagged",
      paragraphs: [
        "A false positive is a human-written text scored as machine-like, and the mechanism is simple. The features that push a score upward are the features of orderly prose: even sentence lengths, standard transitions, parallel openings, cautious hedging, an impersonal register. Writers produce those deliberately when the situation rewards them.",
        "The result is a bias against discipline rather than against machines, and none of the following involves a language model.",
      ],
      list: [
        "Formal, evenly paced prose, including writing under timed exam conditions",
        "Technical and procedural documentation, where parallel structure is the point",
        "Translated text, which carries the flatness of translation into the score",
        "Academic prose by non-native speakers trained toward standard formulas",
        "Human work a copy editor smoothed, removing the marks of a person",
      ],
    },
    {
      heading: "False negatives: why edited machine writing passes",
      paragraphs: [
        "A false negative is machine-generated text scored as human, and it is the more common failure than users expect. The engine's evidence is on the surface, so a pass that changes the surface changes the verdict: break up two sentences, delete the connectives, add a contraction, and measured rhythm moves with the edit.",
        "A model told to sound less formal has the same effect at scale, which is why no detector in this class can rank evasion by seriousness. Ten minutes of human revision looks, to this engine, like ten hours of human drafting.",
      ],
      list: [
        "Machine text revised by a person for rhythm, concreteness or voice",
        "Output from a model already tuned to avoid the flagged patterns",
        "A short excerpt, where the surrounding evidence is gone",
        "Mixed documents where one human section drags the aggregate below the line",
      ],
    },
    {
      heading: "Why paraphrasing shifts the score",
      paragraphs: [
        "Paraphrasing is the strongest single lever on a result. Because the detector measures realized properties such as word choice, sentence length distribution and connective density, replacing those properties replaces the evidence: a synonym-level rewrite moves vocabulary cues, a structural rewrite moves lengths and openings.",
        "Both change the number far more than the origin of the text has changed. Paraphrasing your own draft with our tools can lower your score, and the score afterward measures the text as it now stands.",
      ],
    },
    {
      heading: "Length, language and genre effects",
      paragraphs: [
        "Three properties of the document move scores more than any setting. Length drives confidence: at fifteen words the output is noise, and a few hundred words is where it becomes arguable. Language drives coverage, since the lexical cues are strongest in English. Genre drives everything, because formal registers look machine-like to statistical methods as a class.",
        "Place a report beside documents of the same kind: a score for a translated press release says little about one for a personal essay, and comparing them is how confident conclusions get drawn from incomparable numbers.",
      ],
      list: [
        "Split long documents and analyze the parts, so a mixed file reports its mixture",
        "Compare only documents of similar length, language and register",
        "Check the inferred language on the report, and correct it when the guess is wrong",
        "Re-run after substantial edits rather than trusting a stale score",
      ],
    },
    {
      heading: "What a report should be used for",
      paragraphs: [
        "Reports are useful, and their usefulness is narrower than a headline percentage suggests. Each use below has a person reading the writing inside it.",
        "If a use you have in mind does not fit that shape, it probably belongs on the next list.",
      ],
      list: [
        "Showing a writer where prose is flat, repetitive or over-formulaic",
        "Pointing a revision pass at the passages that read as least distinctive",
        "Recording your originality position at a moment in time",
        "Giving a teacher or editor a starting point for a conversation",
        "Sharing one link so two people look at the same evidence",
      ],
    },
    {
      heading: "What a report must not decide",
      paragraphs: [
        "The same document cannot carry the weight of a judgment about a person. Restating our Terms, these are the misuses the output does not support.",
        "A report is evidence about style with a stated confidence attached. A decision needs a reader, an explanation from the author and a route of appeal.",
      ],
      list: [
        "Admissions, grades, employment, contracts or professional standing",
        "A finding of academic misconduct, or a substitute for hearing from the author",
        "Legal, insurance, immigration or benefits determinations",
        "A published accusation about a named person's writing",
        "Treating a clean plagiarism scan as proof of originality, since this build searches a bundled corpus",
        "Bulk auto-scoring, where nobody reads the documents that passed",
      ],
    },
    {
      heading: "If you disagree with a result",
      paragraphs: [
        "Disagreement is information, and the product is built so you can act on it instead of arguing with a number. Re-run on a longer excerpt with the same settings, check the engine version, and read the signal explanations against your own judgment.",
        "If you are the person being assessed and the score seems wrong, say so in writing to whoever ran it, and expect that response to shape the decision. If the result surprised you, the next step is to read the document, which is what the tool exists to prompt. Send either case to the Help Center with the analysis identifier and engine version.",
      ],
    },
  ],
  footnote:
    "Detection research moves quickly, and every tool in this category, ours included, is less accurate than its interface makes it feel. This page describes the limits of VeriWrite as shipped today; the engine name and version recorded on each report tell you which limits applied to a particular number.",
};

export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  privacy,
  terms,
  cookies,
  "responsible-ai": responsibleAi,
  "ai-detection-limitations": aiDetectionLimitations,
};
