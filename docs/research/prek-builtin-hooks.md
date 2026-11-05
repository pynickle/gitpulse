# prek 0.5.10 内置钩子核实与 GitPulse 适配评估

评估日期：2026-11-05。依据三份一手材料交叉核对：

1. prek **0.5.10 版本化文档**（`https://prek.j178.dev/0.5.10/`）及其在 tag `v0.5.10` 的文档源文件；
2. tag `v0.5.10` 的 Rust 源码（`crates/prek/src/hooks/builtin_hooks/mod.rs` 的 id → 默认值映射表、`crates/prek-identify/src/tags.rs` 的 type 集合）；
3. 本仓库已安装的二进制 `node_modules/.bin/prek` → `prek 0.5.10 (516f5bdce 2026-11-04)`，实跑 `prek util list-builtins`。

下文所有"默认 types / 默认 stages / 是否 FIXER"均来自第 2 项源码，不是文档转述；凡未核实处一律标注 **未核实**。

## 结论

1. **0.5.10 共 33 个内置钩子**，三处数量完全一致：文档 Supported Hooks 33 条、源码 `BuiltinHooks` enum 33 个变体、`prek util list-builtins` 33 条。无多无少。
2. **`repo = "builtin"` 是 0.5.10 的正确写法**（不是 `repo: https://github.com/pre-commit/pre-commit-hooks`）。后者是"自动 fast path"：保留远程仓库配置、仍会 clone 并建环境，只是执行时走 Rust 实现。prek 自己的 `prek.toml` 也用 `repo = "builtin"`。
3. **FIXER / CHECKER 必须分开看**。33 个里 8 个是 FIXER（会写文件）：`trailing-whitespace`、`end-of-file-fixer`、`file-contents-sorter`、`requirements-txt-fixer`、`fix-byte-order-marker`、`mixed-line-ending`、`normalize-indentation`、`replace-pattern`，外加 `pretty-format-json`（只有带 `--autofix` 才写）。其中 5 个 FIXER 带 `--check` 可降级为 CHECKER：`trailing-whitespace`、`end-of-file-fixer`、`file-contents-sorter`、`requirements-txt-fixer`、`fix-byte-order-marker`。`mixed-line-ending --fix=no`、`normalize-indentation --check`、`replace-pattern --check` 同理。
4. 本仓库**已经**用了 `repo = "builtin"` 且只挂了 `fix-byte-order-marker`（一个 FIXER）。这意味着当前 pre-commit 已经会在每次提交时悄悄改写文本文件的 BOM —— 这一点 `CONTRIBUTING.md` 没有写。
5. 对 GitPulse 值得新增的是 **3 个 CHECKER**：`check-added-large-files`、`check-jsonc`、`check-merge-conflict`，外加安全网 `detect-private-key`。低风险可选：`check-case-conflict`、`check-illegal-windows-names`、`check-xml`、`mixed-line-ending`。
6. **风险最高、不要加的是 `normalize-indentation`**：它按 `--indent=spaces --tab-size=4` 重写行首缩进，而本仓库 `.editorconfig` 只有 `indent_size=2`，且同时存在 Vue SFC、YAML 块标量、Markdown 代码块、Dart 多行字符串 —— 默认值会一次改错数千行。`pretty-format-json` 同理（默认排序键 + 强制 LF），会与 `oxfmt` 和手写的 i18n 键序打架。
7. **CI 不跑 prek**：`.github/workflows/ci.yml` 直接跑 `bun run fmt:check` / `bun run lint` / `bunx nuxi typecheck` / `bun test --parallel` / `bun run build`，没有 `prek`。因此新增的任何内置钩子都只是**本地**守卫，`git commit --no-verify` 即可绕过，CI 不会兜底。要让守卫真正生效，需要在 CI 增加一步 `prek run --all-files`（本文件不实施）。
8. **文档与实现不一致（本仓库）**：`CONTRIBUTING.md` 写"`prek.toml` 当前运行"的只有 `bun run fmt:check` 与 `bun run lint`，漏掉了 `repo = "builtin"` 的 `fix-byte-order-marker`。
9. **一处曾被误判为不一致，已撤回**：`AGENTS.md` 写"LF enforced by `.gitattributes`"是准确的。本机工作区确实有 **48 个文件是纯 CRLF**（47 个 `flutter/` + 根 `LICENSE`，`git ls-files --eol` 的 `w/crlf`），但那不是属性失效 —— `* text=auto eol=lf` 同时约束入库与检出：把其中一个文件删掉重新 checkout，它立刻变回 `w/lf`。这 48 个是属性加上之前就已经写在盘上的陈旧副本，而 Git 从不回头重写已存在的文件。
10. **官方文档路径提示**：任务里猜的 `/builtin/` 与 `/reference/builtin-hooks/` 在 0.5.10 上都是 404。正确路径是 `/built-in-hooks/`（使用指南）与 `/reference/built-in-hooks/`（逐钩子参考）。

## 一、内置钩子在 0.5.10 里的声明方式

`repo = "builtin"` 后按 id 选钩子：

```toml
[[repos]]
repo = "builtin"

[[repos.hooks]]
id = "trailing-whitespace"

[[repos.hooks]]
id = "check-added-large-files"
args = ["--maxkb=1024"]
```

也可以用内联数组一次挂多个（`hooks = [{ id = "trailing-whitespace" }, …]`），prek 文档与 prek 自身 `prek.toml` 两种写法都在用；本仓库现有 `prek.toml` 用的是 `[[repos.hooks]]` 形式。

规则（源码 `builtin_hooks/mod.rs` + 文档 Configuration notes）：

