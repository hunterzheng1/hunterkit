<!-- docsync:start -->
## DocSync

DocSync manages document synchronization for this project. Use slash commands instead of manual CLI.

### Commands
- `/docsync:init` - Project initialization
- `/docsync:sync` - Daily document sync
- `/docsync:sync --fast` - Quick sync using git facts
- `/docsync:sync [file]` - Sync specific file(s)
- `/docsync:rules` - Maintain override rules

### Rules
- Detailed rules: `.docsync/rules/default.md`
- Override rules: `.docsync/rules/override.md`

### Safety Constraints
- Do NOT execute git commit, git push, npm publish
- Do NOT invent commands, ports, environment variables, APIs, or deployment steps
- Do NOT read or output .env, tokens, or secrets
- Mark uncertain content as TODO(review)

### Rule Priority
1. User explicit instruction in current conversation
2. Safety constraints
3. `.docsync/rules/override.md`
4. Repository facts
5. `.docsync/rules/default.md`
<!-- docsync:end -->
