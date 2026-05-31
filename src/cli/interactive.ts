/**
 * Interactive entrypoint - init wizard and operation menu
 * @module cli/interactive
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { select, checkbox } from '@inquirer/prompts';
import type { CommandContext, CliResponse, AiCliContext } from './types.js';
import { detectAiCliContext } from './ai-context.js';

/**
 * 检测 AI 工具类型（通过环境变量）
 * @deprecated 使用 detectAiCliContext(env) 替代，便于测试注入
 */
export function detectAiTool(): string | null {
  if (process.env.CLAUDE_CODE_SESSION_ID) return 'Claude Code';
  if (process.env.CODEX_SESSION_ID) return 'Codex';
  return null;
}

/** 向导答案数据结构 */
export interface WizardAnswers {
  projectPath: string;
  aiTools: string[];
  capabilities: string[];
  projectType: string;
  writeStrategy: string;
  hookStrength: string;
}

/**
 * 判断是否为 inquirer 取消错误（Ctrl+C）
 */
function isCancelError(error: unknown): boolean {
  if (error instanceof Error) {
    if ((error as any).name === 'ExitPromptError') return true;
    if (error.message.includes('cancel') || error.message.includes('Cancel')) return true;
  }
  return false;
}

/**
 * Run the interactive entrypoint - routes to init wizard or operation menu
 */
export async function runInteractiveEntrypoint(context: CommandContext): Promise<CliResponse> {
  const configPath = join(context.globalOptions.cwd, '.harness', 'config', 'harness.config.json');
  const isInitialized = existsSync(configPath);

  if (isInitialized) {
    return runOperationMenu(context);
  } else {
    return runInitWizard(context);
  }
}

/**
 * 实现完整 6 步交互式初始化向导
 */
export async function runInitWizard(context: CommandContext): Promise<CliResponse> {
  try {
    // 检测 AI CLI 上下文（通过注入 env）
    const aiCliContext = detectAiCliContext(
      (context as any)._env ?? process.env,
    );

    // 步骤 1：确认目标项目路径
    const projectPath = await select({
      message: '确认目标项目路径',
      choices: [
        { name: `当前目录 (${context.globalOptions.cwd})`, value: context.globalOptions.cwd },
        { name: '指定其他路径', value: '__custom__' },
      ],
    });

    const finalProjectPath = projectPath === '__custom__'
      ? await select({ message: '请输入项目路径', choices: [{ name: context.globalOptions.cwd, value: context.globalOptions.cwd }] })
      : projectPath;

    // 步骤 2：选择 AI 工具（空选时循环重试，必须至少选一个）
    let aiTools: string[] = [];
    while (aiTools.length === 0) {
      aiTools = await checkbox({
        message: '选择 AI 工具（空格选中，Enter 确认，至少选择一个）',
        choices: [
          { name: 'Claude Code', value: 'claude' },
          { name: 'Codex (OpenAI)', value: 'codex' },
        ],
      }) as string[];

      if (aiTools.length === 0) {
        // 空选提示，但不退出向导，循环重试
        if (!context.globalOptions.json) {
          context.io.stdout.write('\x1b[33m⚠ 请至少选择一个 AI 工具（空格选中，Enter 确认）\x1b[0m\n');
        }
      }
    }

    // 步骤 3：选择工作流能力
    const capabilities = await checkbox({
      message: '选择工作流能力',
      choices: [
        { name: '项目检查 (inspect)', value: 'inspect' },
        { name: '文档同步 (sync)', value: 'sync' },
        { name: '开发辅助 (develop)', value: 'develop' },
        { name: '代码审查 (review)', value: 'review' },
        { name: '知识库 (knowledge)', value: 'knowledge' },
      ],
    });

    // 步骤 4：选择项目类型
    const projectType = await select({
      message: '选择项目类型',
      choices: [
        { name: '自动检测', value: 'auto' },
        { name: 'Node.js / TypeScript', value: 'node' },
        { name: 'Java / Maven / Gradle', value: 'java' },
        { name: '混合项目', value: 'mixed' },
      ],
    });

    // 步骤 5：选择写入策略
    const writeStrategy = await select({
      message: '选择写入策略',
      choices: [
        { name: '写入项目配置', value: 'write' },
        { name: '只预览（不写入文件）', value: 'preview' },
      ],
    });

    // 步骤 6：选择 Hook 强度
    const hookStrength = await select({
      message: '选择 Hook 强度',
      choices: [
        { name: '不安装', value: 'none' },
        { name: '仅危险命令阻断', value: 'basic' },
        { name: '完整质量门', value: 'full' },
      ],
    });

    const wizardAnswers: WizardAnswers = {
      projectPath: finalProjectPath,
      aiTools,
      capabilities,
      projectType,
      writeStrategy,
      hookStrength,
    };

    // preview 模式等价于 dry-run
    const isDryRun = writeStrategy === 'preview' || context.globalOptions.dryRun;

    return {
      code: 0,
      msg: 'success',
      data: {
        command: 'init',
        mode: 'wizard',
        wizardAnswers,
        dryRun: isDryRun,
        aiCliContext,
      },
      warnings: isDryRun ? ['Dry-run mode: no files were written'] : [],
    };
  } catch (error) {
    // Ctrl+C 中断或取消
    if (isCancelError(error)) {
      return {
        code: 1003,
        msg: '向导已取消',
        data: { command: 'init', mode: 'wizard' },
        warnings: [],
      };
    }
    // 其他错误
    return {
      code: 1004,
      msg: error instanceof Error ? error.message : '向导输入无效',
      data: { command: 'init', mode: 'wizard' },
      warnings: [],
    };
  }
}

/**
 * 实现交互式操作菜单
 */
export async function runOperationMenu(context: CommandContext): Promise<CliResponse> {
  const commands = context.registry.list();

  try {
    const selectedCommand = await select({
      message: '选择要执行的命令',
      choices: commands.map(c => ({
        name: `${c.name} - ${c.description}`,
        value: c.name,
      })),
    });

    // 查找对应 handler
    const handler = context.registry.resolve(selectedCommand);
    if (!handler) {
      return {
        code: 2002,
        msg: `未知命令: ${selectedCommand}`,
        data: { command: 'menu', selectedCommand },
        warnings: [],
      };
    }

    // 构造命令上下文并执行
    const commandContext: CommandContext = {
      ...context,
      command: selectedCommand,
    };
    const result = await handler.run(commandContext);

    return {
      code: result.code,
      msg: result.msg,
      data: {
        command: 'menu',
        selectedCommand,
        result: result.data,
      },
      warnings: result.warnings,
    };
  } catch (error) {
    // 用户取消菜单选择
    if (isCancelError(error)) {
      return {
        code: 0,
        msg: '菜单已取消',
        data: { command: 'menu', selectedCommand: null },
        warnings: [],
      };
    }
    return {
      code: 2002,
      msg: error instanceof Error ? error.message : '菜单选择无效',
      data: { command: 'menu', selectedCommand: null },
      warnings: [],
    };
  }
}
