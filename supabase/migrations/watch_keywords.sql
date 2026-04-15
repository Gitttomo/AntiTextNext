-- watch_keywords テーブルの作成
-- SupabaseのSQL EditorでこのSQLを実行してください

CREATE TABLE IF NOT EXISTS watch_keywords (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, keyword)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_watch_keywords_user_id ON watch_keywords(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_keywords_keyword ON watch_keywords(keyword);

-- Row Level Security
ALTER TABLE watch_keywords ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のキーワードのみ管理可能
CREATE POLICY "Users can view own watch keywords"
    ON watch_keywords FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watch keywords"
    ON watch_keywords FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watch keywords"
    ON watch_keywords FOR DELETE
    USING (auth.uid() = user_id);

-- check-watch-keywords APIで他ユーザーのキーワードを参照するためのサービスロールポリシー
-- （API側でservice_role keyを使わない場合、全ユーザーのキーワードをSELECTできるようにする）
CREATE POLICY "Service can read all watch keywords"
    ON watch_keywords FOR SELECT
    USING (true);
