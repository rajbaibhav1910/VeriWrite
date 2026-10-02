export type SampleKind = "ai_like" | "mixed" | "human_like";

export interface SampleDocument {
  id: string;
  title: string;
  kind: SampleKind;
  description: string;
  text: string;
}

export interface SampleParaphrasePair {
  id: string;
  title: string;
  source: string;
  target: string;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: "sample-remote-work",
    title: "The Future of Remote Work",
    kind: "ai_like",
    description: "Even cadence, stock transitions and formal filler — the shape the heuristic reads as machine-like.",
    text: `In today's world, remote work has become an essential component of modern business operations. Moreover, organizations increasingly recognize that flexibility enhances both employee satisfaction and productivity. It is important to note that this shift also presents significant challenges that require careful consideration. Consequently, companies must develop robust strategies to maintain cohesion across distributed teams.

Furthermore, technology plays a pivotal role in facilitating seamless collaboration among remote employees. Additionally, comprehensive communication frameworks ensure that stakeholders remain aligned and informed. Nevertheless, the absence of in-person interaction can hinder relationship building and shared culture. Therefore, leaders are encouraged to leverage digital tools alongside periodic in-person gatherings.

In conclusion, the evolution of remote work represents a holistic transformation of the contemporary workplace. Ultimately, businesses that embrace adaptive, well-structured approaches are best positioned to thrive. Overall, the available evidence suggests that a balanced model will define the next generation of professional environments.`,
  },
  {
    id: "sample-study-habits",
    title: "A Brief Guide to Effective Study Habits",
    kind: "ai_like",
    description: "Uniform sentence length, parallel openings and hedged academic phrasing throughout.",
    text: `When it comes to academic success, the quality of one's study habits matters far more than the quantity of hours spent. Moreover, consistent, structured revision has been shown to strengthen long-term retention considerably. It is important to note that passive re-reading, while common, is generally less effective than active recall.

Furthermore, establishing a dedicated environment facilitates focus and minimizes distraction. Additionally, breaking material into manageable sessions allows students to consolidate information more effectively. Nevertheless, it is equally essential to incorporate regular breaks, as sustained attention inevitably declines over extended periods. Therefore, a balanced schedule tends to produce the most reliable outcomes.

In conclusion, effective studying is best understood as a holistic practice that combines planning, active engagement and rest. Ultimately, students who adopt these comprehensive strategies position themselves for sustained achievement.`,
  },
  {
    id: "sample-bread",
    title: "Why I Started Baking Bread",
    kind: "human_like",
    description: "First person, contractions, ragged sentence lengths and concrete detail.",
    text: `I never planned to become a bread person. It started with a stubborn jar of starter on my counter, forgotten for a week, then revived out of pure guilt. Honestly, the first loaf was awful. All crumb, no flavor, the kind of thing you smile about and quietly throw away.

But something about the ritual hooked me. The warm dough under my hands. The way the whole kitchen smells like a bakery by six in the morning. I read everything I could find, watched far too many videos, and ruined maybe twenty loaves before one finally made me proud.

Now I bake most weekends. Some weeks it's perfect, most weeks it's just fine. And that's okay. Bread taught me that you don't need to be great at something to love doing it.`,
  },
  {
    id: "sample-ferry",
    title: "The Day the Ferry Broke Down",
    kind: "human_like",
    description: "Varied rhythm, colloquial asides and specific sensory detail rather than stock structure.",
    text: `The engine coughed twice and then gave up entirely, right in the middle of the channel. Passengers laughed at first, the nervous kind of laughing people do when the sea is cold and the shore feels very far away. Then nobody laughed.

I've thought about those ninety minutes a hundred times since. What we don't talk about, though, is the stranger who handed his sandwich to a kid who'd skipped lunch. Small stuff. It stuck with me anyway.

A rescue boat towed us in eventually. Nothing about that morning made sense, and yet I remember it more clearly than most of last year combined. Maybe that's what real memory actually is.`,
  },
  {
    id: "sample-office-move",
    title: "Note on the New Office",
    kind: "mixed",
    description: "A human voice with a couple of structurally formal, AI-leaning sentences dropped in.",
    text: `We're moving the whole team to the new floor next month, and honestly I have mixed feelings about it. The space is beautiful, all glass and light, and it's clearly designed to make a strong impression on visitors.

That said, some things worry me. The open layout means constant noise, and I do a great deal of my best thinking in quiet. Moreover, the new policy documents are written in a style that prioritizes professional presentation over practical clarity for employees. It is important to note that the shift also requires careful consideration of long-term outcomes.

I'll give it a fair chance, though. Change like that usually grows on you once the boxes are unpacked and the coffee machine stops being a complete mystery.`,
  },
];

