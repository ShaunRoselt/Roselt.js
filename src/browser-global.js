import Roselt from "./Roselt.js";
import { start, defineComponent } from "./index.js";

Object.assign(globalThis.Roselt ?? {}, {
  Roselt,
  start,
  defineComponent,
});