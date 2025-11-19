import { describe, expect, test } from 'vitest';
import { resolveBasePath } from '../src/utils/resolveBasePath.js';

describe('resolveBasePath', () => {
    test('returns trimmed env base when provided', () => {
        expect(resolveBasePath({ rawBase: '/NFTMonitoring/' })).toBe('/NFTMonitoring');
    });

    test('falls back to GitHub project base when BASE_URL is relative', () => {
        const location = {
            hostname: 'bahramali.github.io',
            pathname: '/NFTMonitoring/overview',
        };
        expect(resolveBasePath({ rawBase: './', location })).toBe('/NFTMonitoring');
    });

    test('uses root when relative base on non GitHub host', () => {
        const location = {
            hostname: 'hydroleaf.se',
            pathname: '/overview',
        };
        expect(resolveBasePath({ rawBase: './', location })).toBe('/');
    });
});
