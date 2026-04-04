import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Command } from 'commander';
import { getUserConfig } from '../../config/config';
import {
  ContextDecodingError,
  EmptyDirNameError,
  FailedHookError,
  InvalidModeError,
  InvalidZipRepositoryError,
  OutputDirExistsError,
  RepositoryCloneFailedError,
  RepositoryNotFoundError,
  UndefinedVariableInTemplateError,
  UnknownExtensionError,
} from '../../utils/exceptions';
import { configureLogger } from '../../utils/log';
import { biscuitcutter } from '../../core/main';
import { parseExtraContext } from './helpers';

function handleGenerateError(e: unknown): void {
  if (
    e instanceof ContextDecodingError
    || e instanceof OutputDirExistsError
    || e instanceof EmptyDirNameError
    || e instanceof InvalidModeError
    || e instanceof FailedHookError
    || e instanceof UnknownExtensionError
    || e instanceof InvalidZipRepositoryError
    || e instanceof RepositoryNotFoundError
    || e instanceof RepositoryCloneFailedError
  ) {
    console.error(e.message);
    process.exit(1);
  } else if (e instanceof UndefinedVariableInTemplateError) {
    console.error(e.message);
    console.error(`Error message: ${e.error.message}`);
    console.error(`Context: ${JSON.stringify(e.context, null, 4)}`);
    process.exit(1);
  } else {
    throw e;
  }
}

async function resolveAcceptHooks(value: string): Promise<boolean> {
  if (value !== 'ask') {
    return value === 'yes';
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    rl.question('Do you want to execute hooks? [y/N]: ', (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

function listInstalledTemplates(
  defaultConfig: boolean,
  passedConfigFile?: string | null,
): void {
  const config = getUserConfig(passedConfigFile, defaultConfig);
  const biscuitcutterFolder = config.biscuitcutters_dir;

  if (!fs.existsSync(biscuitcutterFolder)) {
    console.error(
      `Error: Cannot list installed templates. Folder does not exist: ${biscuitcutterFolder}`,
    );
    process.exit(1);
  }

  const templateNames = fs
    .readdirSync(biscuitcutterFolder)
    .filter((folder) => fs.existsSync(
      path.join(biscuitcutterFolder, folder, 'biscuitcutter.json'),
    ) || fs.existsSync(
      path.join(biscuitcutterFolder, folder, 'cookiecutter.json'),
    ));

  console.log(`${templateNames.length} installed templates: `);
  for (const name of templateNames) {
    console.log(` * ${name}`);
  }
}

export function registerGenerateCommand(program: Command): void {
  program
    .argument('[template]', 'Template directory or repository URL')
    .option(
      '-e, --extra-context <items...>',
      'Extra context items in key=value format',
    )
    .option(
      '--no-input',
      'Do not prompt for parameters and only use biscuitcutter.json (or cookiecutter.json) file content',
    )
    .option(
      '-c, --checkout <checkout>',
      'Branch, tag or commit to checkout after git clone',
    )
    .option(
      '--directory <directory>',
      'Directory within repo that holds biscuitcutter.json (or cookiecutter.json) file',
    )
    .option('-v, --verbose', 'Print debug information', false)
    .option(
      '--replay',
      'Do not prompt for parameters and only use information entered previously',
      false,
    )
    .option(
      '--replay-file <path>',
      'Use this file for replay instead of the default',
    )
    .option(
      '-f, --overwrite-if-exists',
      'Overwrite the contents of the output directory if it already exists',
      false,
    )
    .option(
      '-s, --skip-if-file-exists',
      'Skip the files in the corresponding directories if they already exist',
      false,
    )
    .option(
      '-o, --output-dir <dir>',
      'Where to output the generated project dir into',
      '.',
    )
    .option('--config-file <path>', 'User configuration file')
    .option(
      '--default-config',
      'Do not load a config file. Use the defaults instead',
      false,
    )
    .option(
      '--debug-file <path>',
      'File to be used as a stream for DEBUG logging',
    )
    .option(
      '--accept-hooks <value>',
      'Accept pre/post hooks (yes/ask/no)',
      'yes',
    )
    .option(
      '-l, --list-installed',
      'List currently installed templates',
      false,
    )
    .option(
      '--keep-project-on-failure',
      'Do not delete project folder on failure',
      false,
    )
    .action(async (template: string | undefined, opts: any) => {
      if (opts.listInstalled) {
        listInstalledTemplates(opts.defaultConfig, opts.configFile);
        process.exit(0);
      }

      if (!template || template.toLowerCase() === 'help') {
        program.help();
        process.exit(0);
      }

      configureLogger(
        opts.verbose ? 'DEBUG' : 'INFO',
        opts.debugFile,
      );

      const extraContext = parseExtraContext(opts.extraContext);

      const acceptHooks = await resolveAcceptHooks(opts.acceptHooks);

      let { replay } = opts;
      if (opts.replayFile) {
        replay = opts.replayFile;
      }

      try {
        await biscuitcutter({
          template,
          checkout: opts.checkout,
          noInput: opts.noInput,
          extraContext,
          replay,
          overwriteIfExists: opts.overwriteIfExists,
          outputDir: opts.outputDir,
          configFile: opts.configFile,
          defaultConfig: opts.defaultConfig,
          password: process.env.BISCUITCUTTER_REPO_PASSWORD,
          directory: opts.directory,
          skipIfFileExists: opts.skipIfFileExists,
          acceptHooks,
          keepProjectOnFailure: opts.keepProjectOnFailure,
        });
      } catch (e: any) {
        handleGenerateError(e);
      }
    });
}
