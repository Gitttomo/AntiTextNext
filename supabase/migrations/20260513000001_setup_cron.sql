-- このSQLはSupabaseのSQLエディタで実行してください。
-- pg_cron と pg_net 拡張機能が有効になっている必要があります。

-- 1. 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 既存のジョブがあれば削除
SELECT cron.unschedule('daily-reminders');

-- 3. ジョブのスケジュール登録
-- 毎日午前8時（日本時間で午後5時など、UTC基準で設定）に実行
-- 例として毎日0時 (UTC) = 日本時間 9時に実行するように設定
SELECT cron.schedule(
  'daily-reminders',
  '0 0 * * *',
  $$
    SELECT net.http_post(
        url := 'https://' || current_setting('request.headers')::json->>'host' || '/api/cron/reminders',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET_HERE"}'::jsonb
    );
  $$
);

-- 注意:
-- url には、実際の本番環境のURL（例： 'https://textnext.vercel.app/api/cron/reminders'）を直接指定する方が安全・確実です。
-- YOUR_CRON_SECRET_HERE を、Vercelの環境変数に設定する CRON_SECRET と同じ値に置き換えてください。
