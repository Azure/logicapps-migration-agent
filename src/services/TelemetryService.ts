/**
 * Telemetry Service
 *
 * Provides anonymous usage telemetry using @vscode/extension-telemetry.
 * Respects user privacy settings and VS Code telemetry configuration.
 */

import * as vscode from 'vscode';
import { TelemetryReporter } from '@vscode/extension-telemetry';
import { LoggingService } from './LoggingService';

/**
 * Telemetry event properties
 */
type TelemetryProperties = Record<string, string>;

/**
 * Telemetry event measurements
 */
type TelemetryMeasurements = Record<string, number>;

/**
 * Singleton telemetry service
 */
export class TelemetryService implements vscode.Disposable {
    private static instance: TelemetryService | undefined;
    private reporter: TelemetryReporter | undefined;

    // Maximum length of a single telemetry property value (App Insights caps at ~8KB;
    // we keep well under that to leave room for redaction markers and other properties).
    private static readonly MAX_PROPERTY_LENGTH = 2048;

    // Cross-turn step timers (key -> start epoch ms), used by startTimer/endTimer.
    private readonly timers = new Map<string, number>();

    // Correlation id for the current migration session. Set by StateManager
    // (generated once per migration, regenerated on reset) and stamped onto
    // every telemetry event so all events for one folder's migration correlate
    // together in Kusto.
    private migrationId: string | undefined;

    // The literal placeholder the CI pipelines find-and-replace with the real
    // Application Insights key. Assembled from fragments so this comparison copy is
    // NOT itself rewritten by that find/replace (which targets 'setInGitHubBuild').
    private static readonly PLACEHOLDER = 'setIn' + 'GitHub' + 'Build';

    // Application Insights instrumentation key.
    // The 'setInGitHubBuild' placeholder below is replaced at build time by the CI
    // pipelines (.github/workflows/version-release.yml and
    // .azure-pipelines/templates/build.yml) with the bare instrumentation key from
    // the AI_KEY CI variable. In local/dev builds it stays as the placeholder; for
    // local testing you can supply an instrumentation key at runtime via the
    // LOGICAPPS_MIGRATION_AI_KEY environment variable
    // (see .vscode/launch.json -> envFile -> .env.local).
    // Note: TelemetryReporter also accepts a full connection string here, but we
    // standardize on the bare key so local matches the CI build exactly.
    private readonly telemetryKey: string = 'setInGitHubBuild';

    private constructor() {}

    /**
     * Get the singleton instance
     */
    public static getInstance(): TelemetryService {
        if (!TelemetryService.instance) {
            TelemetryService.instance = new TelemetryService();
        }
        return TelemetryService.instance;
    }