| 项                  | 0.5.10 的行为                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repo`              | 必须是字面量 `"builtin"`；不是 URL                                                                                                                                  |
| `entry`             | **不允许**设置（`from_id` 会填入内置 entry，如 `trailing-whitespace-fixer`）                                                                                        |
| `language`          | 必须是 `system`，可省略                                                                                                                                             |
| `rev`               | 不需要                                                                                                                                                              |
| `id`                | 必须是 33 个之一；其余字段全部有默认值                                                                                                                              |
| `name`              | 省略则用内置名（如 `check for added large files`）                                                                                                                  |
| `args`              | 同 `pre-commit` 的 `args: [...]`；每个钩子支持哪些 flag 见下                                                                                                        |
| `files` / `exclude` | 正则字符串，**或** prek 的 `{ glob = ... }` 对象（prek 自己的 `prek.toml` 写的是 `exclude = { glob = "CHANGELOG.md" }`、`files = { glob = ["prek.schema.json"] }`） |
| `types`             | 默认由内置表给定（见下表）；显式写会**覆盖**默认，不是追加                                                                                                          |
| `stages`            | 未显式设置时**继承**项目级 `default_stages`（本仓库为 `["pre-commit"]`）；部分钩子自带 stages，见下表                                                               |
| `always_run`        | 仅 `no-commit-to-branch`、`check-signed-commit`、`check-commit-trailers` 默认 true                                                                                  |
| `pass_filenames`    | 仅 `no-commit-to-branch`、`check-signed-commit` 默认 `none`                                                                                                         |
| `priority`          | prek 特有；同 `priority` 的钩子可并发，`replace-pattern` 文档明确要求"改同一批文件的规则不要共享并发 priority"                                                      |
| `groups`            | prek 特有（源码 `BuiltinHook` 结构体字段）                                                                                                                          |
| `include_deleted`   | prek 特有，0.5.4 新增，允许钩子看到被删除的文件                                                                                                                     |

> **转义提示（一手材料互相矛盾处）**：官方文档的 TOML 示例把正则写成 `files = '\\.md$'`，而同一 tag 的 prek 自身 `prek.toml` 写成 `files = '\.toml$'`。TOML 字面量字符串（单引号）不处理转义，因此后者才是正确写法；前者作为正则会多要求一个反斜杠。本文件所有 TOML 示例采用与 prek 自身配置一致的单反斜杠。

## 二、33 个内置钩子总表

类型：**F** = FIXER（会改写文件），**C** = CHECKER（只报错）。stages 列写"继承"表示源码未设 `stages`，跟随 `default_stages`。

|   # | `id`                                   | 作用                          | 类型                 | 默认 `types`           | 默认 `stages`                  | 关键参数（默认值）                                                                |
| --: | -------------------------------------- | ----------------------------- | -------------------- | ---------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
|   1 | `trailing-whitespace`                  | 删除行尾空白                  | F（可 `--check`）    | `text`                 | pre-commit / pre-push / manual | `--check`；`--markdown-linebreak-ext=<ext>`；`--chars=<chars>`                    |
|   2 | `check-added-large-files`              | 阻止提交超大文件              | C                    | 无（不过滤）           | pre-commit / pre-push / manual | `--maxkb=<N>`（500）；`--enforce-all`                                             |
|   3 | `check-case-conflict`                  | 大小写冲突（含父目录）        | C                    | 无                     | 继承                           | 无                                                                                |
|   4 | `check-illegal-windows-names`          | Windows 非法文件名            | C                    | 无                     | 继承                           | 无                                                                                |
|   5 | `end-of-file-fixer`                    | 文件以单个换行结尾            | F（可 `--check`）    | `text`                 | pre-commit / pre-push / manual | `--check`                                                                         |
|   6 | `file-contents-sorter`                 | 按行排序文件内容              | F（可 `--check`）    | 无                     | 继承                           | `--check`；`--ignore-case`；`--unique`                                            |
|   7 | `requirements-txt-fixer`               | 排序 requirements/constraints | F（可 `--check`）    | 无（`files` 默认正则） | 继承                           | `--check`                                                                         |
|   8 | `fix-byte-order-marker`                | 删除 UTF-8 BOM                | F（可 `--check`）    | `text`                 | 继承                           | `--check`                                                                         |
|   9 | `forbid-new-submodules`                | 禁止新增子模块                | C                    | `directory`            | 继承                           | 无                                                                                |
|  10 | `check-json`                           | JSON 可解析（拒重复键）       | C                    | `json`                 | 继承                           | 无                                                                                |
|  11 | `check-json5`                          | JSON5 可解析                  | C                    | `json5`                | 继承                           | 无                                                                                |
|  12 | `check-jsonc`                          | JSONC 可解析                  | C                    | `jsonc`                | 继承                           | `--allow-trailing-commas`                                                         |
|  13 | `pretty-format-json`                   | JSON 美化格式                 | F（仅 `--autofix`）  | `json`                 | pre-commit / pre-push / manual | `--autofix`；`--indent`（2）；`--no-ensure-ascii`；`--no-sort-keys`；`--top-keys` |
|  14 | `check-toml`                           | TOML 可解析                   | C                    | `toml`                 | 继承                           | 无                                                                                |
|  15 | `check-vcs-permalinks`                 | 要求 VCS 链接是永久链接       | C                    | `text`                 | 继承                           | `--additional-github-domain=<domain>`                                             |
|  16 | `check-yaml`                           | YAML 可解析                   | C                    | `yaml`                 | 继承                           | `-m/--allow-multiple-documents`；`--disallow-unknown-tags`；`--unsafe`            |
|  17 | `check-xml`                            | XML 可解析                    | C                    | `xml`                  | 继承                           | 无                                                                                |
|  18 | `deny-filename-pattern`                | 文件名命中正则即失败          | C                    | 无                     | 继承                           | 位置参数 `PATTERN...`；`-i`                                                       |
|  19 | `deny-pattern`                         | 文件内容命中正则即失败        | C                    | `text`                 | 继承                           | 位置参数 `PATTERN...`；`-i`；`-m/--multiline`                                     |
|  20 | `replace-pattern`                      | 正则替换文本                  | F（可 `--check`）    | `text`                 | pre-commit / pre-push / manual | `PATTERN REPLACEMENT`；`-i`；`-m`；`--check`                                      |
|  21 | `require-filename-pattern`             | 文件名不匹配即失败            | C                    | 无                     | 继承                           | 位置参数 `PATTERN...`；`-i`                                                       |
|  22 | `require-pattern`                      | 内容不匹配即失败              | C                    | `text`                 | 继承                           | 位置参数 `PATTERN...`；`-i`；`-m`                                                 |
|  23 | `mixed-line-ending`                    | 混合行尾修复/检查             | F（`--fix=no` 降级） | `text`                 | 继承                           | `-f/--fix`（`auto`：auto/no/lf/crlf/cr）                                          |
|  24 | `normalize-indentation`                | 统一行首缩进                  | F（可 `--check`）    | `text`                 | pre-commit / pre-push / manual | `--indent`（spaces）；`--tab-size`（4）；`--check`                                |
|  25 | `check-symlinks`                       | 断链符号链接                  | C                    | `symlink`              | 继承                           | 无                                                                                |
|  26 | `destroyed-symlinks`                   | 符号链接被替换成普通文件      | C                    | `file`                 | pre-commit / pre-push / manual | 无                                                                                |
|  27 | `check-merge-conflict`                 | 冲突标记                      | C                    | `text`                 | 继承                           | `--assume-in-merge`                                                               |
|  28 | `detect-private-key`                   | 私钥特征串                    | C                    | `text`                 | 继承                           | 无                                                                                |
|  29 | `no-commit-to-branch`                  | 保护分支禁止直接提交          | C                    | —                      | 继承（`always_run`）           | `-b/--branch`（main、master）；`-p/--pattern`                                     |
|  30 | `check-signed-commit`                  | 提交必须已签名                | C                    | —                      | pre-push / manual              | 无                                                                                |
|  31 | `check-commit-trailers`                | 必需/禁止的 commit trailer    | C                    | —                      | commit-msg / pre-push          | `--require KEY[=REGEX]`；`--deny KEY[=REGEX]`                                     |
|  32 | `check-shebang-scripts-are-executable` | 有 shebang 的脚本必须可执行   | C                    | `text`                 | pre-commit / pre-push / manual | 无                                                                                |
|  33 | `check-executables-have-shebangs`      | 可执行文件必须有 shebang      | C                    | `executable`+`text`    | pre-commit / pre-push / manual | 无                                                                                |

## 三、逐个钩子详情

> 每个条目的"默认选择"直接来自 `builtin_hooks/mod.rs` 的 `from_id`；`types` 名称对应 `prek-identify` 的 tag（`text`=262、`json`=136、`json5`=137、`jsonc`=138、`toml`=267、`xml`=310、`yaml`=314、`executable`=74、`symlink`=255、`file`=78、`directory`=58）。

### 1. `trailing-whitespace`

- **作用**：删除每行行尾空白。
- **类型**：FIXER（写文件后退出 1）；`--check` 降级为 CHECKER。
- **参数**：`--check`（prek 独有）；`--markdown-linebreak-ext=<ext>`（可重复/逗号分隔，`*` 表示全部按 Markdown）；`--chars=<chars>`（只删指定字符集，如 `" \t"`）。
- **默认选择**：`types = [text]`；`files` 未设；`stages` 显式 pre-commit/pre-push/manual。
- **注意**：`--markdown-linebreak-ext` 的默认值文档与 `--help` 均未标注（**未核实**，推断为空）。`--markdown-linebreak-ext` 只接受扩展名，不接受路径分隔符。
- **版本**：0.3 时代即存在；0.5.4 增加 `--check`；0.5.5 修复"空字符集被当成默认值"。

### 2. `check-added-large-files`

- **作用**：阻止超大文件进入提交。
- **类型**：CHECKER。
- **参数**：`--maxkb=<N>`（默认 `500`，单位 KiB，大小**向上取整**，故 `--maxkb=0` 只放行空文件）；`--enforce-all`（连非新增文件也检查）。
- **默认选择**：未设 `types`/`files`（不做类型过滤）；`stages` 显式 pre-commit/pre-push/manual。
- **注意**：默认**只检查本次暂存为新增（A）的文件**；git attributes 标了 `filter=lfs` 的文件跳过。本仓库最大跟踪文件 `bun.lock` 326 KB、`flutter/assets/document_viewer/viewer.js` 304 KB，均在 500 KB 以下。
- **版本**：0.3.x 起；0.5.5 改为向上取整。

### 3. `check-case-conflict`

- **作用**：检出在大小写不敏感文件系统上会冲突的路径。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：未设 `types`/`files`；`stages` 继承。
- **注意**：同时检查父目录，因此目录级大小写冲突也会报；`always_run=false` 时只看本次提交涉及的文件。对同时在 macOS/Linux/Windows 上开发的本仓库有意义。
- **版本**：0.3.x 起。

### 4. `check-illegal-windows-names`

- **作用**：检出 Windows 上无法创建的文件名。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：源码把 `files` 设为预编译正则 `ILLEGAL_WINDOWS_PATTERN`（内容 **未核实**，语义上用于预筛）；`types` 未设。
- **注意**：报告保留设备名（`CON`、`PRN`、`AUX`、`NUL`、`COM1`、`LPT1`…）、非法字符（`< > : " \ | ? *` 与控制字符）、以及以 `.` 或空格结尾的路径段。
- **版本**：0.3.8 新增。

