# 写真展アンケート設定

幹部向けの年間運用、作品掲載同意、回答管理、トラブル対応は、[`docs/2026運用マニュアル.md`](docs/2026運用マニュアル.md)を参照してください。

## 初回セットアップ

1. Supabaseでプロジェクトを作成する。
2. SQL Editorで `supabase/schema.sql` を実行する。
3. Authentication > ProvidersでAnonymous Sign-Insを有効にする。
4. Project URLとPublishable keyを `_data/survey.yml` に設定する。
5. `survey_exhibitions` の対象行に、会期、作品番号、受付状態を設定する。

アンケート用JavaScriptまたはCSSを更新した場合は、ブラウザキャッシュを更新するため、`_data/survey.yml`の`asset_version`も変更します。

`service_role` keyは管理者専用です。リポジトリ、HTML、JavaScriptには絶対に保存しないでください。

## 2026年度 夏写真展「夏彩」

公開期間は、Asia/Tokyoで2026年8月23日05:00から8月27日23:59までです。

作品番号が未確定の初期登録には、`supabase/migrations/20260720_add_2026_summer_exhibition.sql`を使用します。このSQLは`work_ids`を空配列、`is_accepting_responses`を`false`にするため、実行しただけでは回答受付は始まりません。

作品確定後に次の順番で設定します。

1. `_data/works/2026-summer.yml`へ作品を登録する。
2. Supabaseの`work_ids`を実際の作品番号へ更新する。
3. 作品一覧ページとアンケートページを作成する。
4. `2026/summer/index.html`の`survey_url`と`works_url`を設定する。
5. 表示とテスト回答を確認してから`is_accepting_responses`を`true`にする。

## QR入口の状態切替

QRコードは展示ごとの固定入口（例: `/2026/summer/`）を指します。入口とアンケート直リンクは、Supabaseのサーバー時刻で次のように切り替わります。

- `opens_at`より前: 公開前画面
- `opens_at`以上、`closes_at`以下: 会期中画面
- `closes_at`より後: 終了画面
- Supabaseへ接続できない場合: 利用不可画面

初回導入時は、SQL Editorで`supabase/migrations/20260720_add_public_exhibition_state.sql`を実行します。

入口ページは次のfront matterを使用します。

```yaml
---
layout: exhibition-entry
title: "2026年度 夏写真展"
exhibition_key: "2026-summer"
survey_url: "/2026/summer/survey/"
works_url: "/2026/summer/works/"
---
```

アンケートページには入口URLを指定します。

```yaml
entry_url: "/2026/summer/"
```

QRから部員限定ページや作品画像の直接URLへリンクしないでください。

## 写真展を追加する

1. `_data/works/<展示キー>.yml` に作品データを用意する。
2. アンケートページを作成し、front matterに次を指定する。

```yaml
---
layout: survey
title: "アンケートのタイトル"
exhibition_key: "2026-summer"
works_data: "2026-summer"
readonly_url: "/2026/summer/作品一覧のURL/"
entry_url: "/2026/summer/"
---
```

3. Supabaseの`survey_exhibitions`へ同じ`exhibition_key`の行を登録する。
4. QRコードは展示の固定入口（例: `/2026/summer/`）を指すように作成する。

## 会期中の運用

- 開始前にテスト用展示キーで、選択、確認、編集、送信、二重送信防止を確認する。
- 本番開始時に`is_accepting_responses`を`true`にする。
- 緊急停止時は`false`にする。JavaScriptの変更やGitHub Pagesの再デプロイは不要。
- 回答データはSupabase管理画面からCSVとして取得する。

## 会期終了後

1. `is_accepting_responses`を`false`にする。
2. アンケートへのリンクを外す。
3. 著作権上、部員限定にする画像はGitHub Pagesの公開対象から削除する。

GitHub Pagesに配置された画像は、長いURLやJavaScriptのパスワード画面では厳密に保護できません。部員限定アーカイブには、認証付きストレージを別途利用してください。

## 二重回答防止の範囲

同じ匿名Supabaseセッションでは、DBの一意制約によって1回答に制限されます。ブラウザのサイトデータをすべて削除した場合や別端末では新しい匿名利用者になるため、再回答できます。厳密な一人一回答が必要な場合は、来場者ごとの使い捨てコードを追加してください。
