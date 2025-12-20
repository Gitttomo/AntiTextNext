"use client";

import Link from "next/link";
import { ArrowLeft, Bell, Inbox } from "lucide-react";

// お知らせページ
// 後から機能を追加するためのプレースホルダーページ
export default function NotificationsPage() {
    return (
        <div className="min-h-screen bg-white pb-24">
            {/* Header */}
            <header className="bg-white px-6 pt-8 pb-6 border-b sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Bell className="w-6 h-6 text-primary" />
                        <h1 className="text-2xl font-bold text-gray-900">
                            お知らせ
                        </h1>
                    </div>
                </div>
            </header>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <Inbox className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">
                    お知らせはありません
                </h2>
                <p className="text-gray-500 text-center max-w-xs">
                    新しいお知らせがあるとここに表示されます
                </p>
            </div>
        </div>
    );
}
