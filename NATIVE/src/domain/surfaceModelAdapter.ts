import type { Prediction } from "./v2-primitives";

export type SurfaceModelInput = {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
};

export type SurfaceModelManifest = {
  id: string;
  version: string;
  sha256: string;
  preprocessingVersion: string;
  labelOrder: readonly ["roof", "paved", "soil", "vegetation", "porous"];
  runtime: "onnxruntime-web";
};

export interface LocalSurfaceModelAdapter {
  readonly manifest: SurfaceModelManifest;
  load(signal: AbortSignal): Promise<void>;
  predict(input: SurfaceModelInput, signal: AbortSignal): Promise<Prediction>;
  dispose(): void;
}

export type SurfaceModelResolution =
  | { status: "available"; adapter: LocalSurfaceModelAdapter }
  | { status: "unavailable"; reason: "NO_VALIDATED_BUNDLED_MODEL" };

/** Fail closed until a locally bundled five-class model has passed the data and release gates. */
export async function loadBundledSurfaceModel(): Promise<SurfaceModelResolution> {
  return { status: "unavailable", reason: "NO_VALIDATED_BUNDLED_MODEL" };
}
