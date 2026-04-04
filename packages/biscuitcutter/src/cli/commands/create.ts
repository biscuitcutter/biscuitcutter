import { Command } from 'commander';
import { configureLogger } from '../../utils/log';
import { create } from '../../core/tracking';
import { handleTrackingError, parseExtraContext } from './helpers';

export function registerCreateCommand(program: Command): void {
  program
    .command('create <template>')
    .description('Create a new project from a template with update tracking enabled')
    .option('-o, --output-dir <dir>', 'Where to output the generated project', '.')
    .option('-c, --checkout <checkout>', 'Branch, tag, or commit to checkout')
    .option('--directory <directory>', 'Directory within repo that holds biscuitcutter.json (or cookiecutter.json)')
    .option('--no-input', 'Do not prompt for parameters')
    .option('-e, --extra-context <items...>', 'Extra context items in key=value format')
    .option('--extra-context-file <path>', 'JSON file with extra context')
    .option('--config-file <path>', 'User configuration file')
    .option('--default-config', 'Use default config values', false)
    .option('-f, --overwrite-if-exists', 'Overwrite output directory if it exists', false)
    .option('--skip <paths...>', 'Paths to skip during updates')
    .option('-v, --verbose', 'Print debug information', false)
    .action(async (template: string, opts: any) => {
      configureLogger(opts.verbose ? 'DEBUG' : 'INFO');

      try {
        const projectDir = await create({
          templateGitUrl: template,
          outputDir: opts.outputDir,
          checkout: opts.checkout,
          directory: opts.directory,
          noInput: !opts.input,
          extraContext: parseExtraContext(opts.extraContext),
          extraContextFile: opts.extraContextFile,
          configFile: opts.configFile,
          defaultConfig: opts.defaultConfig,
          overwriteIfExists: opts.overwriteIfExists,
          skip: opts.skip,
        });
        console.log(`Project created at ${projectDir}`);
      } catch (e: any) {
        handleTrackingError(e);
      }
    });
}
