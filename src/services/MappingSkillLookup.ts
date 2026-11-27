/**
 * Mapping Skill Lookup
 *
 * Searches the `source-to-logic-apps-mapping` skill for the rows and rules that mention
 * given components, so agents can look up a few mappings instead of loading the whole
 * skill (100+ KB for BizTalk) into every analysis, planning and conversion run.
 *
 * @module services/MappingSkillLookup
 */

export interface MappingSkillMatch {
    /** Heading of the section the match belongs to */
    readonly section: string;
    /** Header row of the table the match belongs to, if any */
    readonly columns?: string;
    /** Matching table row or rule line */
    readonly text: string;
}

interface ScoredMatch extends MappingSkillMatch {
    readonly score: number;
    readonly position: number;
}

const MAX_TEXT_LENGTH = 600;

/** Lower-case search terms: comma/semicolon-separated phrases, or words of a plain query. */
export function mappingSearchTerms(query: string): string[] {
    const phrases = query.split(/[,;\n]+/).map((term) => term.trim().toLowerCase());
    const terms = phrases.length > 1 ? phrases : query.toLowerCase().split(/\s+/);
    return [...new Set(terms.map((term) => term.trim()).filter((term) => term.length >= 2))];
}

/**
 * Find the table rows and rule lines of a mapping skill that mention the query terms.
 * Rows matching more terms rank first; ties keep document order.
 */
export function searchMappingSkill(
    markdown: string,
    query: string,
    limit = 25
): MappingSkillMatch[] {
    const terms = mappingSearchTerms(query);
    if (terms.length === 0) {
        return [];
    }

    const matches: ScoredMatch[] = [];
    let section = '';
    let columns: string | undefined;
    let inFrontMatter = false;
    const lines = markdown.split(/\r?\n/);
    lines.forEach((line, position) => {
        const trimmed = line.trim();
        if (position === 0 && trimmed === '---') {
            inFrontMatter = true;
            return;
        }
        if (inFrontMatter) {
            inFrontMatter = trimmed !== '---';
            return;
        }
        const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
        if (heading) {
            section = heading[1].trim();
            columns = undefined;
            return;
        }
        const isTableLine = trimmed.startsWith('|');
        if (!isTableLine) {
            columns = undefined;
        } else if (/^\|[\s:|-]+\|?$/.test(trimmed)) {
            return; // separator row
        } else if (columns === undefined) {
            columns = trimmed;
            return; // header row
        }
        if (!trimmed || trimmed.startsWith('<!--')) {
            return;
        }
        const lower = trimmed.toLowerCase();
        const hits = terms.filter((term) => lower.includes(term)).length;
        if (hits === 0) {
            return;
        }
        matches.push({
            section,
            ...(isTableLine && columns ? { columns } : {}),
            text:
                trimmed.length > MAX_TEXT_LENGTH
                    ? `${trimmed.slice(0, MAX_TEXT_LENGTH)}…`
                    : trimmed,
            // Prefer table rows (concrete mappings) over prose that mentions a term.
            score: hits + (isTableLine ? 0.5 : 0),
            position,
        });
    });

    return matches
        .sort((a, b) => b.score - a.score || a.position - b.position)
        .slice(0, Math.max(1, limit))
        .map(({ section: matchSection, columns: matchColumns, text }) => ({
            section: matchSection,
            ...(matchColumns ? { columns: matchColumns } : {}),
            text,
        }));
}
