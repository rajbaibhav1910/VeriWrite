/**
 * The detection seam (spec §37).
 *
 * The interface is the app's own, imported from `src/lib/detection/model.ts` instead of
 * restated here: that file already describes what a sentence, paragraph and document score
 * carries, and a second copy of the shape would be a second truth about it. The stage list
 * §37 names — validation, normalization, language, segmentation, features, inference,
 * confidence, aggregation, explanation — is the pipeline in `src/lib/detection/pipeline.ts`,
 * which this service runs rather than reimplements.
 *
 * Selection is one env read and one lookup. `detectionModels` is the engine's own registry,
 * so a model that is registered there becomes selectable here without a new seam:
 *
 *   DETECTION_MODEL=engine    the app's rule-based engine (the default, and what the
 *                             browser path uses, so a score means the same thing on both)
 *   DETECTION_MODEL=remote    an upstream model, asked per run over HTTP
 *                             (see `remote-model.ts`)
 *   DETECTION_MODEL=heuristic the registry key of any model that registers itself
 *   DETECTION_MODEL=none      detection stays off; `/api/detect` says why
 *
 * What is *not* done here: no score is ever invented for a model that is missing or that
 * failed to answer. `detectNotAvailable()` and `UpstreamFailure` carry the reason to the
 * route, and the route answers 501/502 rather than returning a number with nothing behind it.
 */
import { detectionModels, getDefaultModel, type DetectionModel } from "@/lib/detection/model.ts";

/** How this service came to have the model it has. */
export type DetectionSource = "engine" | "remote" | "none";

export interface ModelChoice {
  source: DetectionSource;
  /** Named on `/api/health` next to every score, so a reader can tell which model answered. */
  id: string | null;
  /** Why there is no model, or `null` when there is one. A route may put this in a response. */
  reason: string | null;
}

/** The registry key the operator asked for, or the engine when nothing was configured. */
function requestedKey(): string {
  const configured = (process.env.DETECTION_MODEL ?? "").trim().toLowerCase();
  return configured.length > 0 ? configured : "engine";
}

export function modelChoice(): ModelChoice {
  const key = requestedKey();
  if (key === "none" || key === "off") {
    return { source: "none", id: null, reason: "DETECTION_MODEL is set to none, so this service runs no detection." };
  }
  if (key === "remote") {
    const url = (process.env.DETECTOR_MODEL_URL ?? "").trim();
    if (!url) {
      return {
        source: "none",
        id: null,
        reason: 'DETECTION_MODEL=remote needs DETECTOR_MODEL_URL: there is no upstream to ask, and a score invented in its place would not be a measurement.',
      };
    }
    return { source: "remote", id: (process.env.DETECTOR_MODEL_ID ?? "").trim() || hostOf(url), reason: null };
  }
  if (key === "engine") return { source: "engine", id: getDefaultModel().id, reason: null };
  if (key in detectionModels) return { source: "engine", id: detectionModels[key]().id, reason: null };
  return {
    source: "none",
    id: null,
    reason: `DETECTION_MODEL="${key}" names no model on this service. Available: engine, remote, ${Object.keys(detectionModels).join(", ")}.`,
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "upstream";
  }
}

/**
 * The model to run a document through, or `null` for the remote source, whose model cannot
 * exist before the upstream has answered. A caller must not turn that into a score of its own.
 */
export function selectedModel(): DetectionModel | null {
  const key = requestedKey();
  if (key === "engine") return getDefaultModel();
  if (key in detectionModels) return detectionModels[key]();
  return null;
}

export function registeredModel(): DetectionModel | null {
  const choice = modelChoice();
  return choice.source === "engine" ? selectedModel() : null;
}

/**
 * Why detection is not available, or `null` when it is. Kept as one sentence because it
 * goes into an API response and onto the start-up log line unchanged.
 */
export function detectNotAvailable(): string | null {
  return modelChoice().reason;
}
