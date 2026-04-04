import { Command } from 'commander';
import { configureLogger } from '../../utils/log';
import { check } from '../../core/tracking';
import { handleTrackingError, logSuccess, logWarning } from './helpers';

export function registerCheckCommand(program: Command): void {
  program
    .command('check')
    .description('Check if the project is up to date with its template')
    .option('-p, --project-dir <dir>', 'The project directory to check', '.')
    .option('-c, --checkout <checkout>', 'Branch, tag, or commit to check against')
    .option('--strict', 'Require exact commit match', true)
    .option('--no-strict', 'Allow ancestry matching')
    .option('-v, --verbose', 'Print debug information', false)
    .action(async (opts: any) => {
      configureLogger(opts.verbose ? 'DEBUG' : 'INFO');

      try {
        const result = await check({
          projectDir: opts.projectDir,
          checkout: opts.checkout,
          strict: opts.strict,
        });

        if (result.upToDate) {
          logSuccess(`SUCCESS: ${result.message}`);
          process.exit(0);
        } else {
          logWarning(`WARNING: ${result.message}`);
          process.exit(1);
        }
      } catch (e: any) {
        handleTrackingError(e);
      }
    });
}
