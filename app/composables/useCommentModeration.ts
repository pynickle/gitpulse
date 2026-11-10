import type {
  CommentHiddenReason,
  CommentModeration,
  CommentModerationResult,
} from '#shared/types/comment-moderation';

export function useCommentModeration() {
  const results = useState<Record<string, CommentModerationResult>>(
    'comment-moderation-results',
    () => ({})
  );
  const pending = useState<Record<string, boolean>>('comment-moderation-pending', () => ({}));
  const stateFor = (target?: CommentModeration): CommentModerationResult =>
    (target && results.value[target.nodeId]) || { moderation: target ?? null };
  const pendingFor = (target?: CommentModeration) =>
    Boolean(target && pending.value[target.nodeId]);

  const moderate = async (
    target: CommentModeration,
    action: 'hide' | 'unhide' | 'delete',
    reason?: CommentHiddenReason
  ) => {
    if (pendingFor(target)) return false;
    pending.value = { ...pending.value, [target.nodeId]: true };
    const apiFetch = useGitPulseApiFetch();
    try {
      const result = await apiFetch<CommentModerationResult>('/api/comments/moderation', {
        method: 'POST',
        body: { nodeId: target.nodeId, action, ...(action === 'hide' ? { reason } : {}) },
      });
      results.value = {
        ...results.value,
        [target.nodeId]: { ...result, resourceType: target.resourceType },
      };
      return true;
    } catch (error) {
      try {
        const result = await apiFetch<CommentModerationResult>('/api/comments/moderation', {
          query: { nodeId: target.nodeId },
        });
        results.value = { ...results.value, [target.nodeId]: result };
      } catch {
        /* Keep the loaded comment readable when the refresh also fails. */
      }
      throw error;
    } finally {
      pending.value = { ...pending.value, [target.nodeId]: false };
    }
  };
  const reset = () => {
    results.value = {};
  };
  return { stateFor, pendingFor, moderate, results, reset };
}
