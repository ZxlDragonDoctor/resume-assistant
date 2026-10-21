import type { AiBatchResponse } from '../../types/resume';
import type { AiBulletChange, AiBulletTarget } from '../../utils/aiResume';

/** Cancelling also invalidates responses from transports that ignore AbortSignal. */
export function createRequestScope() {
  let sequence = 0;
  let controller: AbortController | undefined;
  return {
    start() {
      controller?.abort();
      const current = ++sequence;
      const requestController = new AbortController();
      controller = requestController;
      return { signal: requestController.signal, isCurrent: () => current === sequence && !requestController.signal.aborted };
    },
    cancel() { sequence += 1; controller?.abort(); },
  };
}

export function summaryInput(role: string, years: number | undefined, content: string): string {
  const facts = [role.trim() ? `目标岗位：${role.trim()}` : '',
    years !== undefined ? `${years} 年相关经验` : ''].filter(Boolean).join('\n');
  return `${facts ? `${facts}\n\n` : ''}现有简历内容：\n${content}`;
}

/** Match by the request identity and original text, never by model-generated positions. */
export function batchChanges(targets: AiBulletTarget[], response: AiBatchResponse): AiBulletChange[] {
  if (!Array.isArray(response.items) || response.items.length !== targets.length || targets.length > 30) {
    throw new Error('返回的要点数量不一致，请重新优化');
  }
  const seen = new Set<string>();
  return targets.map((target, index) => {
    const item = response.items[index];
    if (!item || seen.has(item.id) || item.id !== target.id || item.before !== target.before
      || typeof item.after !== 'string' || !item.after.trim()) {
      throw new Error('返回的要点与原文不一致，请重新优化');
    }
    seen.add(item.id);
    return { ...target, after: item.after.trim() };
  });
}

export function aiErrorMessage(error: unknown, fallback = '请求失败，请稍后重试'): string {
  if (error && typeof error === 'object') {
    const err = error as { code?: string; response?: { data?: { message?: string; detail?: unknown } }; message?: string };
    if (err.code === 'ECONNABORTED') return 'AI 响应超时，请重试';
    if (err.code === 'ERR_NETWORK') return '无法连接 AI 服务，请稍后重试';
    if (err.response?.data?.message) return err.response.data.message;
    if (typeof err.response?.data?.detail === 'string') return err.response.data.detail;
    if (err.message && !err.message.startsWith('Request failed')) return err.message;
  }
  return fallback;
}
