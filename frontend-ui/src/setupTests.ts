import '@testing-library/jest-dom/vitest';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

// jsdom does not implement any layout APIs on Range (real browsers all do).
// Code that relies on `Range.prototype.getBoundingClientRect()` — e.g. caret
// anchoring for the @-mention picker — would otherwise throw `... is not a
// function`. We polyfill it here with the same empty DOMRect that real
// browsers return for collapsed ranges in detached / unrendered contexts;
// production code is expected to fall back gracefully (which it does).
if (typeof Range !== 'undefined' && !Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return new DOMRect(0, 0, 0, 0);
  };
}
if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function getClientRects() {
    return {
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    } as unknown as DOMRectList;
  };
}

// jsdom does not implement IntersectionObserver. ProductTable's infinite-scroll
// footer instantiates one; without the polyfill any test that mounts the List
// view throws a ReferenceError. The no-op stub lets components mount; tests
// that need to assert IO behavior should mock the observer per-suite.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}
