import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PUBLISH_EDIT_QUEUE_KEY_PREFIX,
  buildPublishEditQueueKey,
  clearPublishEditQueues,
} from '../hooks/editQueueStorage';

describe('editQueueStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('buildPublishEditQueueKey', () => {
    it('returns a scoped key when both userId and workspaceId are present', () => {
      expect(buildPublishEditQueueKey(7, 'ws-abc')).toBe(
        `${PUBLISH_EDIT_QUEUE_KEY_PREFIX}:7:ws-abc`,
      );
    });

    it('returns null when userId is missing', () => {
      expect(buildPublishEditQueueKey(null, 'ws-abc')).toBeNull();
      expect(buildPublishEditQueueKey(undefined, 'ws-abc')).toBeNull();
    });

    it('returns null when workspaceId is missing', () => {
      expect(buildPublishEditQueueKey(7, null)).toBeNull();
      expect(buildPublishEditQueueKey(7, undefined)).toBeNull();
    });

    it('returns null when userId is 0', () => {
      // User IDs in the backend start at 1 — 0 is treated as missing.
      expect(buildPublishEditQueueKey(0, 'ws-abc')).toBeNull();
    });
  });

  describe('clearPublishEditQueues', () => {
    it('removes every key matching the prefix', () => {
      localStorage.setItem(
        `${PUBLISH_EDIT_QUEUE_KEY_PREFIX}:1:ws-a`,
        JSON.stringify(['x']),
      );
      localStorage.setItem(
        `${PUBLISH_EDIT_QUEUE_KEY_PREFIX}:2:ws-b`,
        JSON.stringify(['y']),
      );
      clearPublishEditQueues();
      expect(
        localStorage.getItem(`${PUBLISH_EDIT_QUEUE_KEY_PREFIX}:1:ws-a`),
      ).toBeNull();
      expect(
        localStorage.getItem(`${PUBLISH_EDIT_QUEUE_KEY_PREFIX}:2:ws-b`),
      ).toBeNull();
    });

    it('leaves unrelated keys alone', () => {
      localStorage.setItem(
        `${PUBLISH_EDIT_QUEUE_KEY_PREFIX}:1:ws-a`,
        JSON.stringify(['x']),
      );
      localStorage.setItem('some.other.app.key', 'keep me');
      localStorage.setItem('mm.unrelated', 'keep me too');
      clearPublishEditQueues();
      expect(localStorage.getItem('some.other.app.key')).toBe('keep me');
      expect(localStorage.getItem('mm.unrelated')).toBe('keep me too');
    });

    it('is a no-op when no matching keys exist', () => {
      localStorage.setItem('unrelated', 'x');
      expect(() => clearPublishEditQueues()).not.toThrow();
      expect(localStorage.getItem('unrelated')).toBe('x');
    });

    it('does not remove the bare prefix key (scoped keys only)', () => {
      // Defensive: only `${prefix}:*` is the queue shape. A bare
      // `${prefix}` entry (if something ever writes one) is left alone.
      localStorage.setItem(PUBLISH_EDIT_QUEUE_KEY_PREFIX, 'not a queue');
      clearPublishEditQueues();
      expect(localStorage.getItem(PUBLISH_EDIT_QUEUE_KEY_PREFIX)).toBe(
        'not a queue',
      );
    });
  });
});
