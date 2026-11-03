import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { runInNewContext } from 'vm';

const source = fs.readFileSync(
    path.resolve(__dirname, '../../../src/views/planning/PlanningWebviewPanel.ts'),
    'utf8'
);
const tooltipMatch = source.match(
    /\/\/ Keep designer tooltips[\s\S]*?(?=\s*\/\/ Zoom state per container)/
);
assert.ok(tooltipMatch, 'Planning designer tooltip handlers must exist');
const tooltipScript = tooltipMatch[0];

function createDesigner(
    rect = { left: 700, top: 500, width: 260, height: 50 },
    viewport = { clientWidth: 1000, clientHeight: 600 },
    tooltipHeight = 300
) {
    class Element {
        parent?: Element;
        children: Element[] = [];
        className = '';
        innerHTML = '';
        classes = new Set<string>();
        classList = {
            add: (name: string) => this.classes.add(name),
            remove: (name: string) => this.classes.delete(name),
        };
        style = { top: '', left: '', maxHeight: '' };
        get offsetWidth() {
            return Math.min(380, viewport.clientWidth - 16);
        }
        get offsetHeight() {
            const maxHeight = parseFloat(this.style.maxHeight);
            return Math.min(tooltipHeight, Number.isNaN(maxHeight) ? Infinity : maxHeight);
        }
        appendChild(child: Element) {
            child.parent = this;
            this.children.push(child);
        }
        contains(element?: Element) {
            for (let current = element; current; current = current.parent) {
                if (current === this) {
                    return true;
                }
            }
            return false;
        }
        closest(selector: string) {
            return selector === '.designer-card' && this === card ? this : undefined;
        }
        querySelector() {
            return this.children.find((child) => child.className === 'designer-card-tooltip');
        }
        setAttribute(name: string, value: string) {
            attributes.set(name, value);
        }
        getBoundingClientRect() {
            return { ...rect, bottom: rect.top + rect.height };
        }
    }

    interface TestEvent {
        target: Element;
        relatedTarget?: Element;
        key?: string;
    }
    const handlers = new Map<string, (event: TestEvent) => void>();
    const windowHandlers = new Map<string, () => void>();
    const timers = new Map<number, () => void>();
    const attributes = new Map<string, string>();
    let timerId = 0;
    const body = new Element();
    const clippingContainer = new Element();
    const card = new Element();
    const content = new Element();
    content.className = 'designer-card-tooltip';
    content.innerHTML = '<div>Response details</div>';
    body.appendChild(clippingContainer);
    clippingContainer.appendChild(card);
    card.appendChild(content);

    runInNewContext(tooltipScript, {
        document: {
            documentElement: viewport,
            body,
            createElement: () => new Element(),
            addEventListener: (name: string, callback: (event: TestEvent) => void) =>
                handlers.set(name, callback),
        },
        window: {
            addEventListener: (name: string, callback: () => void) =>
                windowHandlers.set(name, callback),
        },
        setTimeout: (callback: () => void) => {
            timers.set(++timerId, callback);
            return timerId;
        },
        clearTimeout: (id: number) => timers.delete(id),
    });

    function dispatch(name: string, event: TestEvent = { target: card }) {
        const handler = handlers.get(name);
        assert.ok(handler, `Missing ${name} handler`);
        handler(event);
    }
    function showTooltip() {
        dispatch('mouseover');
        const tooltip = body.querySelector();
        assert.ok(tooltip);
        return tooltip;
    }
    return { body, card, clippingContainer, dispatch, showTooltip, windowHandlers, timers };
}

describe('Planning designer tooltips', () => {
    it('escapes clipping containers and opens above bottom-edge actions', () => {
        const { body, showTooltip } = createDesigner();
        const tooltip = showTooltip();
        assert.equal(tooltip.parent, body);
        assert.equal(tooltip.innerHTML, '<div>Response details</div>');
        assert.ok(tooltip.classes.has('is-visible'));
        assert.equal(parseFloat(tooltip.style.top), 194);
        assert.ok(parseFloat(tooltip.style.left) + tooltip.offsetWidth <= 992);
    });

    it('bounds oversized details within a narrow viewport', () => {
        const { showTooltip } = createDesigner(
            { left: 0, top: 10, width: 260, height: 40 },
            { clientWidth: 300, clientHeight: 250 },
            1000
        );
        const tooltip = showTooltip();
        assert.equal(parseFloat(tooltip.style.left), 8);
        assert.equal(parseFloat(tooltip.style.top), 56);
        assert.equal(tooltip.offsetHeight, 186);
        assert.ok(parseFloat(tooltip.style.top) + tooltip.offsetHeight <= 242);
    });

    it('dismisses stale tooltips on container scroll, resize, or Escape but permits tooltip scrolling', () => {
        const { clippingContainer, dispatch, showTooltip, windowHandlers } = createDesigner();
        const tooltip = showTooltip();
        dispatch('scroll', { target: tooltip });
        assert.ok(tooltip.classes.has('is-visible'));
        dispatch('scroll', { target: clippingContainer });
        assert.ok(!tooltip.classes.has('is-visible'));
        showTooltip();
        dispatch('keydown', { target: tooltip, key: 'Escape' });
        assert.ok(!tooltip.classes.has('is-visible'));
        showTooltip();
        windowHandlers.get('resize')?.();
        assert.ok(!tooltip.classes.has('is-visible'));
    });

    it('stays open while the pointer moves into the scrollable tooltip', () => {
        const { body, card, dispatch, showTooltip, timers } = createDesigner();
        const tooltip = showTooltip();
        dispatch('mouseout', { target: card, relatedTarget: body });
        assert.equal(timers.size, 1);
        dispatch('mouseover', { target: tooltip });
        assert.equal(timers.size, 0);
        assert.ok(tooltip.classes.has('is-visible'));
        dispatch('mouseout', { target: tooltip, relatedTarget: body });
        for (const callback of [...timers.values()]) {
            callback();
        }
        assert.ok(!tooltip.classes.has('is-visible'));
    });
});
