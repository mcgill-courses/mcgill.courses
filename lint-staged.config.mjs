import path from 'node:path';

const client = path.join(process.cwd(), 'client');

const quote = (argument) => `'${argument.replaceAll("'", "'\\''")}'`;

const relativeToClient = (file) => path.relative(client, path.resolve(file));

const eslint = (files) =>
  `pnpm --dir client exec eslint ${files.map(relativeToClient).map(quote).join(' ')}`;

export default {
  '*.rs': ['cargo fmt --'],
  '*.{js,json,jsonc,md,mjs,ts,tsx,yaml,yml}': ['prettier --write'],
  'client/**/*.{ts,tsx}': (files) => [eslint(files)],
};
