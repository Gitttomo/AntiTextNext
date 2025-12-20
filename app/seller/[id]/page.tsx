"use client";

import Link from "next/link";
import { ArrowLeft, User, GraduationCap, Heart, Star, Image as ImageIcon } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type SellerProfile = {
    user_id: string;
    nickname: string;
    department: string;
    major?: string;
    avatar_url?: string | null;
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
    const [averageRating, setAverageRating] = useState(0);
    const [ratingCount, setRatingCount] = useState(0);
    const loadedRef = useRef(false);

    useEffect(() => {
        // 重複リクエスト防止
        if (loadedRef.current) return;
        loadedRef.current = true;
        loadSellerData();
    }, [params.id]);

    const loadSellerData = async () => {
        try {
            // プロフィール、アイテム、評価を並列取得で高速化
            const profilePromise = supabase
                .from("profiles")
                .select("user_id, nickname, department, major, avatar_url")
                .eq("user_id", params.id)
                .single();

            const itemsPromise = supabase
                .from("items")
                .select("id, title, selling_price, condition, front_image_url")
                .eq("seller_id", params.id)
                .eq("status", "available")
                .order("created_at", { ascending: false });

            const ratingsPromise = supabase
                .from("ratings")
                .select("score")
                .eq("rated_id", params.id);

            const [profileResult, itemsResult, ratingsResult] = await Promise.all([
                profilePromise, 
                itemsPromise,
                ratingsPromise
            ]) as [any, any, any];

            if (profileResult.error) {
                console.error("Error loading profile:", profileResult.error);
                setLoading(false);
                return;
            }

            setProfile(profileResult.data as SellerProfile);

            if (itemsResult.error) {
                console.error("Error loading items:", itemsResult.error);
            } else {
                setItems((itemsResult.data as Item[]) || []);
            }

            if (ratingsResult.data) {
                const scores = (ratingsResult.data as any[]).map(r => r.score);
                const count = scores.length;
                const avg = count > 0 ? scores.reduce((a, b) => a + b, 0) / count : 0;
                setAverageRating(avg);
                setRatingCount(count);
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
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-gray-400 font-bold">読み込み中...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center p-8">
                    <p className="text-gray-600 mb-6 text-xl font-bold">出品者が見つかりませんでした</p>
                    <Link href="/" className="inline-block px-8 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">
                        ホームに戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-blue-50 pb-32">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md px-6 pt-8 pb-8 border-b border-gray-100 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => window.history.back()} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors active:scale-90">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tighter">出品者情報</h1>
                </div>

                {/* Seller Profile Info Card */}
                <div className="flex items-center gap-5 transition-transform">
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 overflow-hidden shadow-inner flex-shrink-0">
                        {profile.avatar_url ? (
                            <Image 
                                src={profile.avatar_url} 
                                alt="Avatar" 
                                width={80} 
                                height={80} 
                                className="w-full h-full object-cover"
                                unoptimized
                            />
                        ) : (
                            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                <User className="w-10 h-10 text-primary/40" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-black text-gray-900 truncate mb-1">
                            {profile.nickname}
                        </h2>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <div className="flex text-yellow-500">
                                    {[...Array(5)].map((_, i) => (
                                        <Star 
                                            key={i} 
                                            className={`w-4 h-4 ${i < Math.round(averageRating) ? "fill-current" : "text-gray-200"}`} 
                                        />
                                    ))}
                                </div>
                                <span className="text-sm font-black text-gray-500">
                                    {averageRating.toFixed(1)} ({ratingCount})
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
                                <div className="flex items-center gap-1.5">
                                    <GraduationCap className="w-4 h-4 text-primary/60" />
                                    <span className="text-sm font-bold">{profile.department}</span>
                                </div>
                                {profile.major && (
                                    <div className="flex items-center">
                                        <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            {profile.major}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Items Section */}
            <div className="px-6 py-10">
                <div className="flex items-center justify-between mb-6 px-1">
                    <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-primary" strokeWidth={2.5} />
                        出品中の商品
                    </h3>
                    <span className="text-sm font-black text-primary bg-primary/5 px-3 py-1 rounded-full">
                        {items.length}件
                    </span>
                </div>

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
