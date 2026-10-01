/**
 * Types for replay fixtures extracted from BizTalk tracking data.
 *
 * @module stages/validation/types
 */

export interface ValidationCase {
    readonly id: string;
    readonly sourceArtifactId: string;
    readonly input: unknown;
    readonly expectedOutput: unknown;
    readonly capturedAt: string;
    readonly correlationId: string;
    readonly source: 'tracking-db' | 'message-box';
}

export interface ValidationRedactionRule {
    /** Dot-delimited field name or wildcard segment, for example headers.Authorization */
    readonly path: string;
    /** Replacement value after redaction */
    readonly replacement?: string;
}

export interface ValidationFixtureOptions {
    readonly batchSize?: number;
    readonly redactionRules?: ValidationRedactionRule[];
    readonly maxBodyBytes?: number;
}

export interface BizTalkTrackingConnection {
    readonly server: string;
    readonly database: string;
    /** Read-only query returning a compact JSON array of TrackingMessageRow objects. */
    readonly messageQuery: string;
    readonly timeoutSeconds?: number;
    readonly batchSize?: number;
}

export interface TrackingMessageRow {
    readonly sourceArtifactId: string;
    readonly correlationId: string;
    readonly direction: 'input' | 'output';
    readonly body: unknown;
    readonly capturedAt: string;
    readonly source?: 'tracking-db' | 'message-box';
}

export interface LogicAppReplayTarget {
    readonly url: string;
    readonly headers?: Record<string, string>;
    readonly timeoutMs?: number;
}

export interface ReplayResult {
    readonly validationCaseId: string;
    readonly actualOutput?: unknown;
    readonly status: 'completed' | 'failed';
    readonly durationMs: number;
    readonly error?: string;
}

export interface OutputDiffOptions {
    readonly ignoredPaths?: string[];
    readonly ignoreTimestamps?: boolean;
    readonly ignoreGuids?: boolean;
    readonly ignoreCorrelationIds?: boolean;
}

export interface OutputDifference {
    readonly path: string;
    readonly expected: unknown;
    readonly actual: unknown;
    readonly kind: 'added' | 'removed' | 'changed';
}

export interface OutputDiffResult {
    readonly equal: boolean;
    readonly differences: OutputDifference[];
}

export interface ValidationCaseReport {
    readonly validationCaseId: string;
    readonly sourceArtifactId: string;
    readonly replay: ReplayResult;
    readonly diff?: OutputDiffResult;
    readonly passed: boolean;
}

export interface ValidationReport {
    readonly target: string;
    readonly generatedAt: string;
    readonly totalCases: number;
    readonly passedCases: number;
    readonly failedCases: number;
    readonly cases: ValidationCaseReport[];
}