/** Source/target pairs used to check paraphrase output against a reference. */
export const SAMPLE_PARAPHRASE_PAIRS: SampleParaphrasePair[] = [
  {
    id: "paraphrase-meeting",
    title: "A workplace update",
    source:
      "The meeting was cancelled because the manager was unavailable, so the team will reconvene next week to review the budget proposal.",
    target:
      "Our manager couldn't make it, so the meeting was called off; the group will pick the budget back up when they regroup next week.",
  },
  {
    id: "paraphrase-science",
    title: "A science explainer",
    source:
      "Photosynthesis is the process by which green plants convert sunlight, water and carbon dioxide into glucose and oxygen.",
    target:
      "Green plants use sunlight, water and carbon dioxide to make their own food, releasing oxygen as a byproduct — that process is called photosynthesis.",
  },
];

/** Deliberately contains grammar, spelling and agreement errors for the grammar tool demo. */
export const SAMPLE_GRAMMAR_TEXT = `Their going too the store later to, to buy the ingredients for they're birthday party. The dog don't like none of these new toys, its already chewed up two of them. She write much better then her brother do, and nobody can spell the differance correctly. Me and him was waiting outside when it started to rain, so we runned inside without our jackets.`;

/** A coherent informational source text for the summarizer demo. */
export const SAMPLE_SUMMARY_SOURCE = `Coral reefs are among the most diverse ecosystems on the planet, yet they cover less than one percent of the ocean floor. Built by tiny animals called polyps over thousands of years, reefs provide food, coastal protection and livelihoods for hundreds of millions of people.

The relationship that holds a reef together is fragile. Corals host microscopic algae that live inside their tissues and supply much of the coral's energy through photosynthesis. When water temperatures rise too far or last too long, the corals expel the algae, turn pale and can starve — an event known as bleaching.

Reefs recover if conditions improve quickly enough, but repeated bleaching leaves them too weakened to rebuild. Local threats such as overfishing, runoff and destructive fishing make recovery harder, while warming oceans set the broader limit. Reducing these local pressures does not cool the water, but it buys time, giving corals a better chance to survive between heatwaves and to recover their color, and their food supply, when the sea finally cools.`;

/** Stiff, template-like prose for the humanizer demo to rewrite into a natural voice. */export const SAMPLE_HUMANIZER_INPUT = `In today's rapidly evolving digital landscape, it is important to note that effective communication plays a pivotal role in organizational success. Moreover, leveraging comprehensive strategies can facilitate seamless collaboration among stakeholders. Furthermore, it is essential to foster a culture of continuous improvement in order to optimize outcomes. Overall, the utilization of robust frameworks ensures that businesses remain competitive in an ever-changing environment.`;

/**
 * Spanish prose for the translator. The text is a real translation input; what this
 * build can do to it offline is detect the language, not rewrite it in another one.
 */
export const SAMPLE_TRANSLATOR_INPUT = `El informe señala que los precios de la energía volvieron a subir durante el último trimestre, y que muchas pequeñas empresas no pudieron pagarlos.
La comisión dijo que publicará los datos antes del viernes, pero que la decisión final depende de lo que apruebe el parlamento la próxima semana.
Los consumidores piden desde hace meses una explicación clara de por qué la factura cambia tanto de un mes a otro, y hasta ahora nadie se la ha dado.`;

