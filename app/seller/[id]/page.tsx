/**
 * 出品者詳細ページ
 * 
 * 特定の出品者のプロフィールと出品商品一覧を表示するページです。
 * 
 * 機能:
 * - 出品者情報（ニックネーム、学部）の表示
 * - 出品中の商品一覧
 * - お気に入り機能
 * - 商品詳細ページへのリンク
 */

"use client";

import Link from "next/link";
import { ArrowLeft, User, GraduationCap, Heart } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type SellerProfile = {
    user_id: string;
    nickname: string;
    department: string;
};

type Item = {
    id: string;
    title: string;
    selling_price: number;
    condition: string;
    front_image_url: string | null;
};

const conditionColors: Record<string, string> = {
    "美品": "bg-green-100 text-green-700",
    "良好": "bg-blue-100 text-blue-700",
    "可": "bg-yellow-100 text-yellow-700",
};

export default function SellerDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const [profile, setProfile] = useState<SellerProfile | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [favorites, setFavorites] = useState<string[]>([]);

    useEffect(() => {
        loadSellerData();
    }, [params.id]);

    const loadSellerData = async () => {
        try {
            // Load seller profile
            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select("user_id, nickname, department")
                .eq("user_id", params.id)
                .single();

            if (profileError) {
                console.error("Error loading profile:", profileError);
                setLoading(false);
                return;
            }

            setProfile(profileData as SellerProfile);

            // Load available items from this seller
            const { data: itemsData, error: itemsError } = await supabase
                .from("items")
                .select("id, title, selling_price, condition, front_image_url")
                .eq("seller_id", params.id)
                .eq("status", "available")
                .order("created_at", { ascending: false });

            if (itemsError) {
                console.error("Error loading items:", itemsError);
            } else {
                setItems((itemsData as Item[]) || []);
            }
        } catch (err) {
            console.error("Error loading seller data:", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleFavorite = useCallback((id: string) => {
        setFavorites((prev) =>
            prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id]
        );
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <p className="text-gray-600">読み込み中...</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">出品者が見つかりませんでした</p>
                    <Link href="/" className="text-primary hover:underline">
                        ホームに戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="bg-white px-6 pt-8 pb-6 border-b">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => window.history.back()}>
                        <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
                    </button>
                    <h1 className="text-3xl font-bold text-primary">出品者情報</h1>
                </div>

                {/* Seller Profile Info */}
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {profile.nickname}
                        </h2>
                        <div className="flex items-center gap-2 text-gray-600">
                            <GraduationCap className="w-4 h-4" />
                            <span className="text-sm">{profile.department}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Items Section */}
            <div className="px-6 py-8">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    出品中の商品（{items.length}件）
                </h3>

                {items.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500">現在出品中の商品はありません</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {items.map((item) => (
                            <Link key={item.id} href={`/product/${item.id}`}>
                                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-md hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${conditionColors[item.condition] || 'bg-gray-100 text-gray-700'}`}>
                                                    {item.condition}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                                {item.title}
                                            </h3>
                                            <p className="text-2xl font-bold text-primary">
                                                ¥{item.selling_price.toLocaleString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleFavorite(item.id);
                                            }}
                                            className="p-2 hover:bg-gray-100 rounded-full transition-all active:scale-90"
                                            aria-label={favorites.includes(item.id) ? "お気に入りから削除" : "お気に入りに追加"}
                                        >
                                            <Heart
                                                className={`w-6 h-6 transition-all duration-200 ${favorites.includes(item.id)
                                                    ? "fill-red-500 text-red-500 scale-110"
                                                    : "text-gray-300 hover:text-red-300"
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