### 5. `end-of-file-fixer`

- **作用**：保证文件要么为空，要么以恰好一个换行结尾。
- **类型**：FIXER（写文件后退出 1）；`--check` 降级。
- **参数**：`--check`。
- **默认选择**：`types = [text]`；`stages` 显式 pre-commit/pre-push/manual。
- **注意**：空文件不动；只含换行的文件会被截成空；缺尾换行时补 `\n`（即使文件其余部分是 CRLF）；多个尾换行会被压成一个。
- **版本**：0.0.11 即存在；0.5.4 增加 `--check`。

### 6. `file-contents-sorter`

- **作用**：对文件里的非空行排序并回写。
- **类型**：FIXER（可 `--check`）。
- **参数**：`--check`；`--ignore-case`（ASCII 折叠排序，与 `--unique` 互斥）；`--unique`（排序去重，与 `--ignore-case` 互斥）。
- **默认选择**：**`files` 默认为"永不匹配"（`FilePattern::Never`）**，因此不显式配置 `files` 就一个文件都不会选；`types` 未设。
- **注意**：排序前会丢掉所有空行与纯空白行；回写把行尾统一成 `\n`（会把 CRLF 文件整体改写）。
- **版本**：0.3.8 新增；0.5.4 增加 `--check`。

### 7. `requirements-txt-fixer`

- **作用**：按（大小写不敏感的）包名排序 Python 依赖文件。
- **类型**：FIXER（可 `--check`）。
- **参数**：`--check`。
- **默认选择**：`files` 默认为正则 `(requirements|constraints).*\.txt$`；`types` 未设。
- **注意**：行首注释与续行会跟着对应条目一起移动；重复条目合并（优先保留带注释的那份）；`pkg-resources==0.0.0` / `pkg_resources==0.0.0` 会被删除。**不是** PEP 508 校验器。
- **版本**：0.4.11 新增；0.5.4 增加 `--check`。

### 8. `fix-byte-order-marker`

- **作用**：删除文件开头的 UTF-8 BOM（`EF BB BF`）。
- **类型**：FIXER（写文件后退出 1）；`--check` 降级。
- **参数**：`--check`。
- **默认选择**：`types = [text]`；`stages` 继承。
- **注意**：只处理 UTF-8 BOM，不处理 UTF-16/32 BOM。
- **版本**：早期即有；**本仓库当前唯一启用的内置钩子**。

### 9. `forbid-new-submodules`

- **作用**：禁止新增 Git 子模块。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`types = [directory]`（子模块在索引里表现为 gitlink/目录）；`stages` 继承。
- **注意**：已有子模块放行，只报本次变更新增的；`PRE_COMMIT_FROM_REF` + `PRE_COMMIT_TO_REF` 都设置时改查该 revision 区间。
- **版本**：0.3.9 新增。

### 10. `check-json`

- **作用**：JSON 语法可解析。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`types = [json]`（含 `.json`、`.ipynb`、`.geojson`、`.babelrc`、`.jshintrc` 等带 json 标签的文件）；`stages` 继承。
- **注意**：**拒绝空文件**、拒绝文档尾部的多余数据、**拒绝重复键**（`duplicate key ...`）——三条都是相对上游 Python 实现的额外严格度。0.5.6 起接受 UTF-8 BOM。深层嵌套不受默认递归限制。
- **版本**：0.0.24 新增；0.5.5/0.5.6 收紧。

### 11. `check-json5`

- **作用**：JSON5 语法可解析。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`types = [json5]`（只有 `.json5`）；`stages` 继承。
- **注意**：同样拒绝重复键。本仓库无 `.json5` 文件。
- **版本**：0.2.30 起就有重复键检查。

### 12. `check-jsonc`

- **作用**：JSONC（带注释的 JSON）语法可解析。
- **类型**：CHECKER。
- **参数**：`--allow-trailing-commas`（默认为**拒绝**尾随逗号）。
- **默认选择**：`types = [jsonc]`（只有 `.jsonc`）；`stages` 继承。
- **注意**：想校验 `.json` 里的 JSONC（如 `tsconfig.json`）必须显式覆盖 `types = ["json"]` 并配 `files`。同样拒绝重复键。
- **版本**：0.5.3 新增。

### 13. `pretty-format-json`

- **作用**：检查 JSON 是否"美化"格式，可回写。
- **类型**：带 `--autofix` 时是 FIXER，否则 CHECKER。
- **参数**：`--autofix`；`--indent=<indent>`（默认 `2`，非数字按字面使用，如 `\t`）；`--no-ensure-ascii`（不把非 ASCII 转 `\uXXXX`）；`--no-sort-keys`；`--top-keys=<k1,k2,...>`（递归作用于嵌套对象）。
- **默认选择**：`types = [json]`；`stages` 显式 pre-commit/pre-push/manual。
- **注意**：**默认排序键**，且回写恒用 LF + 恰好一个尾换行；0.5.10 里它仍然**只能**经 `repo: builtin` 使用（自动 fast path 明确不启用它，源码里被注释掉）。
- **版本**：0.3.8 新增。

### 14. `check-toml`

- **作用**：TOML 语法可解析。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`types = [toml]`；`stages` 继承。
- **注意**：必须是合法 UTF-8（否则报错）；一个文件可能报多条解析错误。
- **版本**：早期即有。

### 15. `check-vcs-permalinks`

