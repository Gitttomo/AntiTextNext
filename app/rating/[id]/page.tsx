"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RatingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    // In real app, submit rating to backend
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      <header className="bg-gradient-to-b from-blue-50 to-blue-100 px-6 pt-8 pb-6">
        <h1 className="text-4xl font-bold text-primary underline decoration-4 underline-offset-8">
          TextNext
        </h1>
      </header>

      <div className="px-6 py-12 flex flex-col items-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-12">
          取引が完了しました
        </h2>

        {/* User Avatar */}
        <div className="mb-8 flex items-center gap-4 bg-blue-200 px-8 py-4 rounded-full">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center text-3xl">
            🍚
          </div>
          <span className="text-2xl font-bold text-primary">米太郎</span>
        </div>

        <p className="text-xl font-medium text-gray-900 mb-8">
          に対する評価をお願いします
        </p>

        {/* Star Rating */}
        <div className="bg-white rounded-2xl p-8 mb-8 w-full max-w-md shadow-lg">
          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-16 h-16 transition-colors ${
                    star <= (hoveredRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "fill-gray-300 text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="コメント（任意）"
            className="w-full h-40 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary transition-colors resize-none text-gray-700 placeholder:text-gray-400"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={rating === 0}
          className="bg-red-600 text-white px-16 py-5 rounded-lg text-2xl font-bold shadow-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          送信
        </button>
      </div>
    </div>
  );
}
