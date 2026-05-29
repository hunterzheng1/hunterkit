/**
 * Safety orchestration module
 * @module capabilities/safety
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import type { SafetyPolicy, SafetyCheckResult, SafetyViolation } from './types.js';
import type { HarnessConfig } from '../../core/types.js';

const BLOCKED_COMMANDS = [
  'rm -rf',
  'git reset --hard',
  'git clean -fdx',
  'Remove-Item -Recurse -Force',
  'npm publish',
  'git push --force',
];

const DEFAULT_SECRET_PATTERNS = ['.env', '*.key', '*.secret', '*.token', '*.pem', '*.p12'];

/**
 * Create safety policy from config
 */
export function createSafetyPolicy(config: HarnessConfig): SafetyPolicy {
  return {
    dangerousCommandsBlocked: config.safety.dangerousCommandsBlocked,
    secretPatterns: config.safety.secretPatterns,
    allowedWritePaths: ['.harness/'],
    blockedFilePatterns: config.safety.secretPatterns,
  };
}

/**
 * Check a command against safety policy
 */
export function checkCommandSafety(command: string, policy: SafetyPolicy): SafetyCheckResult {
  const violations: SafetyViolation[] = [];

  if (policy.dangerousCommandsBlocked) {
    for (const dangerous of BLOCKED_COMMANDS) {
      if (command.includes(dangerous)) {
        violations.push({
          type: 'dangerous_command',
          pattern: dangerous,
          message: `Blocked dangerous command pattern: ${dangerous}`,
        });
      }
    }
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Check file content for secret patterns
 */
export function checkFileSafety(filePath: string, content: string, policy: SafetyPolicy): SafetyCheckResult {
  const violations: SafetyViolation[] = [];

  for (const pattern of policy.secretPatterns) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    if (regex.test(filePath)) {
      violations.push({
        type: 'blocked_file',
        path: filePath,
        pattern,
        message: `File matches blocked pattern: ${pattern}`,
      });
    }
  }

  // Check for common secret patterns in content
  const secretRegexes = [
    /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    /(?:api_key|apikey|api-key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    /(?:secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    /-----BEGIN\s+(RSA|EC|DSA)\s+PRIVATE\s+KEY-----/g,
  ];

  for (const regex of secretRegexes) {
    if (regex.test(content)) {
      violations.push({
        type: 'secret_leak',
        path: filePath,
        message: `Possible secret detected: ${regex.source}`,
      });
    }
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Check if a write path is allowed
 */
export function checkPathSafety(targetPath: string, root: string, policy: SafetyPolicy): SafetyCheckResult {
  const violations: SafetyViolation[] = [];
  const rel = relative(root, targetPath);

  const isAllowed = policy.allowedWritePaths.some(allowed => rel.startsWith(allowed));
  if (!isAllowed && !rel.startsWith('.')) {
    violations.push({
      type: 'path_violation',
      path: targetPath,
      message: `Write path outside allowed boundaries: ${rel}`,
    });
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Check command line safety (for CLI integration)
 */
export function checkCommandLineSafety(command: string): SafetyCheckResult {
  const violations: SafetyViolation[] = [];

  for (const dangerous of BLOCKED_COMMANDS) {
    if (command.includes(dangerous)) {
      violations.push({
        type: 'dangerous_command',
        pattern: dangerous,
        message: `Blocked dangerous command pattern: ${dangerous}`,
      });
    }
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Generate dangerous-command hook script
 */
function generateDangerousCommandHook(): string {
  return `#!/bin/bash
# Hook: dangerous-command
# 原则：不做复杂 AI 判断、输出结构化、不直接修代码、只调用 harness CLI

BLOCKED_COMMANDS=("rm -rf" "git reset --hard" "git clean -fdx" "Remove-Item -Recurse -Force" "npm publish" "git push --force")
INPUT_COMMAND="$1"

for blocked in "\${BLOCKED_COMMANDS[@]}"; do
  if echo "$INPUT_COMMAND" | grep -qF "$blocked"; then
    echo '{"allowed": false, "hook": "dangerous-command", "matchedRule": "'"$blocked"'", "message": "Blocked by harness safety policy"}'
    exit 1
  fi
done

echo '{"allowed": true, "hook": "dangerous-command"}'
exit 0
`;
}

/**
 * Generate sync-after-doc-change hook script
 */
function generateSyncAfterDocChangeHook(): string {
  return `#!/bin/bash
# Hook: sync-after-doc-change
# 原则：不做复杂 AI 判断、输出结构化、不直接修代码、只调用 harness CLI

CHANGED_FILES="$1"

# 检查是否修改了核心文档
if echo "$CHANGED_FILES" | grep -qE "(AGENTS\\.md|CLAUDE\\.md|\\.harness/)"; then
  echo '{"action": "sync-check", "hook": "sync-after-doc-change", "message": "Core docs changed, running sync check"}'
  harness sync --check
  exit $?
fi

echo '{"action": "skip", "hook": "sync-after-doc-change"}'
exit 0
`;
}

/**
 * Generate review-before-push hook script
 */
function generateReviewBeforePushHook(): string {
  return `#!/bin/bash
# Hook: review-before-push
# 原则：不做复杂 AI 判断、输出结构化、不直接修代码、只调用 harness CLI

# 检查是否已运行 review
if [ ! -f ".harness/reports/review/latest.json" ]; then
  echo '{"allowed": false, "hook": "review-before-push", "message": "No review report found. Run harness review first."}'
  exit 1
fi

# 检查是否有 P0 问题
P0_COUNT=$(cat .harness/reports/review/latest.json | grep -o '"severity":"P0"' | wc -l)
if [ "$P0_COUNT" -gt 0 ]; then
  echo '{"allowed": false, "hook": "review-before-push", "message": "P0 issues found. Fix them before pushing."}'
  exit 1
fi

echo '{"allowed": true, "hook": "review-before-push"}'
exit 0
`;
}

/**
 * Generate session-summary hook script
 */
function generateSessionSummaryHook(): string {
  return `#!/bin/bash
# Hook: session-summary
# 原则：不做复杂 AI 判断、输出结构化、不直接修代码、只调用 harness CLI

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
EVENT_FILE=".harness/events/session-$TIMESTAMP.json"

mkdir -p .harness/events

cat > "$EVENT_FILE" <<EOF
{
  "type": "session-summary",
  "timestamp": "$(date -Iseconds)",
  "hook": "session-summary"
}
EOF

echo '{"action": "logged", "hook": "session-summary", "file": "'"$EVENT_FILE"'"}'
exit 0
`;
}

/**
 * Generate compact-state hook script
 */
function generateCompactStateHook(): string {
  return `#!/bin/bash
# Hook: compact-state
# 原则：不做复杂 AI 判断、输出结构化、不直接修代码、只调用 harness CLI

STATE_FILE=".harness/state/compact-state.json"
mkdir -p .harness/state

cat > "$STATE_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "hook": "compact-state",
  "activeChange": "$(cat .harness/state/active-change.json 2>/dev/null || echo '{}')"
}
EOF

echo '{"action": "saved", "hook": "compact-state", "file": "'"$STATE_FILE"'"}'
exit 0
`;
}

/**
 * Generate all 5 hook scripts for both Claude and Codex
 */
export function generateHooks(cwd: string): void {
  const hooks = [
    { name: 'dangerous-command', content: generateDangerousCommandHook() },
    { name: 'sync-after-doc-change', content: generateSyncAfterDocChangeHook() },
    { name: 'review-before-push', content: generateReviewBeforePushHook() },
    { name: 'session-summary', content: generateSessionSummaryHook() },
    { name: 'compact-state', content: generateCompactStateHook() },
  ];

  // Generate for Claude
  const claudeHooksDir = join(cwd, '.harness', 'adapters', 'claude', 'hooks');
  mkdirSync(claudeHooksDir, { recursive: true });
  for (const hook of hooks) {
    writeFileSync(join(claudeHooksDir, `${hook.name}.sh`), hook.content);
  }

  // Generate for Codex
  const codexHooksDir = join(cwd, '.harness', 'adapters', 'codex', 'hooks');
  mkdirSync(codexHooksDir, { recursive: true });
  for (const hook of hooks) {
    writeFileSync(join(codexHooksDir, `${hook.name}.sh`), hook.content);
  }
}

/**
 * Generate hook configuration files
 */
export function generateHookConfigs(cwd: string): void {
  // Claude settings.json
  const claudeSettings = {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: '.harness/adapters/claude/hooks/dangerous-command.sh $TOOL_INPUT' }],
        },
        {
          matcher: 'Bash(git push)',
          hooks: [{ type: 'command', command: '.harness/adapters/claude/hooks/review-before-push.sh' }],
        },
      ],
      PostToolUse: [
        {
          matcher: 'Edit|Write',
          hooks: [{ type: 'command', command: '.harness/adapters/claude/hooks/sync-after-doc-change.sh $TOOL_INPUT' }],
        },
      ],
      SessionEnd: [
        {
          hooks: [{ type: 'command', command: '.harness/adapters/claude/hooks/session-summary.sh' }],
        },
      ],
      PreCompact: [
        {
          hooks: [{ type: 'command', command: '.harness/adapters/claude/hooks/compact-state.sh' }],
        },
      ],
    },
  };

  const claudeSettingsPath = join(cwd, '.harness', 'adapters', 'claude', 'settings.json');
  mkdirSync(join(cwd, '.harness', 'adapters', 'claude'), { recursive: true });
  writeFileSync(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2));

  // Codex hooks.json
  const codexHooks = {
    hooks: [
      {
        name: 'dangerous-command',
        trigger: 'PreToolUse',
        matcher: 'Bash',
        command: '.harness/adapters/codex/hooks/dangerous-command.sh',
      },
      {
        name: 'sync-after-doc-change',
        trigger: 'PostToolUse',
        matcher: 'Edit|Write',
        command: '.harness/adapters/codex/hooks/sync-after-doc-change.sh',
      },
      {
        name: 'review-before-push',
        trigger: 'PreToolUse',
        matcher: 'Bash(git push)',
        command: '.harness/adapters/codex/hooks/review-before-push.sh',
      },
      {
        name: 'session-summary',
        trigger: 'SessionEnd',
        command: '.harness/adapters/codex/hooks/session-summary.sh',
      },
      {
        name: 'compact-state',
        trigger: 'PreCompact',
        command: '.harness/adapters/codex/hooks/compact-state.sh',
      },
    ],
  };

  const codexHooksPath = join(cwd, '.harness', 'adapters', 'codex', 'hooks.json');
  mkdirSync(join(cwd, '.harness', 'adapters', 'codex'), { recursive: true });
  writeFileSync(codexHooksPath, JSON.stringify(codexHooks, null, 2));
}

/**
 * Generate subagent definition files
 */
export function generateSubagentDefs(cwd: string): void {
  const agents = [
    // 需求分析 (4)
    { name: 'harness-requirement-clarifier', category: 'requirement' },
    { name: 'harness-repo-context-mapper', category: 'requirement' },
    { name: 'harness-risk-reviewer', category: 'requirement' },
    { name: 'harness-scope-validator', category: 'requirement' },
    // 设计 (4)
    { name: 'harness-design-writer', category: 'design' },
    { name: 'harness-contract-validator', category: 'design' },
    { name: 'harness-cross-module-validator', category: 'design' },
    { name: 'harness-task-planner', category: 'design' },
    // 代码生成 (4)
    { name: 'harness-implementer', category: 'implement' },
    { name: 'harness-test-reviewer', category: 'implement' },
    { name: 'harness-impl-contract-validator', category: 'implement' },
    { name: 'harness-doc-sync-reviewer', category: 'implement' },
    // Review (7)
    { name: 'harness-rules-reviewer', category: 'review' },
    { name: 'harness-bug-scanner', category: 'review' },
    { name: 'harness-deep-bug-analyzer', category: 'review' },
    { name: 'harness-history-reviewer', category: 'review' },
    { name: 'harness-standards-reviewer', category: 'review' },
    { name: 'harness-contract-reviewer', category: 'review' },
    { name: 'harness-finding-validator', category: 'review' },
  ];

  // Generate Claude .md files
  const claudeAgentsDir = join(cwd, '.harness', 'adapters', 'claude', 'agents');
  mkdirSync(claudeAgentsDir, { recursive: true });
  for (const agent of agents) {
    const content = `# ${agent.name}

**Category**: ${agent.category}

## Description
This is a harness subagent for ${agent.category} tasks.

## Responsibilities
- Execute ${agent.category} related tasks
- Follow harness safety policies
- Report results in structured format

## Usage
This agent is invoked by the harness orchestrator as part of the development workflow.
`;
    writeFileSync(join(claudeAgentsDir, `${agent.name}.md`), content);
  }

  // Generate Codex .toml files
  const codexAgentsDir = join(cwd, '.harness', 'adapters', 'codex', 'agents');
  mkdirSync(codexAgentsDir, { recursive: true });
  for (const agent of agents) {
    const content = `[agent]
name = "${agent.name}"
category = "${agent.category}"

[description]
text = "Harness subagent for ${agent.category} tasks"

[responsibilities]
items = [
  "Execute ${agent.category} related tasks",
  "Follow harness safety policies",
  "Report results in structured format"
]

[usage]
note = "This agent is invoked by the harness orchestrator as part of the development workflow"
`;
    writeFileSync(join(codexAgentsDir, `${agent.name}.toml`), content);
  }
}
