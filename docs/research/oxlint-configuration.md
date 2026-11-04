# oxlint 配置核实与门禁方案评估

评估日期：2026-11-04。依据 oxc 官方文档、oxlint `1.91.0` 本地实测（`bun.lock` 锁定版本，Windows / Bun）以及 [`node_modules/oxlint/configuration_schema.json`](../../node_modules/oxlint/configuration_schema.json) 的 schema 原文。下文所有诊断条数均为**本仓库真实运行结果**，非估算；规则总数来自 `oxlint --rules`。

## 结论

工单对**事实**的核实成立，对**量化结论**的核实不成立，并且遗漏了两个更关键的问题。

1. 成立：`bun run lint` 当前生效 **0 条规则**，CI lint 门禁是空跑的。
2. 不成立：「`categories.correctness` 改成 `warn` 会冒出数百条诊断，所以先统计 backlog 再单开 PR」。在仓库现有配置上仅改 `warn` 实测是 **13 条**；把坏配置整体修好后是 **66 条**。都不是数百条。
3. 遗漏一：「改成 `warn`」**本身也不是一个能修好门禁的方案**。warn 级别的诊断不改变退出码，`bun run lint` 仍然 `exit=0`，CI 照样通过。必须用 `deny` / `--deny-warnings` / `--max-warnings` 之一。
4. 遗漏二：`plugins: []` 与 `overrides[].plugins: ["unicorn"]` 组合是一个**失效配置**——本意要为 `app/`、`server/`、`shared/` 打开 unicorn，实测一条 unicorn 规则都没生效。