- **作用**：要求 VCS 网页链接是永久链接（commit hash）而不是分支名。
- **类型**：CHECKER。
- **参数**：`--additional-github-domain=<domain>`（可重复，默认已含 `github.com`）。
- **默认选择**：`types = [text]`；`stages` 继承。
- **注意**：命中形式为 `https://<domain>/<owner>/<repo>/blob/<branch>/...#L...`；若 `<branch>` 已是 4–64 位十六进制（commit 短/全 hash）则不报。**本仓库当前有 17 处 `/blob/main/` 或 `/blob/master/` 链接**，直接启用会立刻失败。
- **版本**：0.3.8 新增。

### 16. `check-yaml`

- **作用**：YAML 语法可解析。
- **类型**：CHECKER。
- **参数**：`-m/--allow-multiple-documents`（别名 `--multi`）；`--disallow-unknown-tags`；`--unsafe`（只解析不加载，隐含允许多文档）。
- **默认选择**：`types = [yaml]`；`stages` 继承。
- **注意**：**默认允许未知 tag**，与上游 Python 实现默认拒绝相反；要匹配上游需加 `--disallow-unknown-tags`（0.5.1 曾改为拒绝，0.5.2 又改回允许）。
- **版本**：早期即有；0.5.1/0.5.2 行为反复。

### 17. `check-xml`

- **作用**：XML 语法可解析。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`types = [xml]`；`stages` 继承。
- **注意**：空文件视为非法 XML；文档元素之后还有内容（多个根）也报错。
- **版本**：0.3.x 起。

### 18. `deny-filename-pattern`

- **作用**：任一被选中文件的**basename** 命中正则即失败。
- **类型**：CHECKER。
- **参数**：位置参数 `PATTERN...`（必填，`--` 可分隔以 `-` 开头的模式）；`-i/--ignore-case`。
- **默认选择**：未设 `types`/`files`（由 `files`/`exclude`/类型过滤筛完后，再用参数匹配 basename）；`stages` 继承。
- **注意**：只看最后一段路径；多模式是"任一命中即失败"。报错格式 `path: filename matches a denied pattern`。
- **版本**：0.5.x 已有（pattern 系列）。

### 19. `deny-pattern`

- **作用**：任一被选中**文本文件**命中正则即失败。
- **类型**：CHECKER。
- **参数**：位置参数 `PATTERN...`；`-i/--ignore-case`；`-m/--multiline`（整文件搜索，`.` 跨行，`^`/`$` 只匹配行边界，会把文件读进内存）。
- **默认选择**：`types = [text]`；`stages` 继承。
- **注意**：默认按行报 `path:line:contents`，一行命中多模式只报一次；`--multiline` 下报最早一处。0.5.4 起支持 look-around 正则。
- **版本**：0.4.11 新增。

### 20. `replace-pattern`

- **作用**：对文本文件做单条正则替换。
- **类型**：FIXER（可 `--check`）；仅当替换真正改变内容时才失败。
- **参数**：位置参数 `PATTERN REPLACEMENT`（必填，空替换即删除）；`-i`；`-m/--multiline`；`--check`。
- **默认选择**：`types = [text]`；`stages` 显式 pre-commit/pre-push/manual。
- **注意**：替换模板支持 `$0`、`$1`/`${1}`、`$name`/`${name}`、`$$`；未知捕获组是错误。默认逐行匹配（不含行尾），未触及的字节与行尾原样保留。**规则按配置顺序执行**，改同一批文件的规则不要共享并发 `priority`。
- **版本**：**0.5.10 新增**（本版唯一新增）。

### 21. `require-filename-pattern`

- **作用**：任一被选中文件的 basename **不**匹配任何一条正则即失败（逐文件要求）。
- **类型**：CHECKER。
- **参数**：位置参数 `PATTERN...`；`-i`。搜索语义，要整名匹配需自己加 `^`/`$`。
- **默认选择**：未设 `types`/`files`；`stages` 继承。
- **注意**：不同文件可命中不同模式，但每个文件至少要命中一条。
- **版本**：0.5.x 已有。

### 22. `require-pattern`

- **作用**：任一被选中文本文件**不**匹配任何一条正则即失败。
- **类型**：CHECKER。
- **参数**：位置参数 `PATTERN...`；`-i`；`-m/--multiline`。
- **默认选择**：`types = [text]`；`stages` 继承。
- **注意**：逐文件要求，不是"任一文件命中即可"。
- **版本**：0.4.11 新增。

### 23. `mixed-line-ending`

- **作用**：修复或检查混合行尾。
- **类型**：默认 FIXER；`--fix=no` 时为 CHECKER。
- **参数**：`-f/--fix=<mode>`，默认 `auto`（auto / no / lf / crlf / cr，`cr` 是 prek 独有）。
- **默认选择**：`types = [text]`；`stages` 继承。
- **注意**：**`auto` 只对"混合行尾"的文件动手**——源码先判断是否同时存在多种行尾，目标取出现次数最多者（平局偏好 LF），若不混杂则原样放行。因此"整文件纯 CRLF"不会被 `auto` 改写。空文件与含 NUL 的二进制文件跳过。`lf`/`crlf` 与 git 的 `core.autocrlf` 可能互相干扰。
- **版本**：0.0.25 新增（README 记为 `mixed_line_ending`）。

### 24. `normalize-indentation`

- **作用**：把行首缩进统一成空格或 tab。
- **类型**：FIXER；`--check` 时只报不改（且**扫到第一处需改就停**）。
- **参数**：`--indent=<spaces|tabs>`（默认 `spaces`）；`--tab-size=<N>`（1–255，默认 `4`）；`--check`。
- **默认选择**：`types = [text]`；`stages` 显式 pre-commit/pre-push/manual。
- **注意**：非语言感知——对 Markdown 代码块、YAML 块标量、Makefile、Dart 多行字符串都可能改错；只重写行首空格/tab，保留列宽（按 `--tab-size` 换算）；空行与纯空白行不动；保留行尾、缺失的尾换行与 UTF-8 BOM；含 NUL 的二进制跳过。
- **版本**：**0.5.9 新增**。

### 25. `check-symlinks`

- **作用**：检出断链（指向不存在目标）的符号链接。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`types = [symlink]`；`stages` 继承。
- **注意**：依赖文件系统的符号链接能力；Windows 上创建与识别都受权限影响。
- **版本**：0.3.x 起。

### 26. `destroyed-symlinks`

- **作用**：检出"本该是符号链接、却被以普通文件提交（内容就是目标路径）"的文件。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`types = [file]`；`stages` 显式 pre-commit/pre-push/manual。
- **注意**：只看 `git status --porcelain=v2` 报出的被跟踪条目；比较时会忽略"仅尾部 ASCII 空白差异"（空格、tab、换行/CRLF 转换），因为格式化钩子常制造这种差异。
- **版本**：0.3.8 新增。

### 27. `check-merge-conflict`

- **作用**：检出冲突标记。
- **类型**：CHECKER。
- **参数**：`--assume-in-merge`（没有检测到 merge/rebase 状态时也运行）。
- **默认选择**：`types = [text]`；`stages` 继承。
- **注意**：默认在非 merge/rebase 状态下直接成功退出；只认行首标记；识别 `<<<<<<<`、`=======`、`>>>>>>>` 与 diff3 的 `|||||||`，且 `=======` 只在出现过 `<<<<<<<` 后才算，避免误伤 reST 标题。
- **版本**：0.3.x 起。

### 28. `detect-private-key`

- **作用**：检出私钥。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`types = [text]`；`stages` 继承。
- **注意**：是**启发式子串扫描**，识别 PEM 私钥头（`-----BEGIN` 之后跟密钥类型、`-----END` 成对收尾），会漏报也会误报；不含密钥强度/有效性判断。它在**文档里出现示例字面量时同样会命中** —— 本节初稿把两个头部字面量原样写了出来，提交时被这个钩子自己拦下，只能改成描述。
- **版本**：0.3.x 起。

