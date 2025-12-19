"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import { calculateSellingPrice } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

type ListingStep = "form" | "confirm" | "success";

export default function ListingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<ListingStep>("form");
  const [formData, setFormData] = useState({
    bookName: "",
    originalPrice: "",
    condition: "良好",
    frontCover: null as File | null,
    backCover: null as File | null,
  });

  const [frontCoverPreview, setFrontCoverPreview] = useState<string>("");
  const [backCoverPreview, setBackCoverPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // useEffect内でリダイレクト（SSRでのlocationエラーを防止）
  useEffect(() => {
    if (!user && step === "form") {
      router.push("/auth/login");
    }
  }, [user, step, router]);

  // 未認証時は何も表示しない
  if (!user && step === "form") {
    return null;
  }

  const sellingPrice = formData.originalPrice
    ? calculateSellingPrice(Number(formData.originalPrice))
    : 0;

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "front" | "back"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      // Blob URLを使用してメモリ効率を改善
      const url = URL.createObjectURL(file);
      if (type === "front") {
        // 古いBlob URLを解放
        if (frontCoverPreview) URL.revokeObjectURL(frontCoverPreview);
        setFrontCoverPreview(url);
        setFormData({ ...formData, frontCover: file });
      } else {
        // 古いBlob URLを解放
        if (backCoverPreview) URL.revokeObjectURL(backCoverPreview);
        setBackCoverPreview(url);
        setFormData({ ...formData, backCover: file });
      }
    }
  };

  const uploadImage = async (file: File, fileName: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${user!.id}/${fileName}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('item-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async () => {
    if (step === "form") {
      setStep("confirm");
    } else if (step === "confirm") {
      setUploading(true);

      try {
        // Upload images
        let frontImageUrl = null;
        let backImageUrl = null;

        if (formData.frontCover) {
          frontImageUrl = await uploadImage(formData.frontCover, `front-${Date.now()}`);
        }

        if (formData.backCover) {
          backImageUrl = await uploadImage(formData.backCover, `back-${Date.now()}`);
        }

        // Create item in database
        const { error } = await (supabase.from("items") as any).insert({
          seller_id: user!.id,
          title: formData.bookName,
          original_price: Number(formData.originalPrice),
          selling_price: sellingPrice,
          condition: formData.condition,
          status: "available",
          front_image_url: frontImageUrl,
          back_image_url: backImageUrl,
        });

        if (error) throw error;

        setStep("success");
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } catch (error: any) {
        alert("出品に失敗しました: " + error.message);
        setUploading(false);
      }
    }
  };

  const canSubmit =
    formData.bookName &&
    formData.originalPrice &&
    formData.condition &&
    formData.frontCover &&
    formData.backCover;

  if (step === "success") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            出品完了！
          </h1>
          <p className="text-lg text-gray-600">
            出品を受け付けました。
            <br />
            ありがとうございます！
          </p>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-white">
        <header className="bg-white px-6 pt-8 pb-6 border-b">
          <h1 className="text-3xl font-bold text-primary">
            出品内容の確認
          </h1>
        </header>

        <div className="px-6 py-8">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border shadow-lg p-8">
            <div className="space-y-6">
              <div>
                <span className="text-sm font-medium text-gray-600">教科書名</span>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {formData.bookName}
                </p>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-600">状態</span>
                <p className="text-lg text-gray-900 mt-1">
                  {formData.condition}
                </p>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-600">出品価格</span>
                <p className="text-2xl font-bold text-primary mt-1">
                  ¥{sellingPrice.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  定価: ¥{Number(formData.originalPrice).toLocaleString()}
                </p>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-600 block mb-3">写真</span>
                <div className="grid grid-cols-2 gap-4">
                  {frontCoverPreview && (
                    <div>
                      <img
                        src={frontCoverPreview}
                        alt="表紙"
                        className="w-full aspect-[3/4] object-cover rounded-xl border"
                      />
                      <p className="text-center mt-2 text-sm text-gray-600">
                        表紙
                      </p>
                    </div>
                  )}
                  {backCoverPreview && (
                    <div>
                      <img
                        src={backCoverPreview}
                        alt="裏表紙"
                        className="w-full aspect-[3/4] object-cover rounded-xl border"
                      />
                      <p className="text-center mt-2 text-sm text-gray-600">
                        裏表紙
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-center text-gray-700 font-medium">
                上記内容で出品します。
                <br />
                間違いがないかご確認ください
              </p>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep("form")}
                disabled={uploading}
                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-50 transition-all"
              >
                戻る
              </button>
              <button
                onClick={handleSubmit}
                disabled={uploading}
                className="flex-1 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    出品中...
                  </>
                ) : (
                  "出品する"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white px-6 pt-8 pb-6 border-b">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
          </Link>
          <h1 className="text-3xl font-bold text-primary animate-slide-in-left">
            教科書の出品
          </h1>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border shadow-lg p-8">
            <div className="space-y-6">
              <div className="animate-slide-in-bottom">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  教科書名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例: 機械力学"
                  value={formData.bookName}
                  onChange={(e) =>
                    setFormData({ ...formData, bookName: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              <div className="animate-slide-in-bottom" style={{ animationDelay: '100ms' }}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  状態 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.condition}
                  onChange={(e) =>
                    setFormData({ ...formData, condition: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                >
                  <option value="美品">美品</option>
                  <option value="良好">良好</option>
                  <option value="可">可</option>
                </select>
              </div>

              <div className="animate-slide-in-bottom" style={{ animationDelay: '200ms' }}>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  写真 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, "front")}
                        className="hidden"
                      />
                      <div className="w-full aspect-[3/4] bg-gray-100 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300">
                        {frontCoverPreview ? (
                          <img
                            src={frontCoverPreview}
                            alt="表紙"
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-gray-400 mb-2" />
                            <span className="text-gray-600 text-center px-4 text-sm">
                              表紙をアップロード
                            </span>
                          </>
                        )}
                      </div>
                    </label>
                    <p className="text-center mt-2 text-sm text-gray-600">表紙</p>
                  </div>

                  <div>
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, "back")}
                        className="hidden"
                      />
                      <div className="w-full aspect-[3/4] bg-gray-100 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300">
                        {backCoverPreview ? (
                          <img
                            src={backCoverPreview}
                            alt="裏表紙"
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-gray-400 mb-2" />
                            <span className="text-gray-600 text-center px-4 text-sm">
                              裏表紙をアップロード
                            </span>
                          </>
                        )}
                      </div>
                    </label>
                    <p className="text-center mt-2 text-sm text-gray-600">裏表紙</p>
                  </div>
                </div>
              </div>

              <div className="animate-slide-in-bottom" style={{ animationDelay: '300ms' }}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  定価（税抜き） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="例: 3000"
                  value={formData.originalPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, originalPrice: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  裏表紙に記載されている定価を入力してください
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 animate-slide-in-bottom" style={{ animationDelay: '400ms' }}>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">出品価格</span>
                  <span className="text-2xl font-bold text-primary">
                    ¥{sellingPrice.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  ※ 定価の約30%で自動計算されます
                </p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full mt-8 py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg animate-slide-in-bottom"
              style={{ animationDelay: '500ms' }}
            >
              確認画面へ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
