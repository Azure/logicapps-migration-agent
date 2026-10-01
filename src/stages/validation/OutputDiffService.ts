/**
 * Compares replay output with the captured BizTalk output.
 *
 * @module stages/validation/OutputDiffService
 */

import { OutputDiffOptions, OutputDiffResult } from './types';

export class OutputDiffService {
    public compare(
        expected: unknown,
        actual: unknown,
        options: OutputDiffOptions = {}
    ): OutputDiffResult {
        const differences = this.diff(
            this.normalize(expected, '', options),
            this.normalize(actual, '', options),
            '',
            options
        );
        return { equal: differences.length === 0, differences };
    }

    private normalize(value: unknown, path: string, options: OutputDiffOptions): unknown {
        if (typeof value === 'string') {
            if (options.ignoreGuids && /^[{]?[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[}]?$/i.test(value)) {
                return '[GUID]';
            }
            if (options.ignoreTimestamps && !Number.isNaN(Date.parse(value)) && value.length >= 16) {
                return '[TIMESTAMP]';
            }
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((item, index) => this.normalize(item, `${path}[${index}]`, options));
        }
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => {
                const itemPath = path ? `${path}.${key}` : key;
                if (options.ignoreCorrelationIds && /correlation(id)?|activity(id)?|instance(id)?/i.test(key)) {
                    return [key, '[CORRELATION_ID]'];
                }
                return [key, this.normalize(item, itemPath, options)];
            }));
        }
        return value;
    }

    private diff(expected: unknown, actual: unknown, path: string, options: OutputDiffOptions): OutputDiffResult['differences'] {
        if (this.isIgnored(path, options.ignoredPaths ?? [])) {
            return [];
        }
        if (Object.is(expected, actual)) {
            return [];
        }
        if (Array.isArray(expected) && Array.isArray(actual)) {
            const differences: OutputDiffResult['differences'] = [];
            const length = Math.max(expected.length, actual.length);
            for (let index = 0; index < length; index++) {
                differences.push(...this.diff(expected[index], actual[index], `${path}[${index}]`, options));
            }
            return differences;
        }
        if (expected && typeof expected === 'object' && actual && typeof actual === 'object') {
            const differences: OutputDiffResult['differences'] = [];
            const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
            for (const key of keys) {
                const childPath = path ? `${path}.${key}` : key;
                differences.push(...this.diff(
                    (expected as Record<string, unknown>)[key],
                    (actual as Record<string, unknown>)[key],
                    childPath,
                    options
                ));
            }
            return differences;
        }
        return [{
            path,
            expected,
            actual,
            kind: expected === undefined ? 'added' : actual === undefined ? 'removed' : 'changed',
        }];
    }

    private isIgnored(path: string, ignoredPaths: string[]): boolean {
        return ignoredPaths.some((pattern) => {
            const expression = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
            return expression.test(path);
        });
    }
}
