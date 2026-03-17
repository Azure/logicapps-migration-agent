/**
 * Deployment Error
 *
 * Errors that occur during deployment to Azure.
 */

import { ErrorCode, ErrorCodes } from './ErrorCodes';
import { MigrationError } from './MigrationError';

/**
 * Error thrown when deployment fails
 */
export class DeploymentError extends MigrationError {
    /** The Azure resource type */
    public readonly resourceType?: string;

    /** The Azure resource name */
    public readonly resourceName?: string;

    /** The Azure subscription ID */
    public readonly subscriptionId?: string;

    /** The Azure resource group */
    public readonly resourceGroup?: string;

    /** The Azure deployment correlation ID */
    public readonly correlationId?: string;

    constructor(options: {
        code?: ErrorCode;
        message: string;
        userMessage?: string;
        suggestion?: string;
        innerError?: Error;
        resourceType?: string;
        resourceName?: string;
        subscriptionId?: string;
        resourceGroup?: string;
        correlationId?: string;
    }) {
        super({
            code: options.code ?? ErrorCodes.DEPLOYMENT_ERROR,
            message: options.message,
            userMessage: options.userMessage ?? 'Deployment failed.',
            suggestion:
                options.suggestion ??
                'Check your Azure credentials and resource configuration.',
            innerError: options.innerError,
            context: {
                resourceType: options.resourceType,
                resourceName: options.resourceName,
                subscriptionId: options.subscriptionId,
                resourceGroup: options.resourceGroup,
                correlationId: options.correlationId,
            },
        });

        this.name = 'DeploymentError';
        this.resourceType = options.resourceType;
        this.resourceName = options.resourceName;
        this.subscriptionId = options.subscriptionId;
        this.resourceGroup = options.resourceGroup;
        this.correlationId = options.correlationId;
    }

    /**
     * Create an authentication failed error
     */
    public static authenticationFailed(reason?: string): DeploymentError {
        return new DeploymentError({
            code: ErrorCodes.DEPLOYMENT_AUTH_FAILED,
            message: `Azure authentication failed${reason ? `: ${reason}` : ''}`,
            userMessage: 'Failed to authenticate with Azure.',
            suggestion:
                'Sign in to Azure using the Azure Account extension or check your credentials.',
        });
    }

    /**
     * Create a resource deployment failed error
     */
    public static resourceFailed(
        resourceType: string,
        resourceName: string,
        reason: string,
        options?: {
            subscriptionId?: string;
            resourceGroup?: string;
            correlationId?: string;
        }
    ): DeploymentError {
        return new DeploymentError({
            code: ErrorCodes.DEPLOYMENT_RESOURCE_FAILED,
            message: `Failed to deploy ${resourceType} "${resourceName}": ${reason}`,
            userMessage: `Failed to deploy ${resourceType} "${resourceName}".`,
            suggestion:
                'Check the Azure portal for more details or verify your permissions.',
            resourceType,
            resourceName,
            ...options,
        });
    }

    /**
     * Create a workflow deployment failed error
     */
    public static workflowFailed(
        workflowName: string,
        reason: string,
        options?: {
            subscriptionId?: string;
            resourceGroup?: string;
            correlationId?: string;
        }
    ): DeploymentError {
        return new DeploymentError({
            code: ErrorCodes.DEPLOYMENT_WORKFLOW_FAILED,
            message: `Failed to deploy workflow "${workflowName}": ${reason}`,
            userMessage: `Failed to deploy Logic App workflow "${workflowName}".`,
            suggestion: 'Verify the workflow definition is valid and try again.',
            resourceType: 'Microsoft.Web/sites/workflows',
            resourceName: workflowName,
            ...options,
        });
    }

    /**
     * Create a connection configuration failed error
     */
    public static connectionFailed(
        connectionName: string,
        reason: string
    ): DeploymentError {
        return new DeploymentError({
            code: ErrorCodes.DEPLOYMENT_CONNECTION_FAILED,
            message: `Failed to configure connection "${connectionName}": ${reason}`,
            userMessage: `Failed to configure API connection "${connectionName}".`,
            suggestion:
                'Verify the connection parameters and ensure you have the necessary permissions.',
            resourceType: 'Microsoft.Web/connections',
            resourceName: connectionName,
        });
    }

    /**
     * Create an integration account upload failed error
     */
    public static integrationAccountFailed(
        artifactType: string,
        artifactName: string,
        reason: string
    ): DeploymentError {
        return new DeploymentError({
            code: ErrorCodes.DEPLOYMENT_INTEGRATION_ACCOUNT_FAILED,
            message: `Failed to upload ${artifactType} "${artifactName}": ${reason}`,
            userMessage: `Failed to upload ${artifactType} "${artifactName}" to Integration Account.`,
            suggestion:
                'Verify the Integration Account exists and you have contributor access.',
            resourceType: `Microsoft.Logic/integrationAccounts/${artifactType}`,
            resourceName: artifactName,
        });
    }
}