### 29. `no-commit-to-branch`

- **作用**：禁止直接向受保护分支提交。
- **类型**：CHECKER。
- **参数**：`-b/--branch <branch>`（可重复，默认 `main`、`master`）；`-p/--pattern <regex>`（可重复）。
- **默认选择**：`always_run = true`、`pass_filenames = none`（源码显式设置），因此 `files`/`exclude`/`types` **会被忽略**，除非显式设 `always_run = false`。
- **注意**：detached HEAD 下不做任何事。
- **版本**：0.3.x 起；0.5.5 修复"从开头匹配保护分支模式"。

### 30. `check-signed-commit`

- **作用**：确保被推送的提交都有有效 GPG/SSH 签名。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`stages = [pre-push, manual]`、`always_run = true`、`pass_filenames = none`（均源码显式设置）。
- **注意**：manual 运行只查 `HEAD`；根/孤儿推送查整条历史；合并提交跳过；依赖本地 `git verify-commit`，缺工具或缺公钥都算失败。
- **版本**：0.5.6 新增。

### 31. `check-commit-trailers`

- **作用**：校验 commit message 尾部 trailer 的"必需/禁止"。
- **类型**：CHECKER。
- **参数**：`--require KEY[=REGEX]`；`--deny KEY[=REGEX]`（都需至少配一条，可重复、可混用）。
- **默认选择**：`stages = [commit-msg, pre-push]`、`always_run = true`（源码显式设置）。
- **注意**：trailer 必须是消息末尾、与正文以空行分隔的 `Key: value` 块；键大小写不敏感，值模式默认大小写敏感（`(?i)` 可忽略）；合并提交跳过，squash 提交会查；`pre-push` 只检查第一个有待推送提交的 ref。
- **版本**：0.5.6 新增。

### 32. `check-shebang-scripts-are-executable`

- **作用**：以 `#!` 开头的（非二进制）文件必须有可执行位。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`types = [text]`；`stages` 显式 pre-commit/pre-push/manual。
- **注意**：只检查"文件是否以 `#!` 开头"；不跟踪可执行位的文件系统上改查 git 暂存区的 mode 位。Windows/NTFS 上可执行位不可靠，容易误报。
- **版本**：0.3.8 新增；0.5.5 批量读取、`core.fileMode` 缺失默认值修复。

### 33. `check-executables-have-shebangs`

- **作用**：可执行的（非二进制）文件必须以 shebang 开头。
- **类型**：CHECKER。
- **参数**：无。
- **默认选择**：`types = [executable, text]`（可执行**且**文本）；`stages` 显式 pre-commit/pre-push/manual。
- **注意**：同样只验证"以 `#!` 开头"，不做解释器解析；可执行位不可靠时查 git 暂存区 mode。
- **版本**：0.3.x 起。

## 四、0.5.x 变更（截至 0.5.10）

数据来自 tag `v0.5.10` 的 `CHANGELOG.md`；0.5.8 没有对应小节（版本号跳过）。

| 版本   | 日期       | 内置钩子相关变更                                                                                                                                                                                                                                                                 |
| ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.5.0  | 2026-08-27 | 无新增；允许显式 `language: python` 主动退出 fast path                                                                                                                                                                                                                           |
| 0.5.1  | 2026-09-01 | `check-yaml` 改为拒绝不支持的 tag                                                                                                                                                                                                                                                |
| 0.5.2  | 2026-09-03 | `check-yaml` 又改回"默认允许未知 tag"（即 0.5.10 的行为）                                                                                                                                                                                                                        |
| 0.5.3  | 2026-09-13 | **新增 `check-jsonc`**                                                                                                                                                                                                                                                           |
| 0.5.4  | 2026-09-28 | `end-of-file-fixer`、`file-contents-sorter`、`requirements-txt-fixer`、`trailing-whitespace` **增加 `--check`**；pattern 系列支持 look-around 正则；新增 `include_deleted`                                                                                                       |
| 0.5.5  | 2026-10-05 | 修复：`check-added-large-files` 大小向上取整、`check-json` 拒绝空文件与尾部多余数据、`check-case-conflict`（只查暂存新增）、`destroyed-symlinks`（跳过未跟踪）、shebang 两项（batch 读取 / `core.fileMode`）、`no-commit-to-branch` 模式从头匹配、`trailing-whitespace` 空字符集 |
| 0.5.6  | 2026-10-19 | **新增 `check-commit-trailers`、`check-signed-commit`**；`check-json` 接受 UTF-8 BOM                                                                                                                                                                                             |
| 0.5.7  | 2026-10-21 | 无内置钩子变更（CPU 密集型内置钩子改用阻塞式文件检查）                                                                                                                                                                                                                           |
| 0.5.9  | 2026-10-30 | **新增 `normalize-indentation`**                                                                                                                                                                                                                                                 |
| 0.5.10 | 2026-11-04 | **新增 `replace-pattern`**（本版唯一新增）                                                                                                                                                                                                                                       |

更早的来源（用于说明"不是 0.5.x 才有"）：`file-contents-sorter`、`pretty-format-json`、`check-vcs-permalinks`、`check-illegal-windows-names`、`check-shebang-scripts-are-executable`、`destroyed-symlinks` 均为 0.3.8 新增；`forbid-new-submodules` 0.3.9；`deny-pattern`/`require-pattern`/`requirements-txt-fixer` 0.4.11。0.5.0 之前的完整清单 **未逐条核实**。

## 五、GitPulse 适配评估

### 5.1 仓库现状（实测）

| 事项                       | 事实                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 跟踪文件                   | 1244 个：`.ts` 572、`.vue` 196、`.dart` 196、`.md` 93、`.png` 73、`.json` 17、`.yml` 10、`.xml` 9、`.yaml` 4 等                                               |
| 主要目录                   | `app/` 368、`flutter/` 339、`server/` 184、`tests/` 156、`docs/` 84、`shared/` 56、`extension/` 21、`.github/` 11                                             |
| 格式化                     | `bunx oxfmt ./`（oxfmt **0.76.0**）。`.oxfmtrc.json` 的 `ignorePatterns` 排除 `.github/renovate.jsonc`、`flutter/**`、`.scratch/**`                           |
| oxfmt 实际覆盖（本机实测） | Markdown / YAML / TOML / JSON / JS-TS / Vue / CSS 会被真正改写；**Dart 完全不被处理**（`Expected at least one target file`）                                  |
| 校验                       | `oxlint ./ --type-aware --ignore-pattern extension/ --ignore-pattern flutter/`，`correctness: deny`                                                           |
| 换行                       | `.gitattributes` = `* text=auto eol=lf`，同时约束入库与检出（删文件重新 checkout 得 `w/lf`）；本机工作区已无 CRLF 文件                                        |
| 缩进                       | `.editorconfig` 只有 `indent_size=2`，无 `indent_style`                                                                                                       |
| 生成物                     | `flutter/lib/**/*.g.dart` 共 8 个（json_serializable/build_runner）；锁文件 5 个（`bun.lock` 326 KB 最大）                                                    |
| 二进制                     | 72 个图片/字体在 `flutter/`，3 个在 `public/`；最大 175 KB（`public/favicon.ico`）                                                                            |
| 符号链接                   | 无（`git ls-files -s` 中 0 个 mode `120000`），工作区的 `dist` 是未跟踪链接                                                                                   |
| 子模块                     | 无 `.gitmodules`                                                                                                                                              |
| 冲突标记 / 私钥 / keystore | 跟踪文件中 0 处冲突标记、0 处私钥头、0 个 `.jks/.keystore/.pem/.p12`                                                                                          |
| shebang 文件               | 0 个（`.py/.sh/.ts/.mjs` 中没有任何文件以 `#!` 开头）                                                                                                         |
| 文档链接                   | 17 处 `…/blob/main/` 或 `…/blob/master/`                                                                                                                      |
| 钩子                       | `prek.toml`：`repo="builtin"` → `fix-byte-order-marker`；`repo="local"` → `bun run fmt:check`、`bun run lint`（均 `pass_filenames=false`、`always_run=true`） |
| CI                         | `.github/workflows/ci.yml` 跑 fmt/lint/typecheck/test/build，**不跑 prek**                                                                                    |

