/**
 * machine.capabilities 推断层：把"agent 在自然输入里手填的能力枚举"升级为
 * "命令推断为底、手填与推断取并集"，逐条标注来源——与 risk-signal-inference.ts
 * 同一模式（WI-4b，不对称 B）。
 *
 * 扫描源与 risk_signals 相同：① structured_input.tasks[].affected_paths（计划触达
 * 面，主源）；② `git status --porcelain --untracked-files=all` 的路径（已开工残留，
 * 次源）。marker 表移植 harness_gate.py `_diff_capabilities`（:1160-1172）的保守
 * 子串匹配，并按 v2 九值枚举扩展。migration 命中时同时记 database（与 Python
 * 同向：migration→database；schema 迁移既触发 migration_rollback 也触发
 * data_consistency 透镜）。
 *
 * 并集语义与 risk_signals 一致：推断是安全地板，手填不可删推断项
 * （declared ∪ inferred，永不取差集）。多推一个能力只会多开质量透镜（更严），
 * 少推不阻断——手填仍然有效。
 */

export type PlanCapability = "api" | "concurrency" | "database" | "filesystem" |
  "migration" | "network" | "permissions" | "security" | "ui";

/** 与 core plan-artifacts 的 capabilities 数组同源（module.ts:41，模块私有故此处复述）。 */
export const CAPABILITY_VALUES = ["api", "concurrency", "database", "filesystem",
  "migration", "network", "permissions", "security", "ui"] as const;

export interface CapabilityProvenance {
  readonly capability: PlanCapability;
  readonly source: "declared" | "inferred" | "declared+inferred";
}

export interface InferredCapabilities {
  readonly effective: readonly PlanCapability[];
  readonly provenance: readonly CapabilityProvenance[];
}

/** 与 harness_gate.py _diff_capabilities 同源的保守 marker 表（TS 枚举为九值）。 */
const CAPABILITY_MARKERS: Partial<Record<PlanCapability, readonly string[]>> = {
  api: ["/api/", "openapi", "swagger", "controller"],
  concurrency: ["concurren", "mutex", "lock", "lease"],
  database: ["/sql/", ".sql", "schema", "database"],
  filesystem: ["filesystem", "vfs"],
  migration: ["migration", "migrate"],
  network: ["network", "socket", "grpc", "http-client"],
  permissions: ["permission", "authz", "rbac", "acl"],
  security: ["security", "crypto", "secret", "credential"],
  ui: [".tsx", ".vue", ".svelte", "component", "ui/"]
};

function inferFromPaths(paths: readonly string[]): PlanCapability[] {
  const lowered = paths.map((path) => path.toLowerCase()).join("\n");
  const found = new Set<PlanCapability>();
  for (const [capability, markers] of Object.entries(CAPABILITY_MARKERS)) {
    if (markers !== undefined && markers.some((marker) => lowered.includes(marker))) {
      found.add(capability as PlanCapability);
    }
  }
  // migration 触达 schema：与 Python _diff_capabilities 同向（migration→database），
  // migration_rollback 与 data_consistency 两个透镜都应开
  if (found.has("migration")) found.add("database");
  return [...found].sort();
}

export function inferCapabilities(input: {
  readonly declared: readonly PlanCapability[];
  readonly affectedPaths: readonly string[];
  readonly gitStatusPaths?: readonly string[] | undefined;
}): InferredCapabilities {
  const inferred = inferFromPaths([
    ...input.affectedPaths,
    ...(input.gitStatusPaths ?? [])
  ]);
  const declaredSet = new Set(input.declared);
  const inferredSet = new Set(inferred);
  const effective = [...new Set([...input.declared, ...inferred])].sort();
  const provenance: CapabilityProvenance[] = effective.map((capability) => ({
    capability,
    source: declaredSet.has(capability) && inferredSet.has(capability)
      ? "declared+inferred"
      : declaredSet.has(capability)
        ? "declared"
        : "inferred"
  }));
  return { effective, provenance };
}
