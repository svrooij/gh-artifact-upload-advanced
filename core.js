import fs from 'node:fs';

export function getInput(name, options = {}) {
  const val = (process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] ?? '').trim();
  if (options.required && !val) {
    throw new Error(`Input required and not supplied: ${name}`);
  }
  return val;
}

export function info(message) {
  process.stdout.write(`${message}\n`);
}

export function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  } else {
    process.stdout.write(`::set-output name=${name}::${value}\n`);
  }
}

export function setFailed(message) {
  process.exitCode = 1;
  process.stderr.write(`::error::${message}\n`);
}
