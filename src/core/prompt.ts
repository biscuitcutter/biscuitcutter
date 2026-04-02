/**
 * Functions for prompting the user for project info.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as nunjucks from 'nunjucks';
import { UndefinedVariableInTemplateError } from '../utils/exceptions';
import { createEnvWithContext, rmtree } from '../utils/utils';

function getPromptLabel(varName: string, prompts?: Record<string, any>): string {
  return prompts && varName in prompts && prompts[varName]
    ? prompts[varName]
    : varName;
}

/**
 * Prompt user for variable and return the entered value or given default.
 */
export async function readUserVariable(
  varName: string,
  defaultValue: any,
  prompts?: Record<string, any>,
  prefix: string = '',
): Promise<any> {
  const question = getPromptLabel(varName, prompts);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (): Promise<any> => new Promise<any>((resolve) => {
    // If default value is null, it's a required field (no default suffix).
    const isRequired = defaultValue === null;
    const defaultSuffix = isRequired ? '' : (defaultValue !== undefined ? ` [${defaultValue}]` : '');

    rl.question(`${prefix}${question}${defaultSuffix}: `, (answer) => {
      if (!answer) {
        if (isRequired) {
          console.log(`\nError: '${varName}' is required and cannot be empty.`);
          resolve(ask());
          return;
        }
        resolve(defaultValue);
      } else {
        resolve(answer);
      }
    });
  });

  const result = await ask();
  rl.close();
  return result;
}

const YES_VALUES = new Set(['1', 'true', 't', 'yes', 'y', 'on']);
const NO_VALUES = new Set(['0', 'false', 'f', 'no', 'n', 'off']);

/**
 * Prompt the user to reply with 'yes' or 'no' (or equivalent values).
 */
export async function readUserYesNo(
  varName: string,
  defaultValue: any,
  prompts?: Record<string, any>,
  prefix: string = '',
): Promise<boolean> {
  const question = getPromptLabel(varName, prompts);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((resolve) => {
    const defaultStr = defaultValue ? 'yes' : 'no';
    const ask = () => {
      rl.question(`${prefix}${question} [${defaultStr}]: `, (answer) => {
        if (!answer) {
          rl.close();
          resolve(!!defaultValue);
          return;
        }
        const lowered = answer.trim().toLowerCase();
        if (YES_VALUES.has(lowered)) {
          rl.close();
          resolve(true);
        } else if (NO_VALUES.has(lowered)) {
          rl.close();
          resolve(false);
        } else {
          console.log('  Please enter yes or no.');
          ask();
        }
      });
    };
    ask();
  });
}

/**
 * Prompt the user to enter a password.
 */
export async function readRepoPassword(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    // Note: readline doesn't natively hide input; for production use a library like 'inquirer'
    rl.question(`${question}: `, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Prompt the user to choose from several options for the given variable.
 */
export async function readUserChoice(
  varName: string,
  options: string[],
  prompts?: Record<string, any>,
  prefix: string = '',
): Promise<string> {
  if (!options || options.length === 0) {
    throw new Error('The list of choices is empty');
  }

  const choiceMap: Record<string, string> = {};
  options.forEach((value, i) => {
    choiceMap[String(i + 1)] = value;
  });

  let question = `Select ${varName}`;
  const choiceLines: string[] = [];

  if (prompts && varName in prompts) {
    const promptVal = prompts[varName];
    if (typeof promptVal === 'string') {
      question = promptVal;
    } else if (typeof promptVal === 'object') {
      if ('__prompt__' in promptVal) {
        question = promptVal.__prompt__;
      }
      Object.entries(choiceMap).forEach(([i, p]) => {
        if (p in promptVal) {
          choiceLines.push(`    ${i} - ${promptVal[p]}`);
        } else {
          choiceLines.push(`    ${i} - ${p}`);
        }
      });
    }
  }

  if (choiceLines.length === 0) {
    Object.entries(choiceMap).forEach(([i, value]) => {
      choiceLines.push(`    ${i} - ${value}`);
    });
  }

  const fullPrompt = [
    `${prefix}${question}`,
    ...choiceLines,
    '    Choose from',
  ].join('\n');

  const validChoices = Object.keys(choiceMap);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    const ask = () => {
      rl.question(`${fullPrompt} [${validChoices[0]}]: `, (answer) => {
        const choice = answer || validChoices[0];
        if (choice in choiceMap) {
          rl.close();
          resolve(choiceMap[choice]);
        } else {
          console.log(`  Please select one of: ${validChoices.join(', ')}`);
          ask();
        }
      });
    };
    ask();
  });
}

