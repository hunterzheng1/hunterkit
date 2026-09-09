/**
 * 发布基线与 attempt 的派生（WI-4b 共享模块）。
 *
 * 从 plan-publish.ts 提取：evidence-pack 省略 expected_baseline / context.attempt
 * 时用同一份实现派生，保证与 publish 步骤 2 的自动记账完全一致——两处各推一套
 * 就会出现"evidence-pack 派生 present、publish 又按 absent 覆盖"的漂移。
 *
 * 语义（HP-18）：只在输入自己没声明时派生；显式声明的尊重原值。
 *   - expected_baseline：扫描 meta/publication-journals 里 committed journal，
 *     取最大 generation 的 manifest 作为上次发布基线；
 *   - context.attempt：低于 meta/plan-events.ndjson 里已发布 attempt 时自动递增。
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface DerivedBaseline {
  readonly manifest_hash: string;
  readonly generation: number;
}

/** 从 committed journal 派生上次发布基线（manifest_hash + generation）。 */
export async function deriveBaseline(
  changeDir: string
): Promise<DerivedBaseline | undefined> {
  const journalsDir = join(changeDir, "meta", "publication-journals");
  let files: string[];
  try {
    files = await readdir(journalsDir);
  } catch {
    return undefined;
  }
  let best: DerivedBaseline | undefined;
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const journal = JSON.parse(await readFile(join(journalsDir, file), "utf8")) as {
        state?: unknown;
        binding?: {
          new_manifest_hash?: unknown;
          expected_baseline?: { state?: unknown; generation?: unknown };
        };
      };
      if (journal.state !== "committed" ||
          typeof journal.binding?.new_manifest_hash !== "string") continue;
      const baseline = journal.binding.expected_baseline;
      const generation = baseline?.state === "present" && typeof baseline.generation === "number"
        ? baseline.generation + 1
        : 1;
      if (best === undefined || generation > best.generation) {
        best = { manifest_hash: journal.binding.new_manifest_hash, generation };
      }
    } catch {
      // 单个 journal 损坏不阻断基线派生
    }
  }
  return best;
}

/** plan-events.ndjson 里已出现的最大 attempt（用于重发布时自动递增）。 */
export async function lastKnownAttempt(changeDir: string): Promise<number> {
  let ndjson: string;
  try {
    ndjson = await readFile(join(changeDir, "meta", "plan-events.ndjson"), "utf8");
  } catch {
    return 0;
  }
  let max = 0;
  for (const line of ndjson.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const event = JSON.parse(line) as { attempt?: unknown };
      if (typeof event.attempt === "number" && Number.isSafeInteger(event.attempt) &&
          event.attempt > max) {
        max = event.attempt;
      }
    } catch {
      // 单行损坏不阻断
    }
  }
  return max;
}
