/**
 * Dell Boomi IR helpers
 *
 * @module parsers/boomi/BoomiIrHelpers
 */

import * as path from 'path';
import { IRConnection } from '../../ir/types/connections';
import { mapConnector } from './BoomiMappings';
import { BoomiComponentRef } from './types';

export function sanitizeId(value: string): string {
    return value.replace(/[^A-Za-z0-9_-]+/g, '_');
}

/**
 * Build an IR connection for a Boomi connection component.
 * Secrets are never copied — only the authentication mode is retained.
 */
export function boomiConnectionToIr(ref: BoomiComponentRef): IRConnection {
    const mapping = mapConnector(ref.connectorType);
    return {
        id: `conn-boomi-${sanitizeId(ref.name)}`,
        name: ref.name,
        type: mapping.connectionType,
        category: mapping.connectionCategory,
        config: {
            connectorType: ref.connectorType || 'unknown',
            ...(ref.auth ? { authenticationType: ref.auth } : {}),
        },
        sourceMapping: {
            boomi: {
                componentType: 'connection',
                connectorType: ref.connectorType,
                componentId: ref.componentId,
                file: path.basename(ref.filePath),
            },
        },
        targetMapping: {
            logicAppsConnector: mapping.logicAppsAction,
            builtIn: mapping.builtIn,
            gap: mapping.gap ?? false,
        },
    } as unknown as IRConnection;
}
