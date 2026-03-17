/**
 * XML Utilities
 *
 * Helper functions for XML parsing.
 *
 * @module parsers/utils/xml
 */

import { DOMParser } from '@xmldom/xmldom';

// Use standard DOM types from TypeScript's lib.dom
// These are compatible with @xmldom/xmldom's output
type XMLElement = Element;
type XMLDocument = Document;

// Re-export types for consumer usage
export type { XMLElement as Element, XMLDocument as Document };

/**
 * Parse XML string into a Document.
 *
 * @param xml - XML string to parse
 * @returns Parsed XML Document or null on error
 */
export function parseXml(xml: string): XMLDocument | null {
    try {
        const parser = new DOMParser({
            errorHandler: {
                warning: () => {
                    /* ignore warnings */
                },
                error: () => {
                    /* ignore recoverable errors */
                },
                fatalError: (msg: string) => {
                    throw new Error(msg);
                },
            },
        });
        return parser.parseFromString(xml, 'text/xml');
    } catch {
        return null;
    }
}

/**
 * Get text content of an element by tag name.
 *
 * @param parent - Parent element
 * @param tagName - Tag name to find
 * @returns Text content or undefined
 */
export function getElementText(parent: XMLElement, tagName: string): string | undefined {
    const elements = parent.getElementsByTagName(tagName);
    if (elements.length > 0) {
        return elements[0]?.textContent?.trim() || undefined;
    }
    return undefined;
}

/**
 * Get attribute value of an element.
 *
 * @param element - Element to get attribute from
 * @param attrName - Attribute name
 * @returns Attribute value or undefined
 */
export function getAttr(element: XMLElement, attrName: string): string | undefined {
    // Check if attribute exists (hasAttribute may not work in all xmldom versions)
    const attr = element.getAttribute(attrName);
    // xmldom returns empty string for missing attributes in some cases
    // Check if attribute actually exists using getAttributeNode
    if (element.hasAttribute && element.hasAttribute(attrName)) {
        return attr ?? undefined;
    }
    // Fallback: check if getAttributeNode returns null
    const attrNode = element.getAttributeNode?.(attrName);
    if (attrNode) {
        return attr ?? undefined;
    }
    // If getAttribute returned a non-null value, use it
    if (attr !== null && attr !== '') {
        return attr;
    }
    return undefined;
}

/**
 * Get all child elements with a specific tag name.
 *
 * @param parent - Parent element
 * @param tagName - Tag name to find
 * @returns Array of matching elements
 */
export function getChildElements(parent: XMLElement, tagName: string): XMLElement[] {
    const result: XMLElement[] = [];
    const children = Array.from(parent.childNodes);

    for (const child of children) {
        if (child && child.nodeType === 1 && (child as XMLElement).tagName === tagName) {
            result.push(child as XMLElement);
        }
    }

    return result;
}

/**
 * Get all descendant elements with a specific tag name.
 *
 * @param parent - Parent element
 * @param tagName - Tag name to find
 * @returns Array of matching elements
 */
export function getAllElements(parent: XMLElement | XMLDocument, tagName: string): XMLElement[] {
    const nodeList = parent.getElementsByTagName(tagName);
    const result: XMLElement[] = [];

    for (const el of Array.from(nodeList)) {
        if (el) {
            result.push(el);
        }
    }

    return result;
}

/**
 * Get the first child element with a specific tag name.
 *
 * @param parent - Parent element
 * @param tagName - Tag name to find
 * @returns First matching element or undefined
 */
export function getFirstChildElement(parent: XMLElement, tagName: string): XMLElement | undefined {
    const children = getChildElements(parent, tagName);
    return children[0];
}

/**
 * Get all direct child elements (any tag).
 *
 * @param parent - Parent element
 * @returns Array of child elements
 */
export function getAllChildElements(parent: XMLElement): XMLElement[] {
    const result: XMLElement[] = [];
    const children = Array.from(parent.childNodes);

    for (const child of children) {
        if (child && child.nodeType === 1) {
            result.push(child as XMLElement);
        }
    }

    return result;
}

/**
 * Find an element by a simple XPath-like query.
 * Supports only simple paths like "PropertyGroup/AssemblyName".
 *
 * @param root - Root element
 * @param path - Path to find (slash-separated)
 * @returns Matching element or undefined
 */
export function findByPath(root: XMLElement | XMLDocument, path: string): XMLElement | undefined {
    const parts = path.split('/').filter((p) => p.length > 0);
    let current: XMLElement | XMLDocument = root;

    for (const part of parts) {
        if (current.nodeType === 9) {
            // Document node
            const elements = (current as XMLDocument).getElementsByTagName(part);
            if (elements.length === 0) {
                return undefined;
            }
            current = elements[0] as XMLElement;
        } else {
            const element = getFirstChildElement(current as XMLElement, part);
            if (!element) {
                return undefined;
            }
            current = element;
        }
    }

    return current as XMLElement;
}

/**
 * Get all elements matching a simple path pattern.
 *
 * @param root - Root element
 * @param path - Path to find (slash-separated, last part is repeated)
 * @returns Array of matching elements
 */
export function findAllByPath(root: XMLElement | XMLDocument, path: string): XMLElement[] {
    const parts = path.split('/').filter((p) => p.length > 0);
    if (parts.length === 0) {
        return [];
    }

    const lastPart = parts.pop();
    if (!lastPart) {
        return [];
    }

    let current: XMLElement | XMLDocument = root;

    for (const part of parts) {
        if (current.nodeType === 9) {
            const elements = (current as XMLDocument).getElementsByTagName(part);
            if (elements.length === 0) {
                return [];
            }
            current = elements[0] as XMLElement;
        } else {
            const element = getFirstChildElement(current as XMLElement, part);
            if (!element) {
                return [];
            }
            current = element;
        }
    }

    if (current.nodeType === 9) {
        return getAllElements(current as XMLDocument, lastPart);
    }

    return getChildElements(current as XMLElement, lastPart);
}

/**
 * Decode XML entities.
 *
 * @param text - Text with potential XML entities
 * @returns Decoded text
 */
export function decodeXmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}