/**
 * Prompt the user to provide a dictionary of data (JSON).
 */
export async function readUserDict(
  varName: string,
  defaultValue: Record<string, any>,
  prompts?: Record<string, any>,
  prefix: string = '',
): Promise<Record<string, any>> {
  if (typeof defaultValue !== 'object' || Array.isArray(defaultValue)) {
    throw new TypeError('Default value must be a dict/object');
  }

  const question = getPromptLabel(varName, prompts);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<Record<string, any>>((resolve) => {
    const ask = () => {
      rl.question(`${prefix}${question} (default): `, (answer) => {
        if (!answer) {
          rl.close();
          resolve(defaultValue);
          return;
        }
        try {
          const parsed = JSON.parse(answer);
          if (typeof parsed !== 'object' || Array.isArray(parsed)) {
            console.log('  Please enter a valid JSON object.');
            ask();
            return;
          }
          rl.close();
          resolve(parsed);
        } catch {
          console.log('  Unable to decode JSON. Please try again.');
          ask();
        }
      });
    };
    ask();
  });
}

/**
 * Render the next variable to be displayed in the user prompt.
 */
export function renderVariable(
  env: nunjucks.Environment,
  raw: any,
  cookiecutterDict: Record<string, any>,
): any {
  if (raw === null || raw === undefined || typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) {
      const renderedKey = renderVariable(env, k, cookiecutterDict);
      result[renderedKey] = renderVariable(env, v, cookiecutterDict);
    }
    return result;
  }
  if (Array.isArray(raw)) {
    return raw.map((v) => renderVariable(env, v, cookiecutterDict));
  }

  const str = String(raw);
  return env.renderString(str, { cookiecutter: cookiecutterDict });
}

/**
 * Process template options and return friendly prompt information.
 */
function promptsFromOptions(options: Record<string, any>): Record<string, any> {
  const prompts: Record<string, any> = { __prompt__: 'Select a template' };
  for (const [optionKey, optionValue] of Object.entries(options)) {
    const title = String(optionValue.title || optionKey);
    const description = optionValue.description || optionKey;
    const label = title === description ? title : `${title} (${description})`;
    prompts[optionKey] = label;
  }
  return prompts;
}

/**
 * Prompt user with a set of options to choose from for template selection.
 */
export async function promptChoiceForTemplate(
  key: string,
  options: Record<string, any>,
  noInput: boolean,
): Promise<string> {
  const opts = Object.keys(options);
  if (noInput) {
    return opts[0];
  }
  const prompts = { templates: promptsFromOptions(options) };
  return readUserChoice(key, opts, prompts, '');
}

/**
 * Prompt user with a set of options to choose from.
 */
export async function promptChoiceForConfig(
  cookiecutterDict: Record<string, any>,
  env: nunjucks.Environment,
  key: string,
  options: any[],
  noInput: boolean,
  prompts?: Record<string, any>,
  prefix: string = '',
): Promise<string> {
  const renderedOptions = options.map((raw) => renderVariable(env, raw, cookiecutterDict));
  if (noInput) {
    if (renderedOptions.length === 0) {
      throw new Error('The list of choices is empty');
    }
    return renderedOptions[0];
  }
  return readUserChoice(key, renderedOptions, prompts, prefix);
}

/**
 * Prompt user to enter a new config.
 */
