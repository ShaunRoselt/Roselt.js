import Roselt from "./Roselt.js";

export { Roselt, default } from "./Roselt.js";
export { defineComponent } from "./components/component-registry.js";

export async function start(options) {
  return Roselt.start(options);
}