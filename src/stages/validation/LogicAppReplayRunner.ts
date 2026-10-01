/**
 * Replays validation inputs against a Logic Apps Standard HTTP trigger.
 *
 * @module stages/validation/LogicAppReplayRunner
 */

import { LoggingService } from '../../services/LoggingService';
import { LogicAppReplayTarget, ReplayResult, ValidationCase } from './types';

export class LogicAppReplayRunner {
    private readonly logger = LoggingService.getInstance();

    public async run(
        validationCase: ValidationCase,
        target: LogicAppReplayTarget
    ): Promise<ReplayResult> {
        if (!target.url.trim()) {
            throw new Error('Logic App replay URL is required.');
        }

        const startedAt = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), target.timeoutMs ?? 120_000);

        try {
            const response = await fetch(target.url, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    ...(target.headers ?? {}),
                },
                body: JSON.stringify(validationCase.input),
                signal: controller.signal,
            });
            const text = await response.text();
            const actualOutput = this.parseResponseBody(text);
            if (!response.ok) {
                return {
                    validationCaseId: validationCase.id,
                    actualOutput,
                    status: 'failed',
                    durationMs: Date.now() - startedAt,
                    error: `Logic App returned HTTP ${response.status}.`,
                };
            }
            return {
                validationCaseId: validationCase.id,
                actualOutput,
                status: 'completed',
                durationMs: Date.now() - startedAt,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn('Logic App replay failed', { validationCaseId: validationCase.id, error: message });
            return {
                validationCaseId: validationCase.id,
                status: 'failed',
                durationMs: Date.now() - startedAt,
                error: message,
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    public async runAll(
        validationCases: ValidationCase[],
        target: LogicAppReplayTarget
    ): Promise<ReplayResult[]> {
        const results: ReplayResult[] = [];
        for (const validationCase of validationCases) {
            results.push(await this.run(validationCase, target));
        }
        return results;
    }

    private parseResponseBody(body: string): unknown {
        if (!body) {
            return undefined;
        }
        try {
            return JSON.parse(body);
        } catch {
            return body;
        }
    }
}