### 5.2 判定表（33 项全覆盖）

判定口径：**(a)** 已被现有工具覆盖 → 收益接近 0；**(b)** 值得新增且低风险；**(c)** 高风险或不适用。

| `id`                                   | 判定     | 针对本仓库的一句话理由                                                                                                                                                                                                                         |
| -------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trailing-whitespace`                  | **a**    | `oxfmt` 对根目录的 md/yml/toml/json/ts/vue/css 已经会去行尾空白，`flutter/` 由 `dart format` 管，新增后几乎只剩 `.xml/.kts/.swift` 几个平台文件可抓，收益低于噪声（它会把 Markdown 硬换行当空白删掉，除非逐个配 `--markdown-linebreak-ext`）。 |
| `check-added-large-files`              | **b**    | 仓库有 72 个二进制资源在 `flutter/`，一个误加的 4 MB 截图不会被现有任何检查拦住；默认只查新增文件，对现有 326 KB 的 `bun.lock` 零影响。                                                                                                        |
| `check-case-conflict`                  | **b**    | 项目同时有 `flutter/ios`、`flutter/windows`，贡献者跨 macOS/Windows；当前 0 冲突所以是纯守卫，成本近零。                                                                                                                                       |
| `check-illegal-windows-names`          | **b**    | 同上，且 Windows 是本仓库明确支持的开发平台；纯 CHECKER，不碰文件。                                                                                                                                                                            |
| `end-of-file-fixer`                    | **a**    | `oxfmt` 与 `dart format` 都保证尾换行，新增只会与它们重复。                                                                                                                                                                                    |
| `file-contents-sorter`                 | **c**    | 默认 `files` 永不匹配，一旦配置就会重排整文件并强制 LF；本仓库没有"需要排序的纯行文件"，却会误伤 `shared/data/*.json` 这类手写数据。                                                                                                           |
| `requirements-txt-fixer`               | **c**    | 仓库只有 3 个 `.py` 工具脚本，没有任何 `requirements*.txt` / `constraints*.txt`。                                                                                                                                                              |
| `fix-byte-order-marker`                | **保持** | 已在 `prek.toml` 中启用；它会在提交时静默改写文本文件，属于现有行为，本文件不建议移除。                                                                                                                                                        |
| `forbid-new-submodules`                | **b**    | 仓库无 `.gitmodules`，加一条纯守卫可防止 `flutter/` 依赖被误以子模块形式引入；零误报。                                                                                                                                                         |
| `check-json`                           | **b**    | `oxfmt` 会解析 JSON（本机实测：坏 YAML 直接 `exit=2`），但**不查重复键、不拒绝尾部多余数据**；`shared/data/*.json`、`i18n/locales/*.json` 是手写数据，重复键是真实风险。                                                                       |
| `check-json5`                          | **c**    | 仓库没有任何 `.json5` 文件（`types` 默认只选 `.json5`）。                                                                                                                                                                                      |
| `check-jsonc`                          | **b**    | `.github/renovate.jsonc` **被 `.oxfmtrc.json` 显式排除在 oxfmt 之外**，是当前唯一的 JSONC 盲区；该文件现无尾随逗号，直接可用（若将来加注释式尾逗号再补 `--allow-trailing-commas`）。                                                           |
| `pretty-format-json`                   | **c**    | 默认**排序对象键**并强制 LF，会与 `oxfmt` 的键序策略和 `i18n/locales/*.json` 的人工排序打架，一次提交可能产生上千行无意义 diff。                                                                                                               |
| `check-toml`                           | **a**    | 仓库只有 `prek.toml` 一个 TOML，而 `oxfmt` 已会解析 TOML（本机实测）。                                                                                                                                                                         |
| `check-vcs-permalinks`                 | **c**    | 现有 **17 处 `/blob/main/` 链接**会立即失败；它属于"文档债务清理"任务，不适合作为提交钩子先落地。                                                                                                                                              |
| `check-yaml`                           | **a**    | 10 个 `.yml`（workflow、issue 模板）+ 4 个 `.yaml` 全部在 `oxfmt` 覆盖范围内，语法错误在 `bun run fmt:check` 就会暴露（实测坏 YAML → `exit=2`）。                                                                                              |
| `check-xml`                            | **b**    | 9 个 XML 全在 `flutter/android`（`AndroidManifest.xml`、`styles.xml`、`ic_launcher.xml`），`oxfmt` 不处理 XML；纯 CHECKER，不参与格式化。                                                                                                      |
| `deny-filename-pattern`                | **c**    | 当前没有任何命名违规，加规则纯属引入团队约定；本任务不做策略决策。                                                                                                                                                                             |
| `deny-pattern`                         | **b**    | `oxlint correctness` 不含"禁止 focused test"，而 `tests/`（156 文件）+ `flutter/test/` 大量用 `test(...)`；一条针对 `\.only\s*\(` 的规则能挡住把 `.only` 提交进 CI 的经典事故——必须用 `files` 限定到测试目录，否则会误报文档里的示例。         |
| `replace-pattern`                      | **c**    | 是批量迁移工具，不是常驻守卫；对本仓库它会与 `oxfmt` 争夺同一批 `.ts/.vue/.md` 的最终内容。                                                                                                                                                    |
| `require-filename-pattern`             | **c**    | 会强制一套当前并不存在的文件命名规范（`app/components` 已是 kebab-case 但未被声明为标准），属于策略决策。                                                                                                                                      |
| `require-pattern`                      | **c**    | 仓库没有版权头、许可证头等"每个文件必须具备"的文本约定。                                                                                                                                                                                       |
| `mixed-line-ending`                    | **b**    | 默认 `auto` 只处理**混合行尾**的文件，而本仓库入库内容均为 LF（工作区那 48 个纯 CRLF 文件不会被 `auto` 改写），因此是零误伤的守卫；若改成 `--fix=lf` 才会主动改写工作区。                                                                      |
| `normalize-indentation`                | **c**    | 默认 `--indent=spaces --tab-size=4` 与本仓库 `.editorconfig` 的 `indent_size=2` 直接冲突，且它非语言感知：Vue 模板、YAML 块标量、Markdown 代码块、Dart 多行字符串都会被按 4 列重排，属于本表最高风险项。                                       |
| `check-symlinks`                       | **c**    | 仓库没有被跟踪的符号链接（0 个 `120000`），且 Windows 上符号链接检测受权限影响，收益为 0 而可能引入平台噪声。                                                                                                                                  |
| `destroyed-symlinks`                   | **c**    | 同上，无符号链接可检测。                                                                                                                                                                                                                       |
| `check-merge-conflict`                 | **b**    | 当前 0 处冲突标记（`git grep` 实测），因此是零误报的纯守卫；能在提交前挡住最常见的"冲突没解完就 commit"。                                                                                                                                      |
| `detect-private-key`                   | **b**    | 本仓库涉及 GitHub token、PAT、cookie secret、native login handoff（`server/utils/auth-session-utils.ts`、`server/plugins/personal-mode-validate-secret.ts`），且当前 0 命中；纯 CHECKER，是性价比最高的安全网。                                |
| `no-commit-to-branch`                  | **c**    | 默认保护 `main`/`master`，会直接改变维护者直推主干的习惯；属于流程决策，不应由一次 hook 增补悄悄引入。                                                                                                                                         |
| `check-signed-commit`                  | **c**    | 仓库没有强制 GPG/SSH 签名的约定，且它只在 `pre-push` 生效，会让所有未签名贡献者无法推送。                                                                                                                                                      |
| `check-commit-trailers`                | **c**    | 仓库用 Conventional Commits（`CONTRIBUTING.md`），没有 `Signed-off-by` 等 trailer 约定；启用还需新增 `commit-msg` 安装类型。                                                                                                                   |
| `check-shebang-scripts-are-executable` | **c**    | 仓库 **0 个** 以 `#!` 开头的文件，钩子永远无事可做；而 Windows/NTFS 上可执行位不可靠，日后真加脚本反而容易误报。                                                                                                                               |
| `check-executables-have-shebangs`      | **c**    | 同上，`types = [executable, text]` 在本仓库选不出文件。                                                                                                                                                                                        |

### 5.3 建议落地的最小集合

只加 CHECKER，不改任何现有行为：

```toml
[[repos]]
repo = "builtin"

[[repos.hooks]]
id = "fix-byte-order-marker"

[[repos.hooks]]
id = "check-added-large-files"
args = ["--maxkb=512"]

[[repos.hooks]]
id = "check-jsonc"

[[repos.hooks]]
id = "check-merge-conflict"

[[repos.hooks]]
id = "detect-private-key"
```

可选守卫（同样零改写）：

```toml
[[repos.hooks]]
id = "check-case-conflict"

[[repos.hooks]]
id = "check-illegal-windows-names"

[[repos.hooks]]
id = "check-xml"

[[repos.hooks]]
id = "mixed-line-ending" # 默认 auto：只处理混合行尾，纯 CRLF 文件不动

[[repos.hooks]]
id = "forbid-new-submodules"

[[repos.hooks]]
id = "deny-pattern"
name = "no focused tests"
args = ['\.(only|skip)\s*\(']
files = '(^|/)(tests|flutter/test)/.*\.(ts|dart)$'
```

取舍说明：

- 上表 `check-json` 也可加，但 `oxfmt` 已覆盖语法解析，增量只有"重复键"和"尾部多余数据"两条。
- `deny-pattern` 的 `files` 正则必须限定目录；否则 `docs/` 与 `.agents/skills/` 里描述 `.only` 的文字会误报。
- **不要**把任何 FIXER 加到与 `oxfmt`/`oxlint` 相同的文件集合上：`prek.toml` 里两个 local 钩子已经 `always_run` 跑 `fmt:check`/`lint`，再加一个会改写同一批文件的 FIXER，会出现"钩子 A 改、钩子 B 报错"的循环。
- 若希望这些守卫在 CI 生效，需要在 `.github/workflows/ci.yml` 增加 `prek run --all-files`；本文件不实施该改动，因为它会把本地钩子变成阻塞门禁（需要单独评估 `--all-files` 在 1244 个文件上的耗时）。

### 5.4 与仓库文档不一致之处

| 文件                                      | 文档说法                                                            | 实际                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTRIBUTING.md`（Pre-Commit Checks）    | "`prek.toml` … currently runs `bun run fmt:check` / `bun run lint`" | 还运行 `repo = "builtin"` 的 `fix-byte-order-marker`（会改写文件）                                                                                |
| `AGENTS.md`（Linting, Formatting, Hooks） | "LF enforced by `.gitattributes`"                                   | **不成立（已撤回）** —— 该说法准确。`eol=lf` 对入库与检出都生效，删掉工作区文件重新 checkout 即得 `w/lf`；48 个纯 CRLF 文件是属性生效前的陈旧副本 |
| prek 官方文档 vs 其自身 `prek.toml`       | TOML 示例写 `files = '\\.md$'`                                      | 同一 tag 的 `prek.toml` 写 `files = '\.toml$'`；TOML 字面量不转义，后者才对                                                                       |

## 六、未核实项

明确标注，避免被当成已验证事实：

1. `trailing-whitespace --markdown-linebreak-ext` 的**默认值**：文档与 `prek util list-builtins` 的 flags 输出都未标注默认。**未核实**（推断为空列表）。
2. 各 FIXER 在**改写文件后是否一律退出 1**：`mixed-line-ending` 由源码 `fix_file` 确认（`exit_status = 1`）；其余按文档表述"typically exit non-zero after making changes"，**未逐份核实**。
3. `check-illegal-windows-names` 的 `files` 正则常量 `ILLEGAL_WINDOWS_PATTERN` 的**具体内容**：**未核实**（只确认它被用作默认 `files`）。
4. `priority` 的调度细则（同优先级是否真并发、跨 repo 是否共享）：只在 `replace-pattern` 文档见到"改同一批文件的规则不要共享并发 priority"的约束，**未核实**完整语义。
5. `oxfmt` 对 `.html/.xml/.kts/.swift/.plist` 的行为：只实测了 md / yml / toml / json / vue / ts / css / dart，其余**未核实**。
6. 0.5.0 之前的完整内置钩子新增史：只核对了 changelog 中能定位到版本号的部分，**未逐条核实**。
7. `check-added-large-files` 的 `--maxkb` 单位"KiB"与取整方式来自文档，测试覆盖在 0.5.5 changelog；本仓库未实跑触发，**未核实**边界行为。

## 七、落地决定（2026-11-05）

本节记录逐条确认后的最终选择。§5.2 的判定是研究结论，其中两项被有意推翻，理由一并写在这里；决策本身落在 [`docs/adr/0048-prek-builtin-hook-selection.md`](../adr/0048-prek-builtin-hook-selection.md)。

最终 `prek.toml` 的内置钩子，按配置顺序（改文件的在前，只读校验在后，`fmt:check`/`lint` 最后）：

| 顺序 | `id`                          | 与 §5.2 判定的差异                                          |
| ---: | ----------------------------- | ----------------------------------------------------------- |
|    1 | `fix-byte-order-marker`       | 保持（原有）                                                |
|    2 | `trailing-whitespace`         | §5.2 判 **a**（oxfmt 已覆盖）→ **推翻**，按「卫生照加」挂上 |
|    3 | `end-of-file-fixer`           | §5.2 判 **a**（同上）→ **推翻**，同上                       |
|    4 | `mixed-line-ending`           | §5.2 判 b → 采纳，保留 `--fix=auto` 默认                    |
|    5 | `check-added-large-files`     | b → 采纳，默认 500 KiB                                      |
|    6 | `check-case-conflict`         | b → 采纳                                                    |
|    7 | `check-illegal-windows-names` | b → 采纳                                                    |
|    8 | `check-merge-conflict`        | b → 采纳                                                    |
|    9 | `check-xml`                   | b → 采纳（9 个 XML 实测全部可解析，零存量）                 |
|   10 | `detect-private-key`          | b → 采纳                                                    |
|   11 | `check-json`                  | b → 采纳，`exclude = 'tsconfig\.json$'`                     |
|   12 | `check-jsonc`                 | b → 采纳                                                    |

- **改写型钩子的排除项**：`(^|/)(\.nuxtrc|[^/]*\.lock|[^/]*\.g\.dart)$|^flutter/assets/document_viewer/`，加在第 1–4 个钩子上。口径是「生成物」而不是「扫描时刚好脏的文件」：8 个 `*.g.dart`（build_runner / json_serializable / 生成调色板）、5 个 lockfile（`bun.lock`、`extension/bun.lock`、`flutter/pubspec.lock`、`flutter/tool/document_viewer/bun.lock`、`generate_app_icons.py.lock`）、`.nuxtrc`、`flutter/assets/document_viewer/`。**`flutter/ios/**`（74 个）与 `flutter/android/**`（35 个）不在此列** —— 它们由 `flutter create` 一次性生成、此后一直手改，放行等于让平台层无人看管。
- **不做**：CI 增加 `prek` job（会让 `fmt:check`/`lint` 在 CI 里跑两遍）、`deny-pattern` 拦 focused test（需 `files` 限定，否则 `docs/` 与 `.agents/skills/` 里的示例文字会误报）、`forbid-new-submodules`（无可检测对象），以及 §5.2 判为 **c** 的全部 12 项。
- **存量规范化**：同一改动里修掉 4 个缺末尾换行的文件（`flutter/analysis_options.yaml`、`flutter/AGENTS.md`、`flutter/android/app/src/main/res/values/colors.xml`、`flutter/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md`）。`.nuxtrc` 已排除，不在内；`analysis_options.yaml` 是本文件早期静态扫描**漏报**的一处（当时只报 4 个，其中含现已排除的 `.nuxtrc`），由实跑的 `end-of-file-fixer` 抓出。

### 7.1 补充实测（对 §二 与 §5 中未覆盖或写错的行为）

| 事项                            | 方法                                                     | 结果                                                                                                                                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-jsonc` 的文件选择        | 临时 git 仓库 + 0.5.10 二进制，三种写法对比              | 默认只选 `.jsonc`；`types = ["json","jsonc"]` → `(no files to check)`（**`types` 是 AND 语义**，没有文件同时具备两个 tag）；`types = ["json"]` 能覆盖 `.json`（把一个带尾随逗号的 `.json` 放进去后钩子确实失败）。因此单个 `check-jsonc` **无法**兼顾两类。 |
| `check-json` 对 `tsconfig.json` | 同上                                                     | 失败：`key must be a string at line 2 column 3`；加 `exclude = 'tsconfig\.json$'` 后通过                                                                                                                                                                    |
| `mixed-line-ending` 默认 `auto` | 纯 CRLF 文件                                             | `exit=0`，文件**未**被改写 —— 印证「只动混合行尾」                                                                                                                                                                                                          |
| 钩子执行顺序                    | 前置一个 fixer + 后置一个观察型 local 钩子，跑 5 轮      | 观察者 5/5 看到已修复内容 → **按配置顺序串行**，不会与后面的 `fmt:check`/`lint` 并发                                                                                                                                                                        |
| Markdown 硬换行                 | 93 个 `.md` 中匹配行尾双空格                             | **0 处**；`--markdown-linebreak-ext=md` 是给未来兜底，不是修当下                                                                                                                                                                                            |
| 行尾空白普查                    | 1169 个文本文件逐行匹配 `[ \t]+$`                        | 仅 `flutter/assets/document_viewer/viewer.js` 一处（3 行），且是生成物 → 已排除                                                                                                                                                                             |
| XML 可解析性                    | 9 个 `.xml` 逐个 `XmlDocument.Load`                      | 全部通过 → `check-xml` 零存量                                                                                                                                                                                                                               |
| CRLF 数量                       | `git ls-files --eol`                                     | **48** 个 `w/crlf`（47 个 `flutter/` + 根 `LICENSE`），`w/mixed` 为 0；§一 与 §5.1 早期写的 17 已更正                                                                                                                                                       |
| `.nuxtrc` 的 eol 状态           | `git ls-files --eol`                                     | 全仓唯一 `i/none w/none` 文件（整文件无任何换行），与「缺末尾换行」同源                                                                                                                                                                                     |
| 生成物排除正则是否真的生效      | 临时仓库放入 6 个带行尾空白的文件，其中 5 个符合排除模式 | 只有 `flutter/lib/main.dart` 被修，`.nuxtrc`、`bun.lock`、`flutter/pubspec.lock`、`timeline_dto.g.dart`、`viewer.js` 全部原样保留                                                                                                                           |

## 出处

官方文档（0.5.10 版本化站点）：

- [Built-in Hooks（使用指南，0.5.10）](https://prek.j178.dev/0.5.10/built-in-hooks/)
- [Built-in Hooks（逐钩子参考，0.5.10）](https://prek.j178.dev/0.5.10/reference/built-in-hooks/)
- [Built-in Hooks（旧路径 `/builtin/`，404）](https://prek.j178.dev/builtin/)
- [Built-in Hooks（旧路径 `/reference/builtin-hooks/`，404）](https://prek.j178.dev/reference/builtin-hooks/)

tag `v0.5.10` 源码与文档源文件：

- [docs/reference/built-in-hooks.md](https://raw.githubusercontent.com/j178/prek/v0.5.10/docs/reference/built-in-hooks.md)
- [CHANGELOG.md](https://raw.githubusercontent.com/j178/prek/v0.5.10/CHANGELOG.md)
- [prek.toml（prek 自身配置）](https://raw.githubusercontent.com/j178/prek/v0.5.10/prek.toml)
- [crates/prek/src/hooks/builtin_hooks/mod.rs（id → 默认 types/files/stages/always_run）](https://raw.githubusercontent.com/j178/prek/v0.5.10/crates/prek/src/hooks/builtin_hooks/mod.rs)
- [crates/prek/src/hooks/pre_commit_hooks/mod.rs（FixArgs / fast-path 白名单）](https://raw.githubusercontent.com/j178/prek/v0.5.10/crates/prek/src/hooks/pre_commit_hooks/mod.rs)
- [crates/prek/src/hooks/pre_commit_hooks/mixed_line_ending.rs（auto/no 行为）](https://raw.githubusercontent.com/j178/prek/v0.5.10/crates/prek/src/hooks/pre_commit_hooks/mixed_line_ending.rs)
- [crates/prek-identify/src/tags.rs（TAG_SET_* 定义）](https://raw.githubusercontent.com/j178/prek/v0.5.10/crates/prek-identify/src/tags.rs)
- [仓库目录 crates/prek/src/hooks](https://github.com/j178/prek/tree/v0.5.10/crates/prek/src/hooks)
- [仓库目录 crates/prek/src](https://github.com/j178/prek/tree/v0.5.10/crates/prek/src)

本仓库（本地一手材料）：

- [prek.toml](../../prek.toml)
- [.gitattributes](../../.gitattributes)
- [.editorconfig](../../.editorconfig)
- [.oxfmtrc.json](../../.oxfmtrc.json)
- [.oxlintrc.json](../../.oxlintrc.json)
- [package.json](../../package.json)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [AGENTS.md](../../AGENTS.md)
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [.github/renovate.jsonc](../../.github/renovate.jsonc)

本机实测（非文档）：

- `node_modules/.bin/prek --version` → `prek 0.5.10 (516f5bdce 2026-11-04)`
- `PREK_HOME=<临时目录> node_modules/.bin/prek util list-builtins` → 33 条，与源码 enum 逐字一致
- `bunx oxfmt --check` / 临时文件重写实验 → 见 5.1 表"oxfmt 实际覆盖"
- `git ls-files --eol`、`git status --porcelain=v1`、`git grep` → 见 5.1 表各类计数
