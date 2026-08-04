import { Layer, ManagedRuntime } from "effect";

import { AuthLive } from "./auth/auth-live.js";
import { ClipboardLive } from "./clipboard/clipboard-live.js";
import { ConfigLive } from "./config/config-live.js";
import { HerdrLive } from "./herdr/herdr-live.js";
import { NeonCliLive } from "./neon-cli/neon-cli-live.js";
import { NeonLive } from "./neon/neon-live.js";
import { StateLive } from "./state/state-live.js";

const IndependentLayers = Layer.mergeAll(
  ConfigLive,
  ClipboardLive,
  HerdrLive,
  NeonCliLive,
);

const AuthLayer = AuthLive.pipe(Layer.provide(IndependentLayers));
const StateLayer = StateLive.pipe(Layer.provide(IndependentLayers));
const NeonDependencies = Layer.merge(IndependentLayers, AuthLayer);
const NeonLayer = NeonLive.pipe(Layer.provide(NeonDependencies));

export const AppLayer = Layer.mergeAll(
  IndependentLayers,
  AuthLayer,
  StateLayer,
  NeonLayer,
);

export type AppServices = Layer.Layer.Success<typeof AppLayer>;

export const appRuntime = ManagedRuntime.make(AppLayer);
