# T1 — 文档修改（fast 档）

- **起始 commit**：`898c8ed3bbc1945b7a86e3641727a7342426356e`（干净树）
- **需求原文**：`harness/harness-execute/SKILL.md` 的「长阶段租约」段落中，把
  「租约默认 TTL 3600 秒」的表述更新为准确反映 `gate begin` 实际注入的 TTL 值
  （以 `harness_gate.py` 中 lease TTL 常量/参数为准），并保持段落其余内容不变。
- **验收条件（对实现者可见）**：
  1. diff 仅触及该段落；
  2. 新表述与代码实际值一致（评估侧对照 `harness_gate.py` 核验）；
  3. 文档契约测试（`test_harness_doc_contract.py`）通过。
- **禁止事项**：不修改任何 Python/TS 代码；不改其他段落；不重排格式。
- **超时预算**：30 分钟墙钟。
- **独立验收保留项（不提供给实现者）**：评估侧用另一份 SKILL.md 段落抽查
  （未要求修改的段落必须零 diff）。
- **风险档位**：fast（defaultPhases plan/execute/archive，unitTest）。
