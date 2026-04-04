import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { check, update } from '../../src/core/tracking';
import * as gitUtils from '../../src/utils/git';

vi.mock('../../src/utils/git', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/git')>();
  return {
    ...actual,
    cloneRepo: vi.fn(),
    isRepoClean: vi.fn().mockReturnValue(true),
    getLatestCommit: vi.fn().mockReturnValue('mock-latest-hash'),
    isProjectUpdated: vi.fn().mockReturnValue(true),
  };
});

describe('Tracking Commands - Template Abbreviations regression', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-abbrev-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should properly expand abbreviations from the state file during check', async () => {
    const stateFile = path.join(tempDir, '.biscuitcutter.json');
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        template: 'gh:myorg/myrepo',
        commit: 'mock-old-hash',
        checkout: null,
        context: {},
        directory: null,
      }),
      'utf-8',
    );

    await check({ projectDir: tempDir });

    // Ensure cloneRepo was called with the expanded https://github... URL
    expect(gitUtils.cloneRepo).toHaveBeenCalledWith(
      'https://github.com/myorg/myrepo.git',
      expect.any(String),
      null,
      true,
    );
  });

  it('should properly expand abbreviations from the state file during update', async () => {
    const stateFile = path.join(tempDir, '.biscuitcutter.json');
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        template: 'gh:myorg/myrepo',
        commit: 'mock-old-hash',
        checkout: null,
        context: {},
        directory: null,
      }),
      'utf-8',
    );

    vi.mocked(gitUtils.isProjectUpdated).mockReturnValueOnce(false); // Force update to proceed

    // We mock prompt to auto skip or return so update doesn't block
    vi.mock('inquirer', () => ({
      default: {
        prompt: vi.fn().mockResolvedValue({ action: 's' }),
      },
    }));

    try {
      await update({ projectDir: tempDir, skipApplyAsk: true });
    } catch (e) {
      // Ignored if further steps fail due to missing actual git repo in mock
    }

    // Ensure cloneRepo was called with the expanded URL
    expect(gitUtils.cloneRepo).toHaveBeenCalledWith(
      'https://github.com/myorg/myrepo.git',
      expect.any(String),
      null,
    );
  });
});
