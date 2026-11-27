/**
 * Skill Overlay
 *
 * Customer customizations for provisioned skills. The extension owns
 * `.github/skills/<skill>/SKILL.md`; teams keep their own rules in
 * `.github/skills/<skill>/CUSTOM.md`, which is appended to the skill on every
 * provisioning and never overwritten. A content hash marks extension-written
 * skills so direct edits can be detected and backed up before an update.
 *
 * @module services/SkillOverlay
 */

import { createHash } from 'crypto';

/** Customer rules file inside a skill folder. */
export const CUSTOM_SKILL_FILE = 'CUSTOM.md';

/** Optional customer skill read before all others. */
export const CUSTOMER_STANDARDS_SKILL = 'customer-standards';

const HASH_MARKER = /\r?\n?<!-- managed-skill sha256:([0-9a-f]{64}) -->\s*$/;

function sha256(text: string): string {
    return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

function normalizeEnd(text: string): string {
    return `${text.replace(/\s+$/, '')}\n`;
}

/** Append a team's `CUSTOM.md` rules to a managed skill. */
export function composeSkill(
    base: string,
    custom: string | undefined,
    skillFolder: string
): string {
    const rules = custom?.trim();
    if (!rules) {
        return base;
    }
    return (
        `${normalizeEnd(base)}\n---\n\n## Customer Overrides\n\n` +
        `> Maintained in \`.github/skills/${skillFolder}/${CUSTOM_SKILL_FILE}\`. ` +
        'When these rules conflict with the rules above, these rules win.\n\n' +
        `${rules}\n`
    );
}

/** Stamp a managed skill with a hash of its content. */
export function withContentHash(content: string): string {
    const body = normalizeEnd(content);
    return `${body}<!-- managed-skill sha256:${sha256(body)} -->\n`;
}

/** True when a skill written by the extension was edited afterwards. */
export function isEditedManagedSkill(existing: string): boolean {
    const match = HASH_MARKER.exec(existing);
    if (!match) {
        // Written by an older version without a hash: edits cannot be detected.
        return false;
    }
    return sha256(normalizeEnd(existing.slice(0, match.index))) !== match[1];
}

/** True when two skill files have the same content, ignoring line endings. */
export function sameSkillContent(a: string, b: string): boolean {
    return a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
}
