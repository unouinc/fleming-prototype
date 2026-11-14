# Fleming プロトタイプ（PC版・求職者側）

看護師・介護士向け転職サービス「Fleming（仮）」のプロダクトUIプロトタイプです。
依存なしの静的HTMLで、`site/` をそのまま開くか GitHub Pages で公開できます。

## 画面

| ファイル | 画面 |
|---|---|
| `site/index.html` | 募集をさがす（フィード） |
| `site/job.html` | 募集詳細（ストーリー／数字で見る／メンバー／募集要項） |
| `site/members-a.html` | メンバータブ パターンA：組織図 |
| `site/members-b.html` | メンバータブ パターンB：グラフ＋看護師長の紹介 |
| `site/scouts.html` | スカウト・メッセージ |
| `site/profile.html` | マイプロフィール |

画面同士はリンクでつながっています。「話を聞きに行きたい」「気になる」「いまの気持ち」などは押すと状態が変わります。

## 構成

- `site/*.html` … 各画面。`<template id="tpl">` にマークアップ、末尾の `<script>` に表示データ（`renderVals()`）。
- `site/runtime.js` … `{{a.b}}`、`<sc-for>`、`<sc-if>`、`onClick` などを描画する小さなテンプレートエンジン（約100行）。
- `site/images/` … 写真（station.jpg / rehab.jpg / care.jpg / mentor.jpg）。AI生成のサンプルです。
- `.github/workflows/pages.yml` … `main` に push すると `site/` を GitHub Pages に公開します。

## ローカルで見る

ビルド不要です。`site/index.html` をブラウザで開くだけで動きます。
（フォントは Google Fonts から読むので、オフラインでは代替フォントになります）

## GitHub Pages で公開する

1. リポジトリの Settings → Pages → Source を **GitHub Actions** にする
2. `main` に push すると自動で公開されます
3. URL: `https://unouinc.github.io/fleming-prototype/`

## データを変える

各HTMLの末尾、`class Component extends DCLogic` の `renderVals()` にある配列を編集してください。
病院名・金額・人数などはすべてサンプルです。

## デザイン

- 日本語: Noto Sans JP、英数字: Outfit
- 色: 地 `#F6F5F1`、黒 `#1A1A1A`、青 `#3A63F4`、黄 `#FFD338`、ピンク `#FF8FB1`
- 角丸 20〜24px、ボタンは pill 型

元のデザインは Claude のデザインキャンバス「Fleming プロダクトUI（PC）」で管理しています。

## 本番モード（登録と「話を聞きたい」を保存する）

`site/config.js` が空のあいだは試作モードで、入力は保存されません。
Supabase の接続情報を入れると、次の3つが実際に動きます。

- メールのリンクでの登録・ログイン（`site/signup.html`）
- プロフィール登録（名前・資格・経験年数・最寄駅・いまの職場）
- 「話を聞きに行きたい」の保存と、運営の Slack への通知

病院とのやりとりと日程調整は、運営がメールで仲介する前提です（アプリ内メッセージは未実装）。

### セットアップ手順

1. Supabase でプロジェクトを作る（リージョンは Tokyo）。
2. SQL Editor に `supabase/schema.sql` を貼り付けて実行する。
3. Slack で Incoming Webhook を作り、通知先チャンネルの URL を取得する。`schema.sql` 末尾の「5.」の1行を、URL を差し替えて実行する。
4. Authentication → URL Configuration で、Site URL と Redirect URLs に公開サイトの URL（`https://.../signup.html`）を登録する。
5. Authentication → Emails で、ログインメールの文面を日本語にする。Supabase 標準のメール送信は1時間あたりの通数がごく少ないので、公開前に独自の SMTP（Resend など）を設定する。
6. Project Settings → API の Project URL と anon public キーを `site/config.js` に入れて push する。

### 運営の見方

- 登録者は `profiles`、送信内容は `talk_requests` テーブル（Supabase の Table Editor）で見られます。
- `talk_requests.status` と `memo` は運営が手で更新します（未対応／病院に連絡済み／日程確定／見送り）。

### 公開前に残っていること

- `site/terms.html`、`site/privacy.html` は「準備中」の仮ページです。
- 病院・人物・数字はすべてサンプルです。スカウト、メッセージ、プロフィールの各画面は本番モードでも試作表示のままです。
- `tools/live-flow-test.js` は、Supabase を模擬して登録から送信までを通す確認用スクリプトです（Playwright が必要）。