推荐方案：删除死配置，改为 `categories.correctness: "deny"` + 显式 `plugins`，一次性修掉 66 条诊断，**单个 PR 即可完成**，不需要「先统计 backlog」的中间态。详见[推荐配置](#推荐配置)。

## 工单断言逐条核实

| #   | 断言                                                    | 实测结果                                                                                                          | 判定                     |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | `bun run lint` 实际生效 0 条规则                        | `Finished in 34ms on 1 file with 0 rules`                                                                         | ✅ 成立                  |
| 2   | `.oxlintrc.json` 把 `categories.correctness` 设为 `off` | 配置原文如此；`off` 与 `allow` 等价，`--print-config` 归一化输出 `"allow"`                                        | ✅ 成立                  |
| 3   | 插件启用并不启用规则                                    | 官方定义如此：「Enabling a plugin makes its rules available, and category flags control which rules are enabled」 | ✅ 成立                  |
| 4   | `debugger` / `var` / `==` / 空块探针产生 0 条诊断       | 确实 0 条。但该探针设计有缺陷，只有 `debugger` 属于 correctness 类别（见下）                                      | ✅ 结论成立，⚠️ 论据偏弱 |
| 5   | `--print-config` 显示有效规则为空                       | `rules` 映射 0 项；改成 `warn` 后同一命令输出 111 项。**该命令确实会展开 categories**，是有效证据                 | ✅ 成立                  |
| 6   | CI 的 lint 门禁是空跑的                                 | `ci.yml` 的 `lint` job 跑 `bun run lint`，0 规则 → 恒过                                                           | ✅ 成立                  |
| 7   | 改成 `warn` 会冒出**数百条**诊断                        | 仓库现配置仅改 `warn`：**13 条**。删掉坏配置用默认值：**66 条**                                                   | ❌ 不成立                |
| 8   | 建议先统计 backlog、单独一个 PR 决定策略                | 无需。66 条一次修完，且其中 49 条是 type-aware 的高价值检查                                                       | ❌ 建议不必要            |

### 为什么第 4 条的探针偏弱

探针挑了 4 个规则，但它们的类别完全不同：

| 探针规则                   | 类别        | 默认状态 | 在 `correctness` 下是否触发 |
| -------------------------- | ----------- | -------- | --------------------------- |
| `debugger` → `no-debugger` | correctness | 开       | ✅ 触发                     |
| `var` → `no-var`           | restriction | 关       | ❌ 不触发（属 restriction） |
| `==` → `eqeqeq`            | pedantic    | 关       | ❌ 不触发（属 pedantic）    |
| 空块 → `no-empty`          | restriction | 关       | ❌ 不触发（属 restriction） |

即：只有 `1/4` 个探针真正测的是 `correctness` 类别。用它来论证「改 `warn` 会很吵」会高估噪声，因为 `no-var`、`eqeqeq`、`no-empty` 属于默认关闭、需要单独开启的类别。实测 `correctness: "warn"` 下这 4 个探针只有 `no-debugger` 与 `no-constant-condition` 报警（2 条）。

## oxlint 的配置模型：三层，顺序不可颠倒

理解这次事故的关键是三层结构，工单第 3 条只说对了其中一层：

```
plugins      →  有哪些规则「可用」（可用性）
categories   →  哪些「类别」批量开/关，附严重级别（批量开关）
rules        →  逐条覆盖（最终决定权）
```

- **`plugins` 只决定可用性，不启用规则。** 官方插件页原文：「A plugin is a named group of rules. Enabling a plugin makes its rules available, and category flags control which rules are enabled and at what severity.」（[plugins 文档](https://oxc.rs/docs/guide/usage/linter/plugins.html)）
- **`categories.correctness` 默认就是开的**（严重级别 `warn`）。源码默认值 `categories.entry(RuleCategory::Correctness).or_insert(AllowWarnDeny::Warn)`，`or_insert` 的语义是「你没写才补默认」。因此写 `"off"` 会覆盖掉默认值、把整个默认规则集清空：`Allow` 分支执行 `self.rules.retain(|rule, _| rule.category() != *c)`。（[config_builder.rs](https://raw.githubusercontent.com/oxc-project/oxc/main/crates/oxc_linter/src/config/config_builder.rs)）
- **默认插件集是 `unicorn`、`typescript`、`oxc`**（`impl Default for LintPlugins { UNICORN | TYPESCRIPT | OXC }`）；`eslint` 核心规则不是插件，永远可用。（[plugins.rs](https://raw.githubusercontent.com/oxc-project/oxc/main/crates/oxc_linter/src/config/plugins.rs)）
- **`plugins` 字段是替换而非合并**：官方注明「Setting the `plugins` field will overwrite the base set of plugins.」（[config 参考](https://oxc.rs/docs/guide/usage/linter/config-file-reference.html)）
- 文档明确的默认策略就是 correctness 优先：「By default, Oxlint enables rules in the `correctness` category.」（[config 文档](https://oxc.rs/docs/guide/usage/linter/config.html)）

> 文档路径提示：`oxc.rs/docs/guide/usage/linter/configuration.html` 返回 404，正确的页面是 `/linter/config.html`。

本事故发生机制：`correctness: "off"` 清空了唯一默认开启的类别，而项目又同时写 `plugins: []` 把默认插件也关了，于是规则集归零。

## 实测矩阵

统一命令：`bunx oxlint ./ --type-aware --ignore-pattern extension/ --ignore-pattern flutter/`（748 文件）。

| 配置                                                 | 生效规则 |      诊断 | 退出码 |
| ---------------------------------------------------- | -------: | --------: | -----: |
| **现状**：`correctness: "off"` + `plugins: []`       |    **0** |         0 |      0 |
| 仓库配置，仅把 `correctness` 改 `warn`               |       57 |        13 |      0 |
| 仓库配置，去掉 `plugins: []` + `correctness: "warn"` |      111 |        66 |      0 |
| 删除配置文件（等同 oxlint 默认值）                   |      111 |        66 |      0 |
| 仓库配置，去掉 `plugins: []` + `correctness: "deny"` |      111 | 66 errors |  **1** |
| 加 `suspicious: "warn"`（去 `plugins: []`）          |      154 |       896 |      0 |
| `correctness + perf`                                 |        — |        86 |      0 |
| `correctness + pedantic`                             |      219 |     15713 |      0 |
| `correctness + restriction`                          |      171 |      8049 |      0 |
| `correctness + style`                                |        — |     22900 |      0 |
| `correctness + nursery`                              |        — |      2142 |      0 |
| 全类别                                               |        — |     34098 |      0 |

（前 5 行为 `--type-aware`；分类别行为不带 `--type-aware` 的同口径对比，用于说明噪声量级。）

关键读数：

- **删掉配置文件比保留它好。** 默认 111 条规则；现有配置 0 条。
- **`warn` 不会让 CI 失败。** 上表只有 `deny` 行退出码为 1。schema 原文：`"warn": ... (doesn't affect exit code)`，`"error" or "deny": ... will exit with a failure code`。
- **`--type-aware` 是正收益**：规则 96 → 111，诊断 19 → 66，耗时 0.36s → 3.2s。新增的 47 条诊断是类型感知规则，价值最高。

### 66 条诊断构成（修配置后的真实 backlog）

| 规则                                        | 条数 | 说明                              |
| ------------------------------------------- | ---: | --------------------------------- |
| `typescript/no-redundant-type-constituents` |   16 | 类型冗余                          |
| `typescript/no-base-to-string`              |   10 | 对象隐式转字符串                  |
| `typescript/await-thenable`                 |    9 | await 非 Promise，逻辑错误        |
| `eslint/no-unused-vars`                     |    8 | 未使用变量                        |
| `typescript/no-floating-promises`           |    4 | 未处理的 Promise，**真实 bug 源** |
| `typescript/require-array-sort-compare`     |    3 | 数字排序未传比较函数              |
| `typescript/unbound-method`                 |    3 | 方法丢失 this                     |
| `unicorn/no-useless-fallback-in-spread`     |    3 | 冗余回退                          |
| `eslint/no-control-regex`                   |    2 | 控制字符正则                      |
| `typescript/no-implied-eval`                |    2 | 隐式 eval                         |
| 其余 8 条                                   |    8 | 单条                              |

其中 `no-floating-promises`、`await-thenable`、`unbound-method`、`require-array-sort-compare` 属于能直接定位运行时缺陷的类别——这正是当前空门禁漏掉的东西。66 条不是「数百条 backlog」，工作量约等于半天。

## 发现的三处配置缺陷

### 缺陷 1：`categories.correctness: "off"` —— 根因

清空了唯一默认开启的类别。这是 0 规则的直接原因。

### 缺陷 2：`plugins: []` + `overrides[].plugins: ["unicorn"]` —— 无效组合

根 `plugins: []` 关掉了默认插件，`overrides` 里又写 `plugins: ["unicorn"]`，意图是「只对 app/server/shared 开 unicorn」。

实测该意图**完全没实现**：

```
bunx oxlint ./app --print-config | 统计 unicorn 规则数  →  0
./app 规则数：根 plugins:[] → 57      根用默认值 → 96
```

差异 39 条正是被 `plugins: []` 关掉、而 override 没能补回来的规则。override 的 `plugins` 在源码里是**按位或叠加**（`self.config.plugins | override_plugins`），但根为显式空集时该组合在 `1.91.0` 上不生效。无论根因是叠加语义边界还是版本缺陷，结论一致：**当前写法是死的，unicorn 从未生效**。

### 缺陷 3：`overrides[].rules` 的 5 条全为死代码

| 规则                          | 类别       | 默认 |
| ----------------------------- | ---------- | ---- |
| `curly`                       | style      | 关   |
| `no-unexpected-multiline`     | suspicious | 关   |
| `unicorn/empty-brace-spaces`  | style      | 关   |
| `unicorn/no-nested-ternary`   | style      | 关   |
| `unicorn/number-literal-case` | style      | 关   |

5 条规则全部默认关闭，在「只开 correctness」的任何配置下都不会触发，写 `"off"` 与不写完全等价。

### 附带：脚手架残留

`git log` 显示配置文件在 `baa1d85 feat: bootstrap GitPulse application` 随项目初始化一同引入，`overrides.files` 当时写的是 `src/**/*.ts`——一个本项目不存在的目录，典型的 Vite 模板残留。后续 `d107987` 只是把路径改成 `app/server/shared`，**从未有人决定过「关闭 correctness」**。这套配置是脚手架遗产，不是设计决策，因此不必为「改变既有策略」而犹豫。

## 方案对比与优劣

### 方案 A：保持现状

- 优：零成本。
- 劣：lint 门禁是纯装饰。`no-floating-promises`、`await-thenable` 这类运行时缺陷无人拦截；`CONTRIBUTING.md`、`AGENTS.md`、CI 都声称在跑 lint，实际在跑一个空操作——这比没有 lint 更糟，因为它制造了虚假的安全感。**不可接受。**

### 方案 B：只把 `correctness` 改成 `warn`（工单提议）

- 优：一行改动，13 条诊断，风险最低。
- 劣：**修不好门禁**。warn 不改退出码，`bun run lint` 仍 `exit=0`，CI 照样绿灯。等于把「0 条规则的静默」换成「13 条警告的静默」。工单的核心诉求（让门禁真正生效）没有达成。

### 方案 C：`correctness: "deny"` + 修复全部诊断（推荐）

- 优：门禁真正生效；严重级别写在配置文件里，编辑器 / LSP / `lint:fix` / CLI 全部一致，单一事实来源；`oxlint --init` 生成的就是 `"correctness": "error"`，属于官方推荐起点。
- 劣：一次性修 66 条；其中 type-aware 规则需要理解类型语义，个别条目可能需要 `// oxlint-disable-next-line` 加理由注释。约半天工作量。

### 方案 D：`correctness: "warn"` + 脚本加 `--deny-warnings`

- 优：与 C 等价的门禁效果；警告在 CI 界面显示为黄色而非红色，语义上更贴合「非致命」。
- 劣：策略分裂到两处（配置管级别、脚本管门禁）。本地直接跑 `bunx oxlint` 或编辑器不会失败，容易出现「本地绿、CI 红」。**C 优于 D**，除非团队明确希望 lint 输出保持 warning 级。

### 方案 E：`warn` + `--max-warnings <当前条数>` 基数棘轮

- 优：老代码免修，只拦新增，迁移期摩擦最小。
- 劣：需要一个准确的基数并随每次修复下调，否则棘轮松掉；`--max-warnings` 只管总数不管具体规则，容易被无关修复「腾出额度」掩盖新问题；且当前总量只有 66 条，用棘轮属于为 66 条付出长期维护成本，不划算。**仅在诊断数以千计时才值得。**

### 方案 F：`correctness + suspicious`

- 优：规则 154 条，覆盖 `no-shadow` 等常见缺陷。
- 劣：896 条诊断，噪声陡增。构成集中在三个主观性强的规则上：`no-shadow` 72 条、`unicorn/no-array-sort` 49 条、`unicorn/consistent-function-scoping` 39 条——合计 160 条（不带 type-aware 时为 192 条中的 160）。这三个规则都不是 bug 探测器，而是风格偏好。**建议等 correctness 门禁稳定后，作为独立 PR 单独评估。**

### 方案 G：叠加 pedantic / restriction / style

- 劣：实测 8049 / 15713 / 22900 条，全类别 34098 条。属于品类噪声，不是本项目该走的路。`restriction` 尤其危险——它是「禁止特定写法」的规则集，与 `no-var`、`no-empty` 同类，会与项目现有约定直接冲突。

## 推荐配置

### `.oxlintrc.json`

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["unicorn", "typescript", "oxc"],
  "categories": {
    "correctness": "deny"
  },
  "env": {
    "builtin": true
  }
}
```

三个决定及其理由：

1. **显式写全 `plugins`。** 不写等于依赖默认值，oxlint 升级改变默认插件集时门禁会静默变化。显式三件套与 `oxlint --init` 生成物一致。
2. **`"deny"` 而非 `"warn"`。** 只有 `deny` 让 CI 失败；`"deny"` 是 schema 规范值（`"error"` 为别名）。
3. **删掉整个 `overrides` 块。** 它的 5 条规则是死代码，它的 `plugins` 在根 `plugins` 显式声明后也失去意义——unicorn 已由根 `plugins` 全局开启。若确需对特定路径放宽，等真有需求时再加，且要在 `--print-config` 下验证生效。

### `package.json`

`lint` / `lint:fix` 脚本**不需要改**，已含 `--type-aware`。建议仅把 CI 的 lint 步骤换成带「规则集归零」守卫的版本（GitHub Actions 的 bash 默认带 `-eo pipefail`，`tee` 不会吞掉退出码）：

```yaml
- name: Run lint
  run: |
    bun run lint | tee lint.log
    if grep -q "with 0 rules" lint.log; then
      echo "::error::oxlint resolved 0 rules — the lint gate is a no-op"
      exit 1
    fi
```

理由：`categories: "off"` 这类改动不会让 oxlint 报错，只会让规则数悄悄变成 0、退出码仍是 0。**评估后未采用**：该守卫靠匹配 oxlint 的摘要措辞生效，措辞一变即静默失效。

### 落地步骤

1. 改 `.oxlintrc.json`（上面的内容）。
2. `bun run lint` 看 66 条。
3. `bun run lint:fix` —— 大部分 `no-unused-vars`、`unicorn/*` 可自动修；`--type-aware` 的 typescript 规则多数无 autofix，需手改。
4. 对确认为误报的条目加 `// oxlint-disable-next-line <rule> -- <理由>`，禁止裸 disable。
5. 复跑 `bun run fmt:check && bun run lint && bunx nuxi typecheck && bun test --parallel`。
6. 一个 PR 完成。**不需要** backlog 统计 PR：66 条已在本文给出完整构成。

## 陷阱清单（核实过程中实测得到）

- **`--print-config` 不折叠 `overrides`。** 对 `app/x.ts` 执行 `--print-config`，输出的是根配置 + 独立的 `overrides` 数组，被 override 覆盖的规则在根 `rules` 里仍显示原值。审计「override 是否生效」时不能只看根 `rules`。
- **`--rules` 是静态注册清单，不反映配置。** 实测带仓库配置与不带配置两次 `--rules` 输出**逐字节相同**（均为 902 行，页脚 `Default: 111 / Total: 872`）。它不能用来判断「我的配置生效了没有」——用 `--print-config` 或运行摘要里的 `with N rules`。
- **运行摘要的 `with N rules` 是「本次实际 lint 的文件的生效规则数」，不是配置总数。** 同一配置对 `.ts` 报 96、对含 `.vue` 的全量报 111。核对时要注意口径。
- **`warn` 不失败、`off` 静默。** 只有 `deny`/`--deny-warnings`/`--max-warnings` 让退出码非 0；而规则数归零连警告都没有。
- **`--type-aware` 依赖 `oxlint-tsgolint` 的平台二进制。** 本仓库已装 `@oxlint-tsgolint/win32-x64`（含 `tsgolint.exe`），可用；缺二进制时结果是 `Failed to find tsgolint executable` 并 `exit=1`。CI 的 Ubuntu runner 需要对应 `linux-x64` 二进制，提交前请在 CI 上确认一次。
- **`--tsconfig` 对 type-aware 无效。** tsconfig 按文件自动发现，显式传 `--tsconfig` 只影响 import 解析，与 type-aware 的解析可能不一致。
- **typo 的规则名是硬报错**，不是警告：`Rule 'no-such-rule-xyz' not found in plugin 'eslint'`，`exit=1`。因此 `overrides` 里拼错的规则名会直接让 lint 崩，不会静默失效。

## 与文档的不一致

本节记录的是**修复前**的状态，两处都已在 `chore/oxlint-correctness-gate` 分支上改正：

- `AGENTS.md` 曾写「source files enable the `unicorn` plugin with a few rules disabled」。实测 `overrides[].plugins: ["unicorn"]` 从未生效（`--print-config` 下 `app/` 的 unicorn 规则数为 0），该描述在 `1.91.0` 上不成立；现已改为陈述实际的插件集与 `correctness: "deny"`。
- `CONTRIBUTING.md` 曾把 `bun run lint` 列为提交前检查，而该命令当时不检查任何规则——文档描述的保证大于实际；现在该保证成立。
