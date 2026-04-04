#!/usr/bin/env node
/**
 * Main `biscuitcutter` CLI.
 */

import * as path from 'path';
import { Command } from 'commander';
import { version as VERSION } from '../../package.json';
import { registerGenerateCommand } from './commands/generate';
import { registerCreateCommand } from './commands/create';
import { registerCheckCommand } from './commands/check';
import { registerUpdateCommand } from './commands/update';
import { registerDiffCommand } from './commands/diff';
import { registerLinkCommand } from './commands/link';

function versionMsg(): string {
  const location = path.dirname(path.dirname(path.resolve(__filename)));
  return `BiscuitCutter ${VERSION} from ${location} (Node.js ${process.version})`;
}

const program = new Command();

program
  .name('biscuitcutter')
  .description(
    'Create a project from a BiscuitCutter project template (TEMPLATE).\n\n'
      + 'BiscuitCutter is a port of the popular Cookiecutter tool to TypeScript.',
  )
  .version(versionMsg(), '-V, --version');

registerGenerateCommand(program);
registerCreateCommand(program);
registerCheckCommand(program);
registerUpdateCommand(program);
registerDiffCommand(program);
registerLinkCommand(program);

export function main(): void {
  program.parse(process.argv);
}

if (require.main === module) {
  main();
}
