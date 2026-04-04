import { Command } from 'commander';
import { configureLogger } from '../../utils/log';
import { update } from '../../core/tracking';
import {
  handleTrackingError, logSuccess, logError, parseExtraContext,
} from './helpers';

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update the project to the latest template version')
    .option('-p, --project-dir <dir>', 'The project directory to update', '.')
    .option('-c, --checkout <checkout>', 'Branch, tag, or commit to update to')
    .option('--template-path <path>', 'Override the template path')
    .option('-i, --biscuitcutter-input', 'Prompt for biscuitcutter input during update', false)
    .option('-r, --refresh-private-variables', 'Refresh private variables from template', false)
    .option('-y, --skip-apply-ask', 'Skip asking to apply changes', false)
    .option('-s, --skip-update', 'Skip applying update (just mark as updated)', false)
    .option('--strict', 'Require exact commit match for up-to-date check', true)
    .option('--no-strict', 'Allow ancestry matching')
    .option('--allow-untracked-files', 'Allow untracked files in working directory', false)
    .option('-e, --extra-context <items...>', 'Extra context items in key=value format')
    .option('--extra-context-file <path>', 'JSON file with extra context')
    .option('-v, --verbose', 'Print debug information', false)
    .action(async (opts: any) => {
      configureLogger(opts.verbose ? 'DEBUG' : 'INFO');

      try {
        const result = await update({
          projectDir: opts.projectDir,
          checkout: opts.checkout,
          templatePath: opts.templatePath,
          biscuitcutterInput: opts.biscuitcutterInput,
          refreshPrivateVariables: opts.refreshPrivateVariables,
          skipApplyAsk: opts.skipApplyAsk,
          skipUpdate: opts.skipUpdate,
          strict: opts.strict,
          allowUntrackedFiles: opts.allowUntrackedFiles,
          extraContext: parseExtraContext(opts.extraContext),
          extraContextFile: opts.extraContextFile,
        });

        if (result.success) {
          logSuccess(result.message);
        } else {
          logError(result.message);
          process.exit(1);
        }
      } catch (e: any) {
        handleTrackingError(e);
      }
    });
}
