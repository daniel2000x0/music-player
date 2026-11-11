/**
 * Declaración mínima de `node:perf_hooks`, consumido solo por los benchmarks
 * (`src/testing/bench`). Evita instalar `@types/node` en todo el proyecto;
 * el `performance` global de Jest/React Native solo ofrece resolución de 1 ms.
 */
declare module 'node:perf_hooks' {
  export const performance: { now(): number };
}
