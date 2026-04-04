import { Command } from 'commander';
import { configureLogger } from '../../utils/log';
import { diff } from '../../core/tracking';
import { handleTrackingError } from './helpers';

export function registerDiffCommand(program: Command): void {
  program
    .command('diff')
    .description('Show the diff between the project and its template')
    .option('-p, --project-dir <dir>', 'The project directory to check', '.')
    .option('-c, --checkout <checkout>', 'Branch, tag, or commit to compare against')
    .option('--exit-code', 'Return non-zero exit code if there are differences', false)
    .option('-v, --verbose', 'Print debug information', false)
    .action(async (opts: any) => {
      configureLogger(opts.verbose ? 'DEBUG' : 'INFO');

      try {
        const result = await diff({
          projectDir: opts.projectDir,
          checkout: opts.checkout,
          exitCode: opts.exitCode,
        });

        process.exit(result.exitCode);
      } catch (e: any) {
        handleTrackingError(e);
      }
    });
}
