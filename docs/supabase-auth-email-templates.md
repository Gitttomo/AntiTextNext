# Supabase Auth メールテンプレート

Supabase Auth の認証メール本文はアプリコードではなく Supabase 管理画面で設定します。

設定場所:

- Supabase Dashboard
- Authentication
- Email Templates
- Reset Password

パスワード再設定メールには、既存本文に加えて以下の注意書きを入れてください。

```text
このリンクは一度のみ使用できます。
うまく開けない場合は、もう一度パスワード再設定メールを送信してください。
スマートフォンでは、再設定を開始したブラウザと同じブラウザで開くと成功しやすい場合があります。
```

HTMLテンプレートで入れる場合:

```html
<p>このリンクは一度のみ使用できます。</p>
<p>うまく開けない場合は、もう一度パスワード再設定メールを送信してください。</p>
<p>スマートフォンでは、再設定を開始したブラウザと同じブラウザで開くと成功しやすい場合があります。</p>
```

リンク先は、TextNext 側から `redirectTo=/auth/callback?next=/auth/update-password` を指定しています。
