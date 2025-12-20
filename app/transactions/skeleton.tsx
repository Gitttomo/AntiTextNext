"use client";

import { Package } from "lucide-react";

export function TransactionsSkeleton() {
    return (
        <div className="min-h-screen bg-white pb-24 animate-pulse">
            {/* Header Skeleton */}
            <header className="bg-white px-6 pt-8 pb-6 border-b">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-40 bg-gray-200 rounded-lg"></div>
                </div>

                {/* User Profile Skeleton */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200"></div>
                    <div className="space-y-2">
                        <div className="h-4 w-24 bg-gray-200 rounded"></div>
                        <div className="h-3 w-32 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </header>

            {/* Tabs Skeleton */}
            <div className="flex border-b">
                <div className="flex-1 py-4 flex justify-center">
                    <div className="h-5 w-24 bg-gray-200 rounded"></div>
                </div>
                <div className="flex-1 py-4 flex justify-center border-l">
                    <div className="h-5 w-24 bg-gray-200 rounded"></div>
                </div>
            </div>

            {/* List Skeleton */}
            <div className="px-6 py-6 space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl p-5 border-2 border-gray-100 flex items-start gap-4">
                        <div className="w-16 h-16 bg-gray-200 rounded-xl flex-shrink-0"></div>
                        <div className="flex-1 space-y-3">
                            <div className="h-3 w-16 bg-gray-100 rounded-full"></div>
                            <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
                            <div className="h-5 w-20 bg-gray-100 rounded"></div>
                        </div>
                        <div className="h-10 w-24 bg-gray-200 rounded-xl"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}
