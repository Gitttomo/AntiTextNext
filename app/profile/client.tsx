"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
    User,
    Settings,
    Star,
    History,
    BookOpen,
    Heart,
    ChevronRight,
    ArrowRight,
    MoreHorizontal,
    Shield
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/lib/i18n";
import { ProfileSkeleton } from "./edit/skeleton";
import { getItemImageUrl } from "@/lib/image-storage";
import { supabase } from "@/lib/supabase";

type Profile = {
    nickname: string;
    department: string;
    avatar_url: string | null;
};

type Item = {
    id: string;
    title: string;
    selling_price: number;
    front_image_url: string | null;
    front_thumbnail_url?: string | null;
    status: string;
};

type MypageClientProps = {
    initialProfile: Profile | null;
    serverSession: boolean;
    initialListingItems: Item[];
    initialPastItems: Item[];
    initialFavoriteItems: Item[];
    averageRating: number;
    ratingCount: number;
    isAdmin: boolean;
};

export default function MypageClient({
    initialProfile,
    initialListingItems,
    initialPastItems,
    initialFavoriteItems,
    averageRating,
    ratingCount,
    isAdmin
}: MypageClientProps) {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState<"past" | "listing" | null>(null);
    const [favoriteItems, setFavoriteItems] = useState<Item[]>(initialFavoriteItems);

    useEffect(() => {
        setFavoriteItems(initialFavoriteItems);
    }, [initialFavoriteItems]);

    const refreshFavoriteItems = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from("favorites")
            .select("item_id, items(*)")
            .eq("user_id", user.id);

        if (!error && data) {
            setFavoriteItems((data as any[]).map(f => f.items).filter(Boolean));
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/auth/login");
            router.refresh();
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (!user) return;

        refreshFavoriteItems();
        const delayedRefresh = setTimeout(refreshFavoriteItems, 450);

        const refreshWhenVisible = () => {
            if (document.visibilityState === "visible") {
                refreshFavoriteItems();
                setTimeout(refreshFavoriteItems, 450);
            }
        };

        const refreshTwice = () => {
            refreshFavoriteItems();
            setTimeout(refreshFavoriteItems, 450);
        };

        window.addEventListener("focus", refreshTwice);
        window.addEventListener("pageshow", refreshTwice);
        document.addEventListener("visibilitychange", refreshWhenVisible);

        return () => {
            clearTimeout(delayedRefresh);
            window.removeEventListener("focus", refreshTwice);
            window.removeEventListener("pageshow", refreshTwice);
            document.removeEventListener("visibilitychange", refreshWhenVisible);
        };
    }, [user]);

    if (authLoading) {
        return <ProfileSkeleton />;
    }

    if (!user) {
        return null;
    }

    const ratingStars = Math.round(averageRating);

    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-blue-50 pb-32 font-gentle">
            {/* Header */}
            <header className="bg-white px-6 pt-10 pb-8 rounded-b-[40px] shadow-sm">
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                    {t('profile.mypage')}
                </h1>
            </header>

            <div className="px-6 pt-8 space-y-8">
                {/* Profile Section */}
                <div className="relative bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-md border border-white/50 flex items-center gap-5 transition-transform hover:scale-[1.01]">
                    {isAdmin && (
                        <button
                            onClick={() => router.push("/admin")}
                            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-900 text-white shadow-sm transition hover:bg-slate-800"
                            aria-label="管理ダッシュボード"
                        >
                            <Shield className="h-5 w-5" />
                        </button>
                    )}
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 overflow-hidden shadow-inner">
                        {initialProfile?.avatar_url ? (
                            <Image
                                src={initialProfile.avatar_url}
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
                    <div className="flex-1 pr-12">
                        <h2 className="text-xl font-bold text-gray-900 truncate">
                            {initialProfile?.nickname || "読み込み中..."}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex text-yellow-500">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className={`w-4 h-4 ${i < ratingStars ? "fill-current" : "text-gray-300"}`}
                                    />
                                ))}
                            </div>
                            <span className="text-sm font-bold text-gray-500">
                                ({averageRating.toFixed(1)})
                            </span>
                        </div>
                    </div>
                </div>

                {/* Profile Edit Button */}
                <button
                    onClick={() => router.push("/profile/edit")}
                    className="w-full bg-white rounded-2xl p-4 shadow-md border border-gray-100 flex items-center justify-between group active:scale-[0.98] transition-all hover:border-primary/30"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center transition-colors group-hover:bg-primary/10">
                            <Settings className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-bold text-gray-700">{t('profile.edit_profile')}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </button>

                {/* その他設定ボタン */}
                <button
                    onClick={() => router.push("/settings")}
                    className="w-full bg-white rounded-2xl p-4 shadow-md border border-gray-100 flex items-center justify-between group active:scale-[0.98] transition-all hover:border-primary/30"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center transition-colors group-hover:bg-gray-200">
                            <MoreHorizontal className="w-5 h-5 text-gray-500" />
                        </div>
                        <span className="font-bold text-gray-700">{t('profile.settings')}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </button>

                {/* History Section */}
                <section className="space-y-4">
                    <h3 className="text-lg font-extrabold text-gray-800 flex items-center gap-2 px-1">
                        <History className="w-5 h-5 text-primary" />
                        {t('profile.history')}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setActiveTab(activeTab === "past" ? null : "past")}
                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${activeTab === "past"
                                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/30 scale-105"
                                    : "bg-white text-gray-700 border-gray-100 shadow-sm hover:border-primary/20"
                                }`}
                        >
                            <History className={`w-6 h-6 ${activeTab === "past" ? "text-white" : "text-primary"}`} />
                            <span className="text-sm font-bold">{t('profile.past_transactions')}</span>
                            <span className={`text-lg font-extrabold ${activeTab === "past" ? "text-white/90" : "text-primary"}`}>{initialPastItems.length}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab(activeTab === "listing" ? null : "listing")}
                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${activeTab === "listing"
                                    ? "bg-red-500 text-white border-red-500 shadow-lg shadow-red-200 scale-105"
                                    : "bg-white text-gray-700 border-gray-100 shadow-sm hover:border-red-500/20"
                                }`}
                        >
                            <BookOpen className={`w-6 h-6 ${activeTab === "listing" ? "text-white" : "text-red-500"}`} />
                            <span className="text-sm font-bold">{t('profile.listing_items')}</span>
                            <span className={`text-lg font-extrabold ${activeTab === "listing" ? "text-white/90" : "text-red-500"}`}>{initialListingItems.length}</span>
                        </button>
                    </div>

                    {/* Filtered List */}
                    {activeTab && (
                        <div className="bg-gray-50/50 rounded-3xl p-4 border border-dashed border-gray-200 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between mb-4 px-2">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    {activeTab === "past" ? "過去の取引一覧" : "出品中のアイテム（未取引）"}
                                </span>
                                <span className="text-sm font-bold text-primary">
                                    {(activeTab === "past" ? initialPastItems : initialListingItems).length}件
                                </span>
                            </div>
                            <div className="space-y-3">
                                {(activeTab === "past" ? initialPastItems : initialListingItems).map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => router.push(`/product/${item.id}`)}
                                        className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-3 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                            {getItemImageUrl(item, "front", "thumbnail") && (
                                                <Image src={getItemImageUrl(item, "front", "thumbnail")!} alt={item.title} width={48} height={48} className="w-full h-full object-cover" quality={55} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-primary transition-colors">{item.title}</p>
                                            <p className="text-xs font-bold gradient-text-price">¥{item.selling_price.toLocaleString()}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                    </div>
                                ))}
                                {(activeTab === "past" ? initialPastItems : initialListingItems).length === 0 && (
                                    <p className="text-center py-8 text-sm text-gray-400">アイテムがありません</p>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* Favorites Section */}
                <section className="space-y-4 pb-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                            <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                            お気に入り一覧
                        </h3>
                        <span className="text-sm font-bold text-red-500">{favoriteItems.length}件</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {favoriteItems.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => router.push(`/product/${item.id}`)}
                                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer group"
                            >
                                <div className={`aspect-square relative flex items-center justify-center bg-gray-50 overflow-hidden ${item.status !== "available" ? "opacity-70" : ""}`}>
                                    {getItemImageUrl(item, "front", "thumbnail") ? (
                                        <Image
                                            src={getItemImageUrl(item, "front", "thumbnail")!}
                                            alt={item.title}
                                            fill
                                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                                            sizes="50vw"
                                            quality={55}
                                        />
                                    ) : (
                                        <BookOpen className="w-8 h-8 text-gray-200" />
                                    )}
                                    {item.status !== "available" && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <span className="bg-red-500 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-lg tracking-wider">
                                                SOLD
                                            </span>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-sm">
                                        <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                                    </div>
                                </div>
                                <div className="p-3 space-y-1">
                                    <h4 className={`text-sm font-bold truncate group-hover:text-primary transition-colors ${item.status !== "available" ? "text-gray-400" : "text-gray-900"}`}>{item.title}</h4>
                                    <p className={`text-sm font-extrabold ${item.status !== "available" ? "text-gray-400 line-through" : "gradient-text-price"}`}>¥{item.selling_price.toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                        {favoriteItems.length === 0 && (
                            <div className="col-span-2 py-12 text-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                                <Heart className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">お気に入りのアイテムはありません</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
