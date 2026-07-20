# Cron Dialect Lens

[English](../README.md) | **日本語**

Cron Dialect Lensは、GitHub上のYAMLに書かれたcron scheduleをその場で説明する
Manifest V3 Chrome拡張です。GitHub ActionsとKubernetes CronJobの意味の違い、
タイムゾーン、次回5回、環境固有の注意点を表示します。リポジトリ内容を外部へ
送信しません。

本プロジェクトは
[`50ra4/crx-vite-ts-react-template` v1.0.0](https://github.com/50ra4/crx-vite-ts-react-template/releases/tag/v1.0.0)
から派生しています。仕様が食い違う場合は英語版READMEを正とします。

![Pull Request上のCron Dialect Lens](./images/cron-lens.png)

## 主な機能

- GitHubのYAML blob画面とPull RequestのFiles changed画面を検出
- `github-actions`、`kubernetes`、`unknown-posix`を周辺文脈から判定
- 自然言語説明、schedule側とブラウザ側のタイムゾーン、次回5回を表示
- GitHub Actionsの5分未満間隔、非対応macro、毎時0分付近を警告
- GitHub Actionsの`timezone:`とKubernetesの`.spec.timeZone`へ対応
- KubernetesでtimeZone未指定時は次回時刻を断定しない
- Kubernetes schedule内の`TZ=` / `CRON_TZ=`をエラー表示
- hover、focus、click、Escape、外部clickへ対応
- GitHub SPA遷移と遅延描画へ、単一MutationObserverで冪等に追従

## 対象と制限

対象は`github.com`の`.yml` / `.yaml` blob画面とPR Files changed画面です。
AWS EventBridge、Quartz、Azure、GCP、GitHub Enterprise、raw/edit/commit画面、
YAML編集、GitHub API、Kubernetes cluster接続は対象外です。

GitHub DOMは公開APIではありません。コード行を安全に復元できない場合、拡張は
ページを書き換えず静かに停止します。PR diffに`kind`等が表示されない場合は、
推測を断定せず`unknown-posix`と表示します。

## プライバシーと権限

- content script match: `https://github.com/*`
- Chrome API権限: なし
- host permission: なし
- background / popup / options: なし
- 保存データ: なし
- 外部通信、解析SDK、クラッシュ収集: なし

解析はcontent script内で完結します。データを保存しないため、アンインストール後に
残る拡張データはありません。詳細は[プライバシーポリシー](./privacy.md)を参照して
ください。

## 開発と検証

Node.js 24以上とE2E用Chromiumが必要です。

```sh
npm ci
npm run verify:full
npm run package
```

`npm run verify:full`は型、lint、Vitest、production build、manifest権限検証、
実Chromium E2Eを実行します。手動検収は[manual-test.md](./manual-test.md)に記載して
います。

## ライセンス

[MIT](../LICENSE)。同梱runtime依存のライセンスは
[third-party-notices.md](./third-party-notices.md)を参照してください。
