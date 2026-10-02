import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  lengthSeriesSummary,
  paragraphFlatNote,
  paragraphSeriesSummary,
  sentenceSeriesSummary,
  styleSeriesSummary,
  type Analytics,
  type ParagraphPoint,
  type SentencePoint,
  type StyleSlice,
} from "@/lib/detection/analytics";
import { useChartPalette } from "@/components/charts/chartTheme";
import { DETECTION_SCORE_LINES } from "@/lib/detection/model";
import { SIGNAL_KIND_LABEL } from "@/lib/detection/signals";
import {
  CLASSIFICATION_LABEL,
  DETECTION_DISCLAIMER_SHORT,
  formatNumber,
} from "@/lib/utils";
import type { Classification, SignalKind } from "@/types";

interface AnalyticsPanelProps {
  analytics: Analytics;
  /** The engine's sentence number, matching the highlight workspace. */
  selected: number | null;
  onSelectSentence(index: number): void;
}

const AXIS = { fontSize: 10, fill: "currentColor" } as const;
const CHART_HEIGHT = 188;

/** One bar per sentence, wide enough that the bars stay readable when scrolled. */
function barTrackWidth(count: number, minimum = 300, perItem = 26) {
  return Math.max(minimum, count * perItem);
}

interface TooltipEntry {
  payload?: unknown;
}

interface TipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
}

function TipShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-2 text-2xs shadow-overlay">
      {children}
    </div>
  );
}

function SentenceTip({ active, payload }: TipProps) {
  const point = payload?.[0]?.payload as SentencePoint | undefined;
  if (!active || !point) return null;
  return (
    <TipShell>
      <p className="font-medium text-foreground">Sentence {point.index + 1}</p>
      <p className="tabular">{Math.round(point.aiProbability)}% AI · {Math.round(point.humanProbability)}% human</p>
      <p className="tabular">
        {formatNumber(point.wordCount)} words · {CLASSIFICATION_LABEL[point.classification]}
      </p>
      {point.flagged ? <p className="text-warning">Flagged by the engine</p> : null}
    </TipShell>
  );
}

function ParagraphTip({ active, payload }: TipProps) {
  const point = payload?.[0]?.payload as ParagraphPoint | undefined;
  if (!active || !point) return null;
  return (
    <TipShell>
      <p className="font-medium text-foreground">Paragraph {point.index + 1}</p>
      <p className="tabular">
        {Math.round(point.aiProbability)}% AI · {formatNumber(point.sentences)} sentences ·{" "}
        {formatNumber(point.wordCount)} words
      </p>
      <p className="mt-1 max-w-[15rem] leading-relaxed">{point.preview}</p>
    </TipShell>
  );
}

function LengthTip({ active, payload }: TipProps) {
  const point = payload?.[0]?.payload as SentencePoint | undefined;
  if (!active || !point) return null;
  return (
    <TipShell>
      <p className="font-medium text-foreground">Sentence {point.index + 1}</p>
      <p className="tabular">{formatNumber(point.wordCount)} words</p>
    </TipShell>
  );
}

function StyleTip({ active, payload }: TipProps) {
  const slice = payload?.[0]?.payload as StyleSlice | undefined;
  if (!active || !slice) return null;
  return (
    <TipShell>
      <p className="font-medium text-foreground">{CLASSIFICATION_LABEL[slice.classification]}</p>
      <p className="tabular">{slice.share}% of the words</p>
      <p className="tabular">
        {formatNumber(slice.sentences)} sentences · {formatNumber(slice.words)} words
      </p>
    </TipShell>
  );
}

/**
 * The spec's analytics dashboard. Four charts and the ten measurements, all drawn
 * from `buildAnalytics`, which only projects fields the engine already returned —
 * the panel never scores text a second time. Bars are clickable because a chart on
 * its own cannot show which sentence to look at; clicking one opens the same
 * sentence panel the highlight does.
 */
