# TextNext Stripe導入前セキュリティチェックリスト

## 対応状況

| Stripeチェック項目 | TextNextでの対応 | 状態 | 関連ファイル |
|---|---|---|---|
| 管理者画面アクセス制限 | `/admin` 以下にBasic認証 + Supabase admin role確認を実施 | 実装済み | `middleware.ts`, `lib/admin-utils.ts` |
| 管理者ロール確認 | 管理画面レイアウト・middleware・管理APIで既存のadmin判定を利用 | 実装済み | `lib/admin.ts`, `lib/admin-utils.ts`, `app/api/admin/*` |
| 管理者ログイン保護 | ログイン成功後にadmin roleをサーバー側で確認し、管理者ログインを記録 | 実装済み | `app/api/auth/login/route.ts` |
| 管理者2FA | Supabase Auth MFAは追加調査が必要。現時点はBasic認証・role確認・試行制限で代替 | 今後対応 | Supabase Auth設定 |
| ログイン試行回数制限 | 同一メール/IPの短時間失敗を8回で15分制限 | 実装済み | `app/api/auth/login/route.ts`, `supabase/migrations/20260515000002_stripe_security_baseline.sql` |
| ログイン失敗エラー曖昧化 | メール存在有無や認証未完了を区別せず、汎用エラーを返却 | 実装済み | `app/api/auth/login/route.ts`, `app/auth/login/page.tsx` |
| 管理者操作ログ | 既存の`admin_action_logs`を利用し、IP/User-Agent保存用カラムを追加 | 実装済み | `lib/admin-utils.ts`, `supabase/migrations/20260515000002_stripe_security_baseline.sql` |
| Secret露出対策 | R2/Stripe/Supabase service roleはサーバー側のみ。`NEXT_PUBLIC_`には公開値のみ | 実装済み | `.env.example`, `lib/r2-server.ts`, `app/api/stripe/*` |
| データディレクトリ露出対策 | `.env.local`はGit管理外、Secretの公開env化を禁止 | 実装済み | `.gitignore`, `.env.example` |
| SQL Injection対策 | Supabase query builder/RPC中心。新規SQLは関数引数で受け取り文字列連結SQLなし | 実装済み | `supabase/migrations/20260515000002_stripe_security_baseline.sql` |
| XSS対策 | `dangerouslySetInnerHTML`はアプリ本体で未使用。Reactの通常描画でエスケープ | 確認済み | `app/*`, `components/*` |
| 入力値バリデーション | 画像アップロードはMIME/サイズ/拡張子を制限。本文系は追加強化余地あり | 一部実装 | `lib/image-storage.ts`, `app/listing/page.tsx` |
| 依存関係脆弱性確認 | `npm audit fix`で修正可能分を更新。Next/PostCSS系は破壊的更新が必要なため別途計画 | 一部対応 | `package.json`, `package-lock.json` |
| 決済APIレート制限 | Stripe予定APIにSupabaseベースのレート制限土台を追加 | 実装済み | `lib/server-rate-limit.ts`, `app/api/stripe/*` |
| Webhook署名検証 | `STRIPE_WEBHOOK_SECRET` + `stripe.webhooks.constructEvent()`で検証 | 実装済み | `app/api/stripe/webhook/route.ts` |
| アップロードファイル制限 | JPG/PNG/WebPのみ、SVG/PDF/HTML/JSは禁止、5MB上限 | 実装済み | `lib/image-storage.ts`, `app/api/item-images/upload/route.ts` |

## 必要な環境変数

サーバー側のみ:

- `ADMIN_BASIC_USER`
- `ADMIN_BASIC_PASSWORD`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- `R2_PUBLIC_BASE_URL`
- `GOOGLE_BOOKS_API_KEY`

公開してよい値:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`

## 本番前チェック

- Vercel Productionに`ADMIN_BASIC_USER`と`ADMIN_BASIC_PASSWORD`を設定する
- Vercel Productionに`STRIPE_SECRET_KEY`と`STRIPE_WEBHOOK_SECRET`を設定する
- `NEXT_PUBLIC_`付き環境変数にSecret Keyやservice role keyを入れていないことを確認する
- Supabaseで`20260515000002_stripe_security_baseline.sql`を実行する
- `/admin`に一般ユーザーでアクセスしてBasic認証とadmin role確認が効くことを確認する
- ログイン失敗を連続実行し、429で制限されることを確認する
- 画像アップロードでSVG/PDF/HTML/JSが拒否されることを確認する
- Stripe webhookテストで署名なしリクエストが400になることを確認する
- Checkout / PaymentIntent本実装時は、金額・手数料・取引IDをフロント入力だけで信用しない

## 今後対応

- Supabase Auth MFAの導入可否確認と管理者2FAの追加
- アカウント情報変更時・管理者ログイン時のメール通知
- チャット本文、問い合わせ本文、プロフィール文などの長さ制限と禁止文字の追加確認
- Next.jsを最新安定版へ上げる検証。`npm audit`上はNext/PostCSS由来のhigh/moderateが残る
- Upstash Redisなど外部ストアによるレート制限への移行検討
- Stripe Connect本実装時の本人確認状態、返金、Webhook再送の冪等性対応
