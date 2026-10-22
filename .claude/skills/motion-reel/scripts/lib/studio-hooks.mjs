// Module hooks for Node: resolve '/_studio/x.mjs' to the skill's runtime folder,
// so score.mjs and other film modules import exactly as they do in the browser.
let runtime;

export function initialize(data) {
  runtime = data.runtime;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('/_studio/')) {
    return { url: new URL(specifier.slice('/_studio/'.length), runtime).href, shortCircuit: true };
  }
  return next(specifier, context);
}
