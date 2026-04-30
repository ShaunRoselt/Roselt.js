import Roselt from "./Roselt.js";
import {
  start,
  ComponentRegistry,
  defineComponent,
  globalComponentRegistry,
  lazyComponent,
} from "./index.js";

Object.assign(globalThis.Roselt ?? {}, {
  Roselt,
  start,
  ComponentRegistry,
  defineComponent,
  globalComponentRegistry,
  lazyComponent,
});