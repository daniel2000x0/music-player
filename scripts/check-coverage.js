/**
 * Verifica los objetivos de cobertura por capa.
 *
 * Jest solo aplica `coverageThreshold` a cada archivo que coincide con un
 * glob, no al promedio del directorio. Este script lee el informe que ya
 * generó `jest --coverage` y comprueba los promedios de las capas que la
 * FASE 7 fijó como criterio de salida: dominio ≥ 90 %, servicios ≥ 70 %,
 * stores ≥ 80 % en líneas.
 *
 * Uso: `npm run test:coverage && npm run check:coverage`
 */
/* eslint-env node */
const fs = require('node:fs');
const path = require('node:path');

const reportPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

if (!fs.existsSync(reportPath)) {
  console.error('No hay informe de cobertura. Ejecuta antes `npm run test:coverage`.');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const entries = Object.keys(report).filter((key) => key !== 'total');

const targets = [
  { name: 'dominio', pattern: /[\\/]src[\\/]domain[\\/]/, minimum: 90 },
  { name: 'servicios', pattern: /[\\/]src[\\/]services[\\/]/, minimum: 70 },
  { name: 'stores', pattern: /[\\/]src[\\/]stores[\\/]/, minimum: 80 },
];

let failed = false;

for (const { name, pattern, minimum } of targets) {
  const files = entries.filter((key) => pattern.test(key));
  if (files.length === 0) {
    console.error(`No se encontraron archivos de ${name} en el informe de cobertura.`);
    failed = true;
    continue;
  }
  const covered = files.reduce((sum, key) => sum + report[key].lines.covered, 0);
  const total = files.reduce((sum, key) => sum + report[key].lines.total, 0);
  const percentage = (100 * covered) / total;
  const ok = percentage >= minimum;
  console.log(
    `${ok ? '✓' : '✗'} ${name.padEnd(10)} ${percentage.toFixed(2)}% ` +
      `(objetivo ≥ ${minimum}%, ${covered}/${total} líneas, ${files.length} archivos)`
  );
  if (!ok) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
