"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, Mail } from "lucide-react";

export default function AuthLinkErrorPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white px-6 pt-8 pb-6 border-b">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/auth/login">
            <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
          </Link>
          <h1 className="text-3xl font-bold text-primary">リンクを確認できません</h1>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl border border-red-100 bg-white p-8 shadow-lg">
            <div className="mb-5 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
            </div>

            <h2 className="mb-4 text-center text-xl font-bold text-gray-900">
              再設定リンクを利用できません
            </h2>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700">
              <p>再設定リンクの有効期限が切れているか、すでに使用されています。</p>
              <p className="mt-2">
                お手数ですが、もう一度パスワード再設定メールを送信してください。
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-6 text-blue-800">
              <p>スマートフォンでは、再設定を開始したブラウザと同じブラウザで開くと成功しやすい場合があります。</p>
            </div>

            <div className="mt-6 space-y-3">
              <Link
                href="/auth/forgot-password"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white transition-colors hover:bg-primary/90"
              >
                <Mail className="h-5 w-5" />
                再設定メールを送信する
              </Link>
              <Link
                href="/auth/login"
                className="block w-full rounded-xl bg-gray-100 px-5 py-3 text-center font-semibold text-gray-700 transition-colors hover:bg-gray-200"
              >
                ログイン画面へ戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
