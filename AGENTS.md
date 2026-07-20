- 常に**日本語**で回答する（結論ファースト、簡潔に）
- 挨拶・前置き・段階報告・絵文字は**禁止**
- 指摘すべきことは**率直に**回答
- ユーザーの意見に忖度せず、論拠に基づいて回答

--- project-doc ---

# Cron Dialect Lens

GitHubのYAML blob画面とPR Files changed画面へcron説明UIを追加するChrome拡張
（Manifest V3）。GitHub Actions、Kubernetes CronJob、文脈不足の
`unknown-posix`を端末内だけで解析する。popup、options、background、storage、
messaging、外部APIは使用しない。

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | lockfileどおり依存を導入（Node 24以上） |
| `npm run dev` | Vite/CRXJS開発build |
| `npm run test` | Vitest unit/DOM/component test |
| `npm run check-type` | `tsc --noEmit` |
| `npm run lint` | Oxlint（書き換えなし） |
| `npm run format` | Prettier（書き換えあり） |
| `npm run build` | `extension/`へproduction build |
| `npm run verify` | types → lint → test → build → manifest検証 |
| `npm run verify:full` | `verify` → 実Chromium E2E |
| `npm run package` | 検証済み`extension.zip`を再現可能に作成 |
| `npm run render:icons` | SVG原画からPNGアイコンを再生成 |

## Verification contract

- `src/lib/cron/**`、unit test、文書だけの変更: `npm run verify`
- content entrypoint、GitHub DOM adapter、manifest、E2E配線: `npm run verify:full`
- リリース前: `npm run verify:full`と`npm run package`

検証結果を推測で報告しない。実行したcheckの出力を正とする。

## Architecture

```text
src/
├── entrypoints/content/
│   ├── cronLens.tsx            # 注入、observer、lifecycle、Shadow DOM host
│   ├── CronLensPanel.tsx       # 表示専用React component
│   └── github/
│       └── githubCronAdapter.ts # GitHub DOM selector隔離層
└── lib/cron/                    # DOM非依存の抽出・判定・解析・rule
```

- 依存方向は`entrypoints → lib`だけ。`lib`からentrypointをimportしない。
- GitHub selectorをcomponentや`src/lib/cron`へ散らさない。
- React stateへDOM nodeを保存しない。candidateは安定IDで識別する。
- `cron-parser`を妥当性・次回時刻の正とし、`cronstrue`は説明生成だけに使う。
- 日本語説明用locale以外を追加でbundleしない。
- 現在時刻、language、browser timezoneはテストから注入可能に保つ。
- GitHub DOM復元に失敗した場合はproductionで例外を投げず静かに停止する。

## Product invariants

- 対象URLはGitHub blobとPR Files changedだけ。`.yml` / `.yaml`以外を走査しない。
- dialectを確定できないdiffは`unknown-posix`へ落とし、推測を断定しない。
- Kubernetesで`.spec.timeZone`がなければ次回時刻を断定しない。
- MutationObserverは`document.body`に1つ、再走査は100ms debounce、注入は冪等。
- Panelはopen Shadow Rootへmountし、button CSSは厳密に名前空間化する。
- `permissions` / `host_permissions`は空。content matchは`https://github.com/*`だけ。
- GitHub API、backend、analytics、remote code、CDN、storageを追加しない。
- ページ内容を外部送信しない。

## Manifest changes

manifestは`manifest.config.ts`だけを編集し、生成物を直接変更しない。権限、match、
CSP、surfaceを変える場合は`verify-manifest.mjs`の期待値も同時に変更する。action、
options、background、`externally_connectable`、`<all_urls>`、外部hostを追加しない。

## Testing

- 実装前に失敗するtestを追加し、失敗理由を確認してから実装する。
- 純粋ruleは`it.each`で境界値・異常値を検証する。
- GitHub DOMは保存fixtureを使い、CIから実GitHubを取得しない。
- DOM差し替え、重複防止、不完全diffのconfidence低下を必ず覆う。
- E2Eはbuild済み拡張を実Chromiumへloadし、localhost fixtureで確認する。

## TypeScript / React conventions

- `any`は禁止。`unknown`からnarrowingする。
- named exportのみ。例外はVite等が要求する`*.config.ts`のdefault export。
- componentはarrow function。
- pure utilityは戻り値型を明示する。
- formattingはPrettier、correctnessはtsc/Oxlintへ任せる。

## On-demand context

| When | Read |
| --- | --- |
| `.ts` / `.tsx`編集 | `.claude/rules/typescript-react.md` |
| manifest/content script編集 | `.claude/rules/chrome-extension.md` |
| test編集 | `.claude/rules/testing.md` |
| package/release | `.claude/skills/release/SKILL.md` |

## Git and safety

- 他人の変更を上書きしない。関係ないdirty fileを変更・stageしない。
- `git add -A` / `git add .`は禁止。個別にstageする。
- Conventional Commitを使い、bodyにはWHYを書く。
- commit、push、PR、tag、公開は明示依頼なしに行わない。
- `rm -rf`、force-push、history rewrite等の破壊操作は明示承認が必要。
- secretを読まない、出力しない、commitしない。

## Responses

完了報告は、結論、実装要件、権限、`verify:full`結果、手動確認、既知制限、
未完了項目を日本語で簡潔に示す。