export async function promptForConfig(
  context: Record<string, any>,
  noInput: boolean = false,
): Promise<Record<string, any>> {
  const cookiecutterDict: Record<string, any> = {};
  const env = createEnvWithContext(context);
  const prompts = context.biscuitcutter.__prompts__ || {};
  delete context.biscuitcutter.__prompts__;

  // First pass: Handle simple and raw variables, plus choices
  let count = 0;
  const allPrompts = Object.entries(context.biscuitcutter);
  const visiblePrompts = allPrompts.filter(([k]) => !k.startsWith('_'));
  const size = visiblePrompts.length;

  for (const [key, raw] of allPrompts) {
    if (key.startsWith('_') && !key.startsWith('__')) {
      cookiecutterDict[key] = raw;
      continue;
    }
    if (key.startsWith('__')) {
      cookiecutterDict[key] = renderVariable(env, raw, cookiecutterDict);
      continue;
    }

    if (typeof raw !== 'object' || Array.isArray(raw)) {
      count++;
    }
    const prefix = `  [${count}/${size}] `;

    try {
      if (Array.isArray(raw)) {
        // Choice variable
        const val = await promptChoiceForConfig(cookiecutterDict, env, key, raw, noInput, prompts, prefix);
        cookiecutterDict[key] = val;
      } else if (typeof raw === 'boolean') {
        // Boolean variable
        if (noInput) {
          cookiecutterDict[key] = renderVariable(env, raw, cookiecutterDict);
        } else {
          cookiecutterDict[key] = await readUserYesNo(key, raw, prompts, prefix);
        }
      } else if (typeof raw !== 'object') {
        // Regular variable
        let val = renderVariable(env, raw, cookiecutterDict);
        if (!noInput) {
          val = await readUserVariable(key, val, prompts, prefix);
        }
        cookiecutterDict[key] = val;
      }
    } catch (err: any) {
      if (err.name === 'Template render error' || err.message?.includes('not defined')) {
        const msg = `Unable to render variable '${key}'`;
        throw new UndefinedVariableInTemplateError(msg, err, context);
      }
      throw err;
    }
  }

  // Second pass: handle the dictionaries
  for (const [key, raw] of Object.entries(context.biscuitcutter)) {
    if (key.startsWith('_') && !key.startsWith('__')) {
      continue;
    }

    try {
      if (typeof raw === 'object' && !Array.isArray(raw) && raw !== null) {
        count++;
        const prefix = `  [${count}/${size}] `;
        let val = renderVariable(env, raw, cookiecutterDict);

        if (!noInput && !key.startsWith('__')) {
          val = await readUserDict(key, val, prompts, prefix);
        }

        cookiecutterDict[key] = val;
      }
    } catch (err: any) {
      if (err.name === 'Template render error' || err.message?.includes('not defined')) {
        const msg = `Unable to render variable '${key}'`;
        throw new UndefinedVariableInTemplateError(msg, err, context);
      }
      throw err;
    }
  }

  return cookiecutterDict;
}

/**
 * Prompt user to select the nested template to use.
 */
export async function chooseNestedTemplate(
  context: Record<string, any>,
  repoDir: string,
  noInput: boolean = false,
): Promise<string> {
  const cookiecutterDict: Record<string, any> = {};
  const env = createEnvWithContext(context);
  const prompts = context.biscuitcutter.__prompts__ || {};
  delete context.biscuitcutter.__prompts__;

  const key = 'templates';
  const config = context.biscuitcutter[key];
  let template: string;

  if (config && typeof config === 'object' && !Array.isArray(config)) {
    // New style
    const val = await promptChoiceForTemplate(key, config, noInput);
    template = config[val].path;
  } else {
    // Old style
    const oldKey = 'template';
    const oldConfig = context.biscuitcutter[oldKey] || [];
    const val = await promptChoiceForConfig(cookiecutterDict, env, oldKey, oldConfig, noInput, prompts, '');
    const match = String(val).match(/\((.+)\)/);
    template = match ? match[1] : '';
  }

  if (!template || path.isAbsolute(template)) {
    throw new Error('Illegal template path');
  }

  const resolvedRepoDir = path.resolve(repoDir);
  const templatePath = path.resolve(resolvedRepoDir, template);
  return templatePath;
}

/**
 * Ask user if it's okay to delete the previously-downloaded file/directory.
 * If yes, delete it. If no, checks to see if the old version should be reused.
 */
export async function promptAndDelete(
  filePath: string,
  noInput: boolean = false,
): Promise<boolean> {
  if (noInput) {
    if (fs.statSync(filePath).isDirectory()) {
      rmtree(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
    return true;
  }

  const question = `You've downloaded ${filePath} before. Is it okay to delete and re-download it?`;
  const okToDelete = await readUserYesNo(question, true);

  if (okToDelete) {
    if (fs.statSync(filePath).isDirectory()) {
      rmtree(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
    return true;
  }

  const okToReuse = await readUserYesNo(
    'Do you want to re-use the existing version?',
    true,
  );

  if (okToReuse) {
    return false;
  }

  process.exit(0);
  return false; // unreachable but satisfies TS
}

/**
 * Process a boolean response from a string (similar to Python's YesNoPrompt).
 */
export function processYesNoResponse(value: string): boolean {
  const lowered = value.trim().toLowerCase();
  if (YES_VALUES.has(lowered)) return true;
  if (NO_VALUES.has(lowered)) return false;
  throw new Error(`"${value}" is not a valid yes/no response`);
}
