import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSemver, compareVersions, isUpdateAvailable } from '../src/utils/semver.ts';

test('Semver: parseSemver correctly parses version strings', () => {
  assert.deepEqual(parseSemver('1.0.4'), [1, 0, 4]);
  assert.deepEqual(parseSemver('v1.0.10'), [1, 0, 10]);
  assert.deepEqual(parseSemver('V2.5.0-beta.1'), [2, 5, 0]);
  assert.deepEqual(parseSemver('3.1'), [3, 1, 0]);
  assert.deepEqual(parseSemver('4'), [4, 0, 0]);
  assert.deepEqual(parseSemver(''), [0, 0, 0]);
  assert.deepEqual(parseSemver(null as any), [0, 0, 0]);
  assert.deepEqual(parseSemver(undefined as any), [0, 0, 0]);
});

test('Semver: compareVersions performs strict numerical segment comparison', () => {
  // CRITICAL: Numerical vs Lexical: "1.0.10" MUST be greater than "1.0.9" (in lexical comparison "1.0.10" < "1.0.9")
  assert.equal(compareVersions('1.0.10', '1.0.9'), 1, '1.0.10 must be strictly greater than 1.0.9');
  assert.equal(compareVersions('1.0.9', '1.0.10'), -1, '1.0.9 must be strictly less than 1.0.10');

  // Major version differences
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.9.9', '2.0.0'), -1);

  // Minor version differences
  assert.equal(compareVersions('1.2.0', '1.1.99'), 1);
  assert.equal(compareVersions('1.1.0', '1.2.0'), -1);

  // Patch version differences
  assert.equal(compareVersions('1.0.5', '1.0.4'), 1);
  assert.equal(compareVersions('1.0.4', '1.0.5'), -1);

  // Equal versions
  assert.equal(compareVersions('1.0.4', '1.0.4'), 0);
  assert.equal(compareVersions('v1.0.4', '1.0.4'), 0);
  assert.equal(compareVersions('1.0.4-release', '1.0.4'), 0);
});

test('Semver: isUpdateAvailable correctly gates updates', () => {
  // Newer version available
  assert.equal(isUpdateAvailable('1.0.5', '1.0.4'), true);
  assert.equal(isUpdateAvailable('1.0.10', '1.0.9'), true);
  assert.equal(isUpdateAvailable('2.0.0', '1.0.4'), true);

  // Current is equal to latest
  assert.equal(isUpdateAvailable('1.0.4', '1.0.4'), false);
  assert.equal(isUpdateAvailable('v1.0.4', '1.0.4'), false);

  // Current is ahead of latest (dev / prerelease)
  assert.equal(isUpdateAvailable('1.0.3', '1.0.4'), false);
  assert.equal(isUpdateAvailable('1.0.4', '1.0.5'), false);

  // Edge cases: null or empty
  assert.equal(isUpdateAvailable(null, '1.0.4'), false);
  assert.equal(isUpdateAvailable('', '1.0.4'), false);
  assert.equal(isUpdateAvailable('1.0.5', null), true);
});
