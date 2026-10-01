/**
 * Aggregates replay and diff results into a validation report.
 *
 * @module stages/validation/ValidationReportService
 */

import { OutputDiffOptions, ValidationCase, ValidationCaseReport, ValidationReport, ReplayResult } from './types';
import { OutputDiffService } from './OutputDiffService';

export class ValidationReportService {
    private readonly diffService = new OutputDiffService();

    public buildReport(
        target: string,
        validationCases: ValidationCase[],
        replayResults: ReplayResult[],
        options: OutputDiffOptions = {}
    ): ValidationReport {
        const replayByCase = new Map(replayResults.map((result) => [result.validationCaseId, result]));
        const cases: ValidationCaseReport[] = validationCases.map((validationCase) => {
            const replay = replayByCase.get(validationCase.id) ?? {
                validationCaseId: validationCase.id,
                status: 'failed' as const,
                durationMs: 0,
                error: 'No replay result was returned.',
            };
            const diff = replay.status === 'completed'
                ? this.diffService.compare(validationCase.expectedOutput, replay.actualOutput, options)
                : undefined;
            return {
                validationCaseId: validationCase.id,
                sourceArtifactId: validationCase.sourceArtifactId,
                replay,
                ...(diff ? { diff } : {}),
                passed: replay.status === 'completed' && diff?.equal === true,
            };
        });
        const passedCases = cases.filter((item) => item.passed).length;
        return {
            target,
            generatedAt: new Date().toISOString(),
            totalCases: cases.length,
            passedCases,
            failedCases: cases.length - passedCases,
            cases,
        };
    }
}
