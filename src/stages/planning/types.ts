/**
 * Planning Stage Types
 *
 * Type definitions for the Planning stage.
 *
 * @module stages/planning/types
 */

import { ComplexityLevel } from '../../ir/types/common';

// =============================================================================
// Flow Selection Types
// =============================================================================

/**
 * A discovered flow available for planning.
 * Derived from discovery inventory + flow group data.
 */
export interface PlanningFlow {
    /** Unique flow ID (matches inventory item or flow group ID) */
    readonly id: string;

    /** Display name */
    readonly name: string;

    /** Description of the flow */
    readonly description: string;

    /** Category of flow */
    readonly category: string;

    /** Number of artifacts in this flow */
    readonly artifactCount: number;

    /** IDs of artifacts belonging to this flow */
    readonly artifactIds: string[];

    /** Complexity level if assessed */
    readonly complexity?: ComplexityLevel;

    /** Planning status for this flow */
    status: PlanningFlowStatus;
}

/**
 * Planning status for a flow.
 */
export type PlanningFlowStatus = 'not-started' | 'in-progress' | 'planned' | 'approved';

// =============================================================================
// Migration Plan Types
// =============================================================================

/**
 * Generated migration plan for a single flow.
 */
export interface FlowMigrationPlan {
    /** Flow ID this plan belongs to */
    readonly flowId: string;

    /** Flow name */
    readonly flowName: string;

    /** When the plan was generated */
    readonly generatedAt: string;

    /** Complexity assessment */
    readonly complexity: ComplexityAssessment;

    /** Detected patterns */
    readonly patterns: DetectedPattern[];

    /** Connector mappings */
    readonly connectorMappings: ConnectorMapping[];

    /** Action mappings */
    readonly actionMappings: ActionMapping[];

    /** Identified gaps */
    readonly gaps: MigrationGap[];

    /** Effort estimation */
    readonly effortEstimate: EffortEstimate;

    /** Migration wave assignment */
    readonly wave?: number;

    /** Summary / notes */
    readonly summary: string;
}

/**
 * Complexity assessment for a flow.
 */
export interface ComplexityAssessment {
    /** Overall score (0-100) */
    readonly score: number;

    /** Complexity level */
    readonly level: ComplexityLevel;

    /** Breakdown by factor */
    readonly factors: ComplexityFactor[];
}

/**
 * Individual complexity factor.
 */
export interface ComplexityFactor {
    /** Factor name */
    readonly name: string;

    /** Factor weight (0-1) */
    readonly weight: number;

    /** Factor score (0-100) */
    readonly score: number;

    /** Description */
    readonly description: string;
}

/**
 * Detected Enterprise Integration Pattern.
 */
export interface DetectedPattern {
    /** Pattern name */
    readonly name: string;

    /** Pattern category */
    readonly category: string;

    /** Description */
    readonly description: string;

    /** Logic Apps equivalent */
    readonly logicAppsEquivalent: string;

    /** Mapping confidence */
    readonly confidence: 'high' | 'medium' | 'low';
}

/**
 * Connector mapping: source adapter → Logic Apps connector.
 */
export interface ConnectorMapping {
    /** Source adapter/connector name */
    readonly sourceConnector: string;

    /** Logic Apps connector name */
    readonly targetConnector: string;

    /** Mapping type */
    readonly mappingType: 'direct' | 'adapted' | 'gap';

    /** Notes */
    readonly notes?: string;
}

/**
 * Action mapping: source shape → Logic Apps action.
 */
export interface ActionMapping {
    /** Source action/shape name */
    readonly sourceAction: string;

    /** Logic Apps action */
    readonly targetAction: string;

    /** Mapping type */
    readonly mappingType: 'direct' | 'adapted' | 'gap';

    /** Notes */
    readonly notes?: string;
}

/**
 * Migration gap requiring attention.
 */
export interface MigrationGap {
    /** Gap ID */
    readonly id: string;

    /** Component with the gap */
    readonly component: string;

    /** Gap description */
    readonly description: string;

    /** Severity */
    readonly severity: 'high' | 'medium' | 'low';

    /** Resolution strategy */
    resolution?: GapResolution;
}

/**
 * Resolution strategy for a gap.
 */
export interface GapResolution {
    /** Strategy type */
    readonly strategy:
        | 'azure-function'
        | 'custom-connector'
        | 'alternative-pattern'
        | 'manual'
        | 'skip';

    /** Description of the resolution */
    readonly description: string;

    /** Effort to implement */
    readonly additionalEffortHours?: number;
}

/**
 * Effort estimation for a flow migration.
 */
export interface EffortEstimate {
    /** Total estimated hours */
    readonly totalHours: number;

    /** Breakdown by phase */
    readonly breakdown: {
        readonly analysis: number;
        readonly conversion: number;
        readonly testing: number;
        readonly deployment: number;
    };

    /** Confidence level */
    readonly confidence: 'high' | 'medium' | 'low';
}

// =============================================================================
// Planning Stage State
// =============================================================================

/**
 * Complete state for the planning stage.
 */
export interface PlanningStageState {
    /** All flows available for planning */
    readonly flows: PlanningFlow[];

    /** Generated plans keyed by flow ID */
    readonly plans: Record<string, FlowMigrationPlan>;

    /** Currently selected flow ID */
    selectedFlowId?: string;

    /** When planning started */
    readonly startedAt: string;

    /** When last updated */
    updatedAt: string;
}
