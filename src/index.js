import Roselt from "./Roselt.js";

export { Roselt, default } from "./Roselt.js";
export {
  ComponentRegistry,
  defineComponent,
  globalComponentRegistry,
  lazyComponent,
} from "./components/component-registry.js";

export async function start(options) {
  return Roselt.start(options);
}