    /**
     * Initialize the telemetry service
     */
    public initialize(context: vscode.ExtensionContext): void {
        // Resolve the telemetry key: the build-time injected value, or — for
        // local F5/dev testing where the placeholder is not replaced — the
        // LOGICAPPS_MIGRATION_AI_KEY environment variable.
        const telemetryKey = this.resolveTelemetryKey();

        // Telemetry is always on — there is no extension-level opt-out. The
        // reporter still honors VS Code's global `telemetry.telemetryLevel`
        // internally (it stops sending when the user disables telemetry
        // globally), so the user's global choice is always respected. All we
        // need here is a real instrumentation key (injected at build time, or
        // supplied locally via LOGICAPPS_MIGRATION_AI_KEY).
        if (telemetryKey) {
            try {
                this.reporter = new TelemetryReporter(telemetryKey);
                context.subscriptions.push(this.reporter);
                LoggingService.getInstance().debug('Telemetry service initialized');
            } catch (error) {
                LoggingService.getInstance().warn('Failed to initialize telemetry reporter', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        } else {
            LoggingService.getInstance().debug(
                'Telemetry disabled (no instrumentation key configured)'
            );
        }
    }

    /**
     * Resolve the effective Application Insights instrumentation key.
     *
     * Production builds have the 'setInGitHubBuild' placeholder replaced at build
     * time by the CI pipelines. For LOCAL testing (running the extension via F5,
     * where the placeholder is NOT replaced), fall back to the
     * LOGICAPPS_MIGRATION_AI_KEY environment variable — typically supplied through
     * .vscode/launch.json (`envFile` -> .env.local).
     */
    private resolveTelemetryKey(): string {
        // If the build-time placeholder was replaced with a real key, use it.
        if (this.telemetryKey !== TelemetryService.PLACEHOLDER) {
            return this.telemetryKey;
        }
        // Local/dev fallback for telemetry testing under F5.
        return process.env.LOGICAPPS_MIGRATION_AI_KEY?.trim() ?? '';
    }

    /**
     * Start a named timer for measuring step duration across turns.
     * Use with endTimer(key) to obtain the elapsed milliseconds. Useful when a
     * step starts in one place (e.g. a command handler) and completes in another
     * (e.g. an LM tool invocation in a later turn).
     */
    public startTimer(key: string): void {
        this.timers.set(key, Date.now());
    }

    /**
     * End a named timer and return elapsed milliseconds, or undefined if the
     * timer was never started (e.g. across an extension reload).
     */
    public endTimer(key: string): number | undefined {
        const start = this.timers.get(key);
        if (start === undefined) {
            return undefined;
        }
        this.timers.delete(key);
        return Date.now() - start;
    }

    /**
     * Set the correlation id for the current migration session. Stamped onto
     * every subsequent telemetry event, error and log as a common `migrationId`
     * dimension. Called by StateManager on initialize and reset.
     */
    public setMigrationId(migrationId: string | undefined): void {
        this.migrationId = migrationId;
    }

    /**
     * Merge the common migration session dimension into a property bag.
     */
    private withCommonProperties(properties?: TelemetryProperties): TelemetryProperties {
        const merged: TelemetryProperties = { ...properties };
        if (this.migrationId) {
            merged.migrationId = this.migrationId;
        }
        return merged;
    }

    /**
     * Log a migration lifecycle step as BOTH a readable info log (output channel)
     * and a structured telemetry event (metric). String/boolean fields become
     * event properties; numeric fields become measurements.
     */
    public logStep(
        event: string,
        data?: Record<string, string | number | boolean | undefined>
    ): void {
        const properties: TelemetryProperties = {};
        const measurements: TelemetryMeasurements = {};
        const readableParts: string[] = [];

        if (data) {
            for (const [key, value] of Object.entries(data)) {
                if (value === undefined) {
                    continue;
                }
                readableParts.push(`${key}=${value}`);
                if (typeof value === 'number') {
                    measurements[key] = value;
                } else {
                    properties[key] = String(value);
                }
            }
        }

        const message =
            readableParts.length > 0
                ? `[Migration] ${event} (${readableParts.join(', ')})`
                : `[Migration] ${event}`;
        LoggingService.getInstance().info(message);

        this.sendEvent(event, properties, measurements);
    }

    /**
     * Send a telemetry event
     */
    public sendEvent(
        eventName: string,
        properties?: TelemetryProperties,
        measurements?: TelemetryMeasurements
    ): void {
        if (!this.reporter) {
            return;
        }

        try {
            this.reporter.sendTelemetryEvent(
                eventName,
                this.withCommonProperties(properties),
                measurements
            );
        } catch (error) {
            // Silently fail telemetry - should not impact user experience
            LoggingService.getInstance().debug('Failed to send telemetry event', {
                eventName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Send an error telemetry event
     */
    public sendError(
        error: Error,
        properties?: TelemetryProperties,
        measurements?: TelemetryMeasurements
    ): void {
        if (!this.reporter) {
            return;
        }

        try {
            this.reporter.sendTelemetryErrorEvent(
                'error',
                this.withCommonProperties({
                    ...properties,
                    errorName: error.name,
                    errorMessage: error.message,
                }),
                measurements
            );
        } catch (err) {
            // Silently fail telemetry
            LoggingService.getInstance().debug('Failed to send telemetry error', {
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    }

    /**
     * Forward a log entry to Application Insights as a trace event.
     *
     * Called by LoggingService for error-level logs only, so error diagnostics
     * flow to Kusto (via App Insights). Sensitive data (absolute file paths,
     * user home directories) is redacted and values are size-capped before
     * sending. Errors are swallowed silently and this method never calls back
     * into LoggingService, to avoid a logging <-> telemetry recursion loop.
     */
    public sendLog(
        level: string,
        message: string,
        metadata?: Record<string, string | number | boolean | undefined>
    ): void {
        if (!this.reporter) {
            return;
        }

        const properties: TelemetryProperties = {
            level,
            message: this.redactAndCap(message),
        };
        if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
                if (value !== undefined) {
                    const str = typeof value === 'string' ? value : String(value);
                    properties[key] = this.redactAndCap(str);
                }
            }
        }

        try {
            this.reporter.sendTelemetryEvent('log', this.withCommonProperties(properties));
        } catch {
            // Swallow silently to avoid recursion with LoggingService.
        }
    }

    /**
     * Strip potentially sensitive data (absolute file paths, user home
     * directories) from a string before it leaves the machine. The file name
     * (and any trailing :line:col from stack frames) is kept; the directory
     * portion is dropped.
     */
    private redact(value: string): string {
        return (
            value
                // Windows drive paths: C:\Users\me\proj\file.ts -> file.ts (also stack frames)
                .replace(/[A-Za-z]:\\(?:[^\\\s"'<>|()]+\\)*([^\\\s"'<>|()]+)/g, '$1')
                // UNC paths: \\server\share\dir\file -> file
                .replace(/\\\\(?:[^\\\s"'<>|()]+\\)*([^\\\s"'<>|()]+)/g, '$1')
                // file:// URIs: file:///c:/Users/me/file.ts -> file.ts
                .replace(/file:\/\/\/?\S*\/([^/\s"'<>|()]+)/gi, '$1')
                // POSIX home/user paths: /Users/me/proj/file.ts -> file.ts
                .replace(
                    /\/(?:Users|home|root|private\/var|var\/folders)\/[^\s"'<>|()]*\/([^/\s"'<>|()]+)/g,
                    '$1'
                )
        );
    }

    /**
     * Redact a value and cap its length so a single property cannot blow past
     * the Application Insights per-property limit.
     */
    private redactAndCap(value: string): string {
        const redacted = this.redact(value);
        return redacted.length > TelemetryService.MAX_PROPERTY_LENGTH
            ? `${redacted.slice(0, TelemetryService.MAX_PROPERTY_LENGTH)}…[truncated]`
            : redacted;
    }

    /**
     * Dispose the telemetry service
     */
    public dispose(): void {
        this.reporter?.dispose();
        TelemetryService.instance = undefined;
    }
}