export function AnalyticsPanel({ analytics, selected, onSelectSentence }: AnalyticsPanelProps) {
  const palette = useChartPalette();
  const barColors: Record<SignalKind, string> = {
    ai: palette.ai,
    human: palette.human,
    mixed: palette.mixed,
    neutral: palette.neutral,
  };
  const classColors: Record<Classification, string> = {
    ai_generated: palette.ai,
    ai_generated_refined: palette.mixed,
    human_refined: palette.human,
    human_written: palette.human,
  };

  return (
    <section aria-label="Analytics" className="space-y-3">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle>Analytics</CardTitle>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            {formatNumber(analytics.sentences.length)} sentences and{" "}
            {formatNumber(analytics.paragraphs.length)} paragraphs measured, on the same scale: 0 to
            100 estimated AI likelihood. Hover a bar for its own figures, click it to open that
            sentence.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <ChartBlock
            title="AI likelihood by sentence"
            caption={
              analytics.sentences.length === 0
                ? "No sentences were scored."
                : `Bars are the engine's per-sentence estimate. Sentence colour follows the signal it read: ${SIGNAL_KIND_LABEL.ai.toLowerCase()}, ${SIGNAL_KIND_LABEL.human.toLowerCase()}, ${SIGNAL_KIND_LABEL.mixed.toLowerCase()}.`
            }
            summary={sentenceSeriesSummary(analytics)}
            trackWidth={barTrackWidth(analytics.sentences.length)}
          >
            <BarChart data={analytics.sentences} height={CHART_HEIGHT} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="index"
                tickFormatter={(value: number) => `${value + 1}`}
                tick={AXIS}
                stroke={palette.axis}
                tickLine={false}
              />
              <YAxis domain={[0, 100]} tick={AXIS} stroke={palette.axis} tickLine={false} width={38} />
              <Tooltip content={<SentenceTip />} cursor={{ fill: palette.surface }} />
              <ReferenceLine
                y={DETECTION_SCORE_LINES.flag}
                stroke={palette.axis}
                strokeDasharray="4 4"
                label={{
                  value: `flag line ${DETECTION_SCORE_LINES.flag}%`,
                  position: "insideTopRight",
                  fontSize: 9,
                  fill: palette.axis,
                }}
              />
              {/* Recharts draws marks at zero size until an animation frame lands, which
                  never happens in a background tab or under reduced motion. */}
              <Bar
                dataKey="aiProbability"
                name="AI likelihood"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
                onClick={(state: unknown) => {
                  const point = (state as { payload?: SentencePoint })?.payload;
                  if (point) onSelectSentence(point.index);
                }}
              >
                {analytics.sentences.map((point) => (
                  <Cell
                    key={point.index}
                    fill={barColors[point.signal] ?? palette.mixed}
                    stroke={selected === point.index ? palette.text : "none"}
                    strokeWidth={selected === point.index ? 1.5 : 0}
                    cursor="pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartBlock>

          <ChartBlock
            title="AI likelihood by paragraph"
            caption={paragraphFlatNote(analytics)}
            summary={paragraphSeriesSummary(analytics)}
            trackWidth={barTrackWidth(analytics.paragraphs.length, 300, 62)}
          >
            <BarChart data={analytics.paragraphs} height={CHART_HEIGHT} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="index"
                tickFormatter={(value: number) => `P${value + 1}`}
                tick={AXIS}
                stroke={palette.axis}
                tickLine={false}
              />
              <YAxis domain={[0, 100]} tick={AXIS} stroke={palette.axis} tickLine={false} width={38} />
              <Tooltip content={<ParagraphTip />} cursor={{ fill: palette.surface }} />
              <Bar
                dataKey="aiProbability"
                name="AI likelihood"
                radius={[2, 2, 0, 0]}
                maxBarSize={46}
                isAnimationActive={false}
                onClick={(state: unknown) => {
                  const point = (state as { payload?: ParagraphPoint })?.payload;
                  if (point) onSelectSentence(point.firstSentenceIndex);
                }}
              >
                {analytics.paragraphs.map((point) => (
                  <Cell
                    key={point.index}
                    fill={barColors[point.signal] ?? palette.mixed}
                    cursor="pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartBlock>

          <ChartBlock
            title="Sentence-length variation"
            caption={`Lengths from ${formatNumber(analytics.length.shortest)} to ${formatNumber(
              analytics.length.longest,
            )} words, averaging ${analytics.length.mean.toFixed(1)} with a spread of ${analytics.length.stdDev.toFixed(
              1,
            )} words. The engine reads that as ${analytics.length.burstiness.toFixed(
              2,
            )} burstiness, where a lower number means the sentences stay close to one length.`}
            summary={lengthSeriesSummary(analytics)}
            trackWidth={barTrackWidth(analytics.sentences.length)}
          >
            <LineChart data={analytics.sentences} height={CHART_HEIGHT} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="index"
                tickFormatter={(value: number) => `${value + 1}`}
                tick={AXIS}
                stroke={palette.axis}
                tickLine={false}
              />
              <YAxis tick={AXIS} stroke={palette.axis} tickLine={false} width={38} />
              <Tooltip content={<LengthTip />} cursor={{ stroke: palette.axis, strokeDasharray: "3 3" }} />
              <ReferenceLine
                y={analytics.length.mean}
                stroke={palette.axis}
                strokeDasharray="4 4"
                label={{ value: "average", position: "insideTopRight", fontSize: 9, fill: palette.axis }}
              />
              <Line
                type="monotone"
                dataKey="wordCount"
                name="Words"
                stroke={palette.primary}
                strokeWidth={2}
                isAnimationActive={false}
                dot={{ r: 2.5, fill: palette.primary }}
                activeDot={{ r: 4, cursor: "pointer" }}
              />
            </LineChart>
          </ChartBlock>

          <ChartBlock
            title="Writing-style distribution"
            caption="Share of the measured words in each class, by the same score bands the engine used for the document figure. The four classes divide one measurement; they are not four separate checks."
            summary={styleSeriesSummary(analytics)}
            trackWidth={300}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div style={{ width: 168, height: CHART_HEIGHT }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<StyleTip />} />
                    <Pie
                      data={analytics.styles.filter((slice) => slice.share > 0)}
                      dataKey="share"
                      nameKey="classification"
                      innerRadius={38}
                      outerRadius={62}
                      paddingAngle={1}
                      isAnimationActive={false}
                      stroke={palette.surface}
                    >
                      {analytics.styles
                        .filter((slice) => slice.share > 0)
                        .map((slice) => (
                          <Cell
                            key={slice.classification}
                            fill={classColors[slice.classification]}
                            fillOpacity={slice.classification === "human_refined" ? 0.55 : 0.92}
                          />
                        ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-[9rem] flex-1 space-y-1 text-2xs">
                {analytics.styles.map((slice) => (
                  <li key={slice.classification} className="flex items-baseline gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: classColors[slice.classification],
                        opacity: slice.classification === "human_refined" ? 0.6 : 1,
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">{CLASSIFICATION_LABEL[slice.classification]}</span>
                    <span className="shrink-0 tabular text-muted-foreground">
                      {slice.share}% · {formatNumber(slice.words)} words
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </ChartBlock>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle>Measurements</CardTitle>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Every figure below is the engine's own measurement of this text.{" "}
            {DETECTION_DISCLAIMER_SHORT}
          </p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-2xs sm:grid-cols-3 lg:grid-cols-5">
            {analytics.metrics.map((metric) => (
              <div key={metric.label} className="min-w-0">
                <dt className="truncate text-muted-foreground">{metric.label}</dt>
                <dd className="truncate font-medium tabular text-foreground">{metric.value}</dd>
                <dd className="text-2xs leading-snug text-muted-foreground">{metric.note}</dd>
              </div>
            ))}
          </dl>
          <Badge variant="subtle" size="sm" className="mt-4">
            {formatNumber(analytics.sentences.length)} sentences charted
          </Badge>
        </CardContent>
      </Card>
    </section>
  );
}

function ChartBlock({
  title,
  caption,
  summary,
  trackWidth,
  children,
}: {
  title: string;
  caption: string;
  summary: string;
  trackWidth: number;
  children: React.ReactNode;
}) {
  return (
    <figure className="space-y-2">
      <figcaption>
        <h4 className="text-xs font-medium text-foreground">{title}</h4>
        <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{caption}</p>
      </figcaption>
      {/* The SVG is decorative next to the same figures in the label below it. */}
      <div
        role="img"
        aria-label={`${title}. ${summary}`}
        className="overflow-x-auto pb-1"
      >
        <div style={{ minWidth: trackWidth }}>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      </div>
    </figure>
  );
}
