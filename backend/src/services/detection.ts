/**
 * §37's pipeline, run on the server.
 *
 * The stage list is the app's own — validation, normalization, language detection,
 * paragraph and sentence segmentation, feature extraction, model inference, confidence
 * estimation, sentence and document aggregation, explanation — implemented once, in
 * `src/lib/detection/pipeline.ts`, and executed here over the model this service selected.
 * Nothing in this file scores anything: choosing the model and running it is the whole job.
 *
 * Two selections are possible and both are honest about their limits. `engine` runs the
 * rule-based model the browser uses, so a score means the same thing on either path.
 * `remote` asks another service, and if that service does not answer with a score for every
 * sentence, the run fails with 502 — this route would rather report a failure than print a
 * figure nobody measured.
 */
import { runDetectionPipeline, validateInput } from "@/lib/detection/pipeline.ts";
import type { DetectionResult, LanguageCode } from "@/types";
import { detectNotAvailable, modelChoice, selectedModel } from "../detector/model.ts";
import { RemoteDetectionModel, fetchRemoteReport, remoteOptionsFromEnv } from "../detector/remote-model.ts";
import { DetectionDisabled } from "../schemas/wire.ts";

/** The result shape the client's `validateDetectionResult` accepts, or a thrown service error. */
export async function runDetection(text: string, language: string | null): Promise<DetectionResult> {
  // The engine's word limits, checked before anything is scored or any upstream is asked:
  // five words is not a measurement no matter which model answers.
  validateInput(text);
  const forced = language ? (language as LanguageCode) : undefined;

  if (modelChoice().source === "remote") {
    const options = remoteOptionsFromEnv();
    if (!options) throw new DetectionDisabled(detectNotAvailable() ?? "No upstream model is configured.");
    const report = await fetchRemoteReport(text, language, options);
    return runDetectionPipeline(text, {
      language: forced,
      model: new RemoteDetectionModel(report, options.modelId, options.version),
    });
  }

  const model = selectedModel();
  if (!model) throw new DetectionDisabled(detectNotAvailable() ?? "No detection model is selected on this service.");
  return runDetectionPipeline(text, { language: forced, model });
}
