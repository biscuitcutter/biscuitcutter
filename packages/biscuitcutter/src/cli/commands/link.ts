import { Command } from 'commander';
import { configureLogger } from '../../utils/log';
import { link } from '../../core/tracking';
import { handleTrackingError, logSuccess, parseExtraContext } from './helpers';

export function registerLinkCommand(program: Command): void {
  program
    .command('link <template>')
    .description('Link an existing project to a cookiecutter template')
    .option('-p, --project-dir <dir>', 'The project directory to link', '.')
    .option('-c, --checkout <checkout>', 'Branch, tag, or commit to link to')
    .option('--directory <directory>', 'Directory within repo that holds biscuitcutter.json (or cookiecutter.json)')
    .option('--no-input', 'Do not prompt for parameters')
    .option('-e, --extra-context <items...>', 'Extra context items in key=value format')
    .option('--config-file <path>', 'User configuration file')
    .option('--default-config', 'Use default config values', false)
    .option('-v, --verbose', 'Print debug information', false)
    .action(async (template: string, opts: any) => {
      configureLogger(opts.verbose ? 'DEBUG' : 'INFO');

      try {
        await link({
          templateGitUrl: template,
          projectDir: opts.projectDir,
          checkout: opts.checkout,
          directory: opts.directory,
          noInput: !opts.input,
          extraContext: parseExtraContext(opts.extraContext),
          configFile: opts.configFile,
          defaultConfig: opts.defaultConfig,
        });
        logSuccess('Project linked successfully!');
      } catch (e: any) {
        handleTrackingError(e);
      }
    });
}
