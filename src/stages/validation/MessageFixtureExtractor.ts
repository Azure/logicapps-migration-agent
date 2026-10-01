/**
 * Extracts tracked BizTalk input/output messages using a caller-supplied,
 * version-specific, read-only SQL projection.
 *
 * @module stages/validation/MessageFixtureExtractor
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { LoggingService } from '../../services/LoggingService';
import {
    BizTalkTrackingConnection,
    TrackingMessageRow,
    ValidationCase,
    ValidationFixtureOptions,
    ValidationRedactionRule,
} from './types';

const execFileAsync = promisify(execFile);

export class MessageFixtureExtractor {
    private readonly logger = LoggingService.getInstance();

    public async extract(
        connection: BizTalkTrackingConnection,
        options: ValidationFixtureOptions = {}
    ): Promise<ValidationCase[]> {
        this.validateConnection(connection);
        const batchSize = options.batchSize ?? connection.batchSize ?? 100;
        if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
            throw new Error('Validation fixture batchSize must be between 1 and 1000.');
        }

        const result = await execFileAsync(
            'sqlcmd',
            [
                '-S', connection.server,
                '-d', connection.database,
                '-E',
                '-b',
                '-l', String(connection.timeoutSeconds ?? 60),
                '-h', '-1',
                '-W',
                '-w', '65535',
                '-Q', connection.messageQuery.replaceAll('{{BATCH_SIZE}}', String(batchSize)).trim(),
            ],
            { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }
        );

        const rows = this.parseRows(result.stdout.trim());
        const redactedRows = rows.map((row) => ({
            ...row,
            body: this.redact(this.limitBody(row.body, options.maxBodyBytes), options.redactionRules ?? []),
        }));
        const cases = this.correlate(redactedRows);

        this.logger.info('Extracted BizTalk validation fixtures', {
            rows: rows.length,
            cases: cases.length,
            database: connection.database,
        });
        return cases;
    }

    private validateConnection(connection: BizTalkTrackingConnection): void {
        if (!connection.server.trim() || !connection.database.trim()) {
            throw new Error('BizTalk tracking SQL server and database are required.');
        }
        if (!connection.messageQuery.trim() || /\bselect\s+\*/i.test(connection.messageQuery)) {
            throw new Error('Tracking projection is required and must not use SELECT *.');
        }
    }

    private parseRows(output: string): TrackingMessageRow[] {
        if (!output) {
            return [];
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(output);
        } catch (error) {
            throw new Error(`Tracking projection returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!Array.isArray(parsed)) {
            throw new Error('Tracking projection must return a JSON array.');
        }
        return parsed.map((value, index) => {
            if (!this.isTrackingRow(value)) {
                throw new Error(`Invalid tracking message row at index ${index}.`);
            }
            return value;
        });
    }

    private isTrackingRow(value: unknown): value is TrackingMessageRow {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const row = value as Record<string, unknown>;
        return typeof row.sourceArtifactId === 'string' &&
            typeof row.correlationId === 'string' &&
            (row.direction === 'input' || row.direction === 'output') &&
            typeof row.capturedAt === 'string' &&
            'body' in row;
    }

    private correlate(rows: TrackingMessageRow[]): ValidationCase[] {
        const groups = new Map<string, TrackingMessageRow[]>();
        for (const row of rows) {
            const key = `${row.sourceArtifactId}\u0000${row.correlationId}`;
            const group = groups.get(key) ?? [];
            group.push(row);
            groups.set(key, group);
        }

        const cases: ValidationCase[] = [];
        for (const [key, group] of groups) {
            const inputs = group.filter((row) => row.direction === 'input');
            const outputs = group.filter((row) => row.direction === 'output');
            const count = Math.min(inputs.length, outputs.length);
            const separator = key.indexOf('\u0000');
            const sourceArtifactId = key.slice(0, separator);
            const correlationId = key.slice(separator + 1);
            for (let index = 0; index < count; index++) {
                const input = inputs[index];
                const output = outputs[index];
                cases.push({
                    id: `${sourceArtifactId}:${correlationId}:${index}`,
                    sourceArtifactId,
                    input: input.body,
                    expectedOutput: output.body,
                    capturedAt: output.capturedAt,
                    correlationId,
                    source: output.source ?? input.source ?? 'tracking-db',
                });
            }
        }
        return cases;
    }

    private limitBody(body: unknown, maxBodyBytes = 4 * 1024 * 1024): unknown {
        if (typeof body !== 'string' || Buffer.byteLength(body, 'utf8') <= maxBodyBytes) {
            return body;
        }
        throw new Error(`Tracked message body exceeds the ${maxBodyBytes}-byte validation limit.`);
    }

    private redact(value: unknown, rules: ValidationRedactionRule[], path = ''): unknown {
        const rule = rules.find((candidate) => this.matches(candidate.path, path));
        if (rule) {
            return rule.replacement ?? '[REDACTED]';
        }
        if (typeof value === 'string' && path === '') {
            try {
                return this.redact(JSON.parse(value), rules);
            } catch {
                return value;
            }
        }
        if (Array.isArray(value)) {
            return value.map((item, index) => this.redact(item, rules, `${path}[${index}]`));
        }
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [
                key,
                this.redact(item, rules, path ? `${path}.${key}` : key),
            ]));
        }
        return value;
    }

    private matches(rulePath: string, valuePath: string): boolean {
        const rule = rulePath.split('.');
        const value = valuePath.replace(/\[\d+\]/g, '[]').split('.');
        return rule.length === value.length && rule.every((segment, index) =>
            segment === '*' || segment === value[index]
        );
    }
}
