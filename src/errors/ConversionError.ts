/**
 * Conversion Error
 *
 * Errors that occur during conversion of source artifacts to target format.
 */

import { ErrorCode, ErrorCodes } from './ErrorCodes';
import { MigrationError } from './MigrationError';

/**
 * Error thrown when conversion fails
 */
export class ConversionError extends MigrationError {
    /** The source artifact being converted */
    public readonly sourceArtifact?: string;

    /** The target artifact type */
    public readonly targetType?: string;

    /** The feature or element that failed to convert */
    public readonly failedElement?: string;

    constructor(options: {
        code?: ErrorCode;
        message: string;
        userMessage?: string;
        suggestion?: string;
        innerError?: Error;
        sourceArtifact?: string;
        targetType?: string;
        failedElement?: string;
    }) {
        super({
            code: options.code ?? ErrorCodes.CONVERSION_ERROR,
            message: options.message,
            userMessage: options.userMessage ?? 'Conversion failed.',
            suggestion:
                options.suggestion ??
                'Review the source artifact and check for unsupported features.',
            innerError: options.innerError,
            context: {
                sourceArtifact: options.sourceArtifact,
                targetType: options.targetType,
                failedElement: options.failedElement,
            },
        });

        this.name = 'ConversionError';
        this.sourceArtifact = options.sourceArtifact;
        this.targetType = options.targetType;
        this.failedElement = options.failedElement;
    }

    /**
     * Create an unsupported feature error
     */
    public static unsupportedFeature(
        feature: string,
        sourceArtifact?: string,
        alternative?: string
    ): ConversionError {
        const suggestion = alternative
            ? `Consider using ${alternative} as an alternative.`
            : 'An Azure Function may be needed to implement this feature.';

        return new ConversionError({
            code: ErrorCodes.CONVERSION_UNSUPPORTED_FEATURE,
            message: `Unsupported feature: ${feature}`,
            userMessage: `The feature "${feature}" is not directly supported in Logic Apps.`,
            suggestion,
            sourceArtifact,
            failedElement: feature,
        });
    }

    /**
     * Create a map conversion error
     */
    public static mapFailed(
        mapName: string,
        reason: string,
        sourceArtifact?: string
    ): ConversionError {
        return new ConversionError({
            code: ErrorCodes.CONVERSION_MAP_FAILED,
            message: `Map conversion failed: ${mapName}`,
            userMessage: `Failed to convert map "${mapName}": ${reason}`,
            suggestion: 'Review the map and check for unsupported functoids or complex logic.',
            sourceArtifact,
            targetType: 'xslt',
            failedElement: mapName,
        });
    }

    /**
     * Create an expression conversion error
     */
    public static expressionFailed(
        expression: string,
        reason: string,
        sourceArtifact?: string
    ): ConversionError {
        return new ConversionError({
            code: ErrorCodes.CONVERSION_EXPRESSION_FAILED,
            message: `Expression conversion failed: ${expression}`,
            userMessage: `Failed to convert expression: ${reason}`,
            suggestion: 'Manually translate the expression to Logic Apps expression syntax.',
            sourceArtifact,
            targetType: 'expression',
            failedElement: expression,
        });
    }

    /**
     * Create a workflow conversion error
     */
    public static workflowFailed(
        workflowName: string,
        reason: string,
        sourceArtifact?: string
    ): ConversionError {
        return new ConversionError({
            code: ErrorCodes.CONVERSION_WORKFLOW_FAILED,
            message: `Workflow conversion failed: ${workflowName}`,
            userMessage: `Failed to generate workflow for "${workflowName}": ${reason}`,
            suggestion: 'Check the source orchestration for unsupported patterns.',
            sourceArtifact,
            targetType: 'workflow.json',
            failedElement: workflowName,
        });
    }
}
