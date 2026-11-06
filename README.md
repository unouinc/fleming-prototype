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
