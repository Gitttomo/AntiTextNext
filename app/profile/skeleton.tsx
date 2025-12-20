"use client";

import { ArrowLeft } from "lucide-react";

export function ProfileSkeleton() {
    return (
        <div className="min-h-screen bg-white pb-24 animate-pulse">
            <header className="bg-white px-6 pt-8 pb-6 border-b">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-6 h-6 bg-gray-200 rounded"></div>
                    <div className="h-8 w-40 bg-gray-200 rounded-lg"></div>
                </div>
            </header>

            <div className="px-6 py-8">
                <div className="max-w-md mx-auto">
                    <div className="bg-white rounded-2xl shadow-lg border p-8 space-y-8">
                        {/* Avatar Skeleton */}
                        <div className="flex flex-col items-center">
                            <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-gray-100"></div>
                            <div className="h-4 w-32 bg-gray-100 rounded mt-4"></div>
                        </div>

                        {/* Info Skeleton */}
                        <div className="space-y-3">
                            <div className="h-6 w-32 bg-gray-200 rounded"></div>
                            <div className="h-4 w-48 bg-gray-100 rounded"></div>
                        </div>

                        {/* Form Skeletons */}
                        <div className="space-y-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="h-4 w-20 bg-gray-100 rounded"></div>
                                    <div className="h-12 w-full bg-gray-50 rounded-xl border border-gray-100"></div>
                                </div>
                            ))}
                        </div>

                        {/* Button Skeleton */}
                        <div className="h-14 w-full bg-gray-200 rounded-xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
