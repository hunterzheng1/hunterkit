/**
 * AI CLI 上下文检测模块
 * @module cli/ai-context
 *
 * 提供可注入 env 的 AI CLI 工具检测，避免直接读取 process.env
 * 使测试可以独立控制环境变量
 */

import type { AiCliContext } from './types.js';

/**
 * 从环境变量中检测当前 AI CLI 工具
 * @param env - 环境变量对象（可注入，便于测试）
 * @returns AI CLI 上下文信息
 */
export function detectAiCliContext(env: NodeJS.ProcessEnv): AiCliContext {
  if (env.CLAUDE_CODE_SESSION_ID) {
    return {
      tool: 'Claude Code',
      source: 'env',
      sessionId: env.CLAUDE_CODE_SESSION_ID,
    };
  }

  if (env.CODEX_SESSION_ID) {
    return {
      tool: 'Codex',
      source: 'env',
      sessionId: env.CODEX_SESSION_ID,
    };
  }

  return {
    tool: 'Unknown',
    source: 'unknown',
  };
}

/**
 * 获取 AI CLI 上下文的显示文本
 * @param context - AI CLI 上下文
 * @returns 适合在向导/菜单中展示的文本
 */
export function formatAiCliContext(context: AiCliContext): string | null {
  if (context.tool === 'Unknown') return null;
  return `当前由 ${context.tool} 触发`;
}