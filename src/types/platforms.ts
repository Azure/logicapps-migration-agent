/**
 * Supported Source Platforms
 *
 * Single source of truth for all supported source integration platforms.
 * Add new platforms here — all UI, config, and provisioning code imports from this file.
 *
 * @module types/platforms
 */

/**
 * Supported source platform identifiers.
 */
export type SourcePlatform = 'biztalk' | 'mulesoft';

/**
 * Platform display metadata.
 */
export interface PlatformInfo {
    /** Platform identifier */
    id: SourcePlatform;
    /** Display label */
    label: string;
    /** Short description */
    description: string;
    /** VS Code codicon */
    icon: string;
    /** File patterns for auto-detection */
    filePatterns: string[];
}

/**
 * All supported platforms with display metadata.
 * Order determines display order in pickers and UI.
 */
export const SUPPORTED_PLATFORMS: PlatformInfo[] = [
    {
        id: 'biztalk',
        label: 'BizTalk Server',
        description: 'Microsoft BizTalk Server 2016/2020',
        icon: '$(server)',
        filePatterns: ['.btproj', '.odx', '.btm', '.xsd'],
    },
    {
        id: 'mulesoft',
        label: 'MuleSoft Anypoint',
        description: 'MuleSoft Mule 3/4',
        icon: '$(cloud)',
        filePatterns: ['pom.xml', 'mule-*.xml', '.dwl'],
    },
];

/**
 * Get platform info by ID.
 */
export function getPlatformInfo(id: SourcePlatform): PlatformInfo | undefined {
    return SUPPORTED_PLATFORMS.find((p) => p.id === id);
}

/**
 * Check if a platform ID is supported.
 */
export function isSupportedPlatform(id: string): id is SourcePlatform {
    return SUPPORTED_PLATFORMS.some((p) => p.id === id);
}
