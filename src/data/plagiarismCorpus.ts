/**
 * Offline corpus for the plagiarism tool.
 *
 * This is NOT the web. It is ten short passages written for this demo so the
 * matching algorithm has something real to run against and the UI can show
 * honest evidence. Every entry is `demo: true` and every URL points at the
 * reserved `example.com` namespace, so no link can resolve to a real publisher.
 * A deployment that buys a real similarity index replaces this file with a
 * backend call; nothing else in the pipeline has to change.
 */

export interface CorpusEntry {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  /** The full text the matcher compares against. */
  text: string;
  /** Short display quote used in the source card. */
  snippet: string;
  demo: true;
}

export const PLAGIARISM_DEMO_NOTICE =
  "Demo corpus: these results compare your text against ten passages written for this offline build, not against the internet. A 0% match here does not mean a passage is original in the wider world, and no source outside this file has been checked. Connect a similarity index to the API service to get a real scan.";

export const PLAGIARISM_CORPUS: CorpusEntry[] = [
  {
    id: "corpus_honeybee",
    title: "Colony collapse and the pollination economy",
    url: "https://example.org/research/colony-collapse-pollination",
    publisher: "Example Journal of Applied Ecology",
    publishedAt: "2023-04-11",
    text: "Commercial pollination depends almost entirely on a single managed insect, the western honeybee, and that concentration is a fragility disguised as an efficiency. When colony losses spike in winter, the cost is not absorbed by beekeepers alone. Almond, cherry and apple growers who rent hives by the trailer load find their input prices moving with hive mortality rather than with the price of honey. Researchers who have tracked the decline argue that no single cause explains it. Varroa mites, pesticide exposure, monoculture forage and the stress of long-distance transport act together, and the interaction between them is harder to treat than any one factor on its own.",
    snippet: "Commercial pollination depends almost entirely on a single managed insect, the western honeybee, and that concentration is a fragility disguised as an efficiency.",
    demo: true,
  },
  {
    id: "corpus_bridge",
    title: "Why old bridges fail quietly",
    url: "https://example.org/infrastructure/old-bridges-fail-quietly",
    publisher: "Example Review of Civil Engineering",
    publishedAt: "2022-09-30",
    text: "The dominant failure mode of a mid-century steel bridge is not overload but accumulation. A deck joint that leaks lets salt water reach the stringers below, and the corrosion it starts is invisible from the driving surface for a decade. Inspection regimes built around visual surveys systematically under-report this class of damage, because the member that matters is the one nobody can see without closing a lane. Cities that have switched to sensor-guided inspection report that the useful life of a structure is set less by its design load than by how quickly water is routed away from it.",
    snippet: "The dominant failure mode of a mid-century steel bridge is not overload but accumulation.",
    demo: true,
  },
  {
    id: "corpus_hiv",
    title: "Treatment as prevention: a decade of evidence",
    url: "https://example.org/health/treatment-as-prevention",
    publisher: "Example Bulletin of Public Health",
    publishedAt: "2021-02-18",
    text: "The finding that viral suppression prevents sexual transmission of HIV moved from a contested hypothesis to a settled one in roughly ten years of cohort follow-up. What surprised programme designers was the speed of the behavioural response. Once patients understood that an undetectable load meant an untransmittable virus, attendance at follow-up testing improved more than it had under any incentive scheme tried before it. Adherence interventions that led with the prevention message outperformed those that led with the individual health benefit, which is a reminder that people weigh social obligations at least as heavily as personal risk.",
    snippet: "The finding that viral suppression prevents sexual transmission of HIV moved from a contested hypothesis to a settled one.",
    demo: true,
  },
  {
    id: "corpus_literacy",
    title: "Third-grade reading gates and what they measure",
    url: "https://example.org/education/third-grade-reading-gates",
    publisher: "Example Education Quarterly",
    publishedAt: "2023-11-02",
    text: "Retention policies that hold students back until they pass a reading test tend to produce exactly the statistic they were designed to improve, and for a reason that should make administrators careful. The cohort that gets measured shrinks: the weakest readers are removed from the tested population rather than brought up to standard. Longitudinal follow-up in the states that adopted the earliest gates shows the initial gain in reported proficiency fading within four years, while the retained students show higher dropout rates than matched peers who were promoted with support.",
    snippet: "Retention policies that hold students back until they pass a reading test tend to produce exactly the statistic they were designed to improve.",
    demo: true,
  },
  {
    id: "corpus_power",
    title: "Duck curves and the value of storage",
    url: "https://example.org/energy/duck-curve-storage",
    publisher: "Example Energy Policy Notes",
    publishedAt: "2024-01-22",
    text: "As photovoltaic capacity grows faster than evening demand, the net load curve develops its characteristic midday trough, and the problem it creates is a timing problem rather than a volume problem. Grids with abundant cheap solar still pay premium prices at sunset because the ramp has to be met by dispatchable plant. Modelling of several high-penetration systems finds that four hours of storage removes most of the economic cost of the trough, while additional duration buys progressively less. The constraint that binds first is not battery chemistry but the absence of a market that pays for ramping.",
    snippet: "The problem it creates is a timing problem rather than a volume problem.",
    demo: true,
  },
  {
    id: "corpus_archive",
    title: "What digital preservation actually costs",
    url: "https://example.org/archives/what-preservation-costs",
    publisher: "Example Journal of Library Science",
    publishedAt: "2020-06-09",
    text: "Institutions that migrated paper collections to microfilm in the 1980s and then to born-digital files in the 2000s have, in most cases, preserved less than they began with. Format obsolescence transfers the cost of preservation from the storage medium to the reading device, and the reading device is nobody's budget line. The archives that have kept access open over three decades share one unglamorous habit: they budget for migration on a fixed cycle instead of waiting for a format to fail. Preservation, in practice, is a recurring operating expense dressed up as a one-off project.",
    snippet: "Format obsolescence transfers the cost of preservation from the storage medium to the reading device.",
    demo: true,
  },
  {
    id: "corpus_soil",
    title: "Tillage, carbon and the depth problem",
    url: "https://example.org/agriculture/tillage-carbon-depth",
    publisher: "Example Agronomy Report",
    publishedAt: "2022-05-27",
    text: "No-till farming is widely credited with sequestering soil carbon, and the credit is partly real but often overstated because of where the carbon ends up. Surface soils under long-term no-till accumulate organic matter, while subsoil horizons below the old plough pan frequently lose it, and studies that sample only the top thirty centimetres report the gain without the offset. When full-profile sampling is used, the net sequestration shrinks by half or more in many climates. The practical lesson for incentive schemes is that payment must follow the depth of measurement, not the convenience of it.",
    snippet: "Surface soils under long-term no-till accumulate organic matter, while subsoil horizons below the old plough pan frequently lose it.",
    demo: true,
  },
  {
    id: "corpus_jury",
    title: "Instruction comprehension in complex trials",
    url: "https://example.org/law/instruction-complex-trials",
    publisher: "Example Law Review",
    publishedAt: "2021-10-14",
    text: "Mock-juror experiments consistently find that the legal standard is understood less well than the courtroom assumes. Comprehension of a burden-of-proof instruction improves markedly when the wording is rewritten in plain language, but not when judges add verbal explanations of the existing formula, which suggests the barrier is the sentence structure rather than a failure of teaching. Rewritten instructions also reduce the spread of comprehension between jurors with different levels of formal education, which matters more for the reliability of a verdict than the average score does.",
    snippet: "Comprehension of a burden-of-proof instruction improves markedly when the wording is rewritten in plain language.",
    demo: true,
  },
  {
    id: "corpus_transit",
    title: "Induced demand and the four-point rule",
    url: "https://example.org/transit/induced-demand-four-point",
    publisher: "Example Transport Review",
    publishedAt: "2023-08-07",
    text: "The observation that road capacity added to a congested corridor tends to refill is robust across decades of measurement, and it holds for the most popular partial exception too. Converting a lane to transit use suppresses general-purpose traffic more reliably than widening does, because the induced-demand effect responds to the travel time of the fastest option rather than to the number of lanes. Cities that have run both strategies side by side report that bus priority delivers a third of the congestion relief of a lane removal at a fraction of the cost, and without the induced traffic that follows the widening.",
    snippet: "Road capacity added to a congested corridor tends to refill, and the effect responds to travel time rather than to lane count.",
    demo: true,
  },
  {
    id: "corpus_nurse",
    title: "Staffing ratios and the measurement of harm",
    url: "https://example.org/healthcare/staffing-ratio-harm",
    publisher: "Example Nursing Studies",
    publishedAt: "2024-03-19",
    text: "Studies linking nurse staffing levels to patient mortality face a standard identification problem: the wards that are short-staffed are also the wards that are sicker. The most credible designs exploit within-hospital variation in staffing that is unrelated to admission acuity, such as unplanned absence, and these designs still find a measurable effect on rescue failure after complications. The effect is concentrated in the outcome that hospital dashboards do not track well, which is not death recorded during the admission but death within thirty days of a complication that was not escalated.",
    snippet: "The most credible designs exploit within-hospital variation in staffing unrelated to admission acuity.",
    demo: true,
  },
];

export const CORPUS_TOPICS: string[] = PLAGIARISM_CORPUS.map((entry) => entry.title);

/**
 * A demonstration input, assembled on purpose so the matcher has something true to
 * report: two sentences copied word for word out of passages above, one sentence that
 * keeps most of the content words of another passage while changing the shape of it,
 * and the rest written for this file. Nothing here is quoted from a real publication.
 */
export const SAMPLE_PLAGIARISM_TEXT = `Pollination economics is a subject I keep returning to in my own notes. Commercial pollination depends almost entirely on a single managed insect, the western honeybee, and that concentration is a fragility disguised as an efficiency. The risk is shared, and it is shared by people who never think of themselves as beekeepers.

Older structures are usually assessed by driving across them. The dominant failure mode of a mid-century steel bridge is not overload but accumulation. Engineers I have worked with prefer to argue that maintenance budgets explain most of the difference in outcomes.

Rewritten court instructions are the example I would give a student. When a burden-of-proof instruction is rewritten in plain language, comprehension improves, and adding verbal explanations from judges does not do the same for the existing formula.

The figures behind these notes came from interviews conducted in the spring, and the arithmetic is my own.`;
