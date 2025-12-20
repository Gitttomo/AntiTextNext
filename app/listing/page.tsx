"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2, Camera, X, Scan } from "lucide-react";
import { calculateSellingPrice } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import Quagga from "@ericblade/quagga2";

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
    barcode: "",
  });

  const [frontCoverPreview, setFrontCoverPreview] = useState<string>("");
  const [backCoverPreview, setBackCoverPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"scanning" | "detected" | "idle">("idle");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const scannerRef = useRef<HTMLDivElement>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const autoScanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const detectedRef = useRef(false);

  // ズームレベルを変更する関数
  const changeZoom = useCallback(async (newZoom: number) => {
    if (!videoTrackRef.current) return;
    try {
      const capabilities = videoTrackRef.current.getCapabilities?.() as any;
      if (capabilities?.zoom) {
        const clampedZoom = Math.min(Math.max(newZoom, capabilities.zoom.min), capabilities.zoom.max);
        await (videoTrackRef.current as any).applyConstraints({
          advanced: [{ zoom: clampedZoom }]
        });
        setZoomLevel(clampedZoom);
      }
    } catch (e) {
      console.log("Zoom not supported:", e);
    }
  }, []);

  // Stop scanner when component unmounts or isScanning becomes false
  useEffect(() => {
    let active = true;

    if (!isScanning) {
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current = null;
      }
      Quagga.stop();
      return;
    }

    // Initialize scanner
    const initScanner = async () => {
      // Wait for the modal DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!active) return; // Stop if effect was cleaned up

      if (!scannerRef.current) {
        console.error("Scanner ref not found");
        setIsScanning(false);
        return;
      }

      Quagga.init({
        inputStream: {
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            facingMode: "environment",
            width: { min: 640 },
            height: { min: 480 },
            aspectRatio: { min: 4/3, max: 16/9 }
          },
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
        },
        numOfWorkers: 2,
        decoder: {
          readers: ["ean_reader"], // ISBN is EAN-13
        },
        locate: true,
      }, async (err) => {
        if (err) {
          console.error("Quagga init error:", err);
          if (active) setIsScanning(false);
          return;
        }
        
        if (!active) {
          Quagga.stop();
          return;
        }

        Quagga.start();
        
        // Get video track for zoom control
        const video = scannerRef.current?.querySelector("video");
        if (video && video.srcObject) {
          const stream = video.srcObject as MediaStream;
          const track = stream.getVideoTracks()[0];
          if (track) {
            videoTrackRef.current = track;
            
            // Check for zoom capabilities
            const capabilities = track.getCapabilities?.() as any;
            if (capabilities?.zoom) {
              setMaxZoom(capabilities.zoom.max);
              setZoomLevel(capabilities.zoom.min); // Reset to min
            }
          }
        }
      });

      Quagga.onDetected((result) => {
        if (!active || detectedRef.current) return; // Prevent double detection
        
        const code = result.codeResult.code;
        if (code && (code.startsWith("978") || code.startsWith("979"))) {
          detectedRef.current = true;
          setScanStatus("detected");
          
          // Play a sound or vibrate here if possible
          if (navigator.vibrate) navigator.vibrate(200);

          setTimeout(() => {
            if (!active) return;
            Quagga.stop();
            setIsScanning(false);
            setFormData(prev => ({ ...prev, barcode: code }));
            detectedRef.current = false; // Reset for next time
            setScanStatus("idle");
            
            setTimeout(() => {
              searchBookByIsbn(code);
            }, 100);
          }, 500); // Give user a moment to see "Detected" status
        }
      });
    };

    initScanner();

    return () => {
      active = false;
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current = null;
      }
      Quagga.stop();
      detectedRef.current = false;
    };
  }, [isScanning]);

  const startScanner = () => {
    setIsScanning(true);
    setScanStatus("scanning");
  };

  const stopScanner = () => {
    setIsScanning(false);
    setScanStatus("idle");
  };

  const searchBookByIsbn = async (isbn: string) => {
    const cleanIsbn = isbn.replace(/-/g, "").trim();
    if (!cleanIsbn) return;

    setSearching(true);
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
      const data = await response.json();

      if (data.totalItems > 0) {
        const book = data.items[0].volumeInfo;
        const saleInfo = data.items[0].saleInfo;
        
        setFormData(prev => ({
          ...prev,
          barcode: isbn,
          bookName: book.title || prev.bookName,
          originalPrice: saleInfo?.listPrice?.amount 
            ? String(saleInfo.listPrice.amount) 
            : prev.originalPrice
        }));
      } else {
        alert("書籍が見つかりませんでした。ISBNを確認するか、手動で入力してください。");
      }
    } catch (error) {
      console.error("Barcode search error:", error);
      alert("検索中にエラーが発生しました。");
    } finally {
      setSearching(false);
      // Ensure scanner is effectively off if it wasn't already (though logic handles this)
    }
  };

  const captureAndScan = async () => {
    if (!scannerRef.current) return;
    const video = scannerRef.current.querySelector("video");
    if (!video) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Image enhancement: High contrast & Grayscale
      ctx.filter = "grayscale(1) contrast(1.5) brightness(1.2)";
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg");

      Quagga.decodeSingle({
        src: dataUrl,
        numOfWorkers: 0,
        inputStream: {
          size: 800
        },
        decoder: {
          readers: ["ean_reader"]
        },
      }, (result) => {
        if (result?.codeResult) {
          const code = result.codeResult.code;
          if (code && (code.startsWith("978") || code.startsWith("979"))) {
            setScanStatus("detected");
            if (navigator.vibrate) navigator.vibrate(200);
            
            setTimeout(() => {
              Quagga.stop();
              setIsScanning(false);
              setFormData(prev => ({ ...prev, barcode: code }));
              setScanStatus("idle");
              
              setTimeout(() => {
                searchBookByIsbn(code);
              }, 100);
            }, 500);
            return;
          }
        }
        alert("バーコードを検出できませんでした。もう一度試してください。");
      });
    } catch (e) {
      console.error("Snapshot scan error:", e);
      alert("撮影に失敗しました。");
    }
  };

  const handleBarcodeSearch = () => {
    searchBookByIsbn(formData.barcode);
  };

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
                  バーコード (ISBN) <span className="text-gray-400 text-xs ml-1">※任意</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="978から始まる13桁の数字"
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <button
                    onClick={startScanner}
                    className="p-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                    title="カメラで読み取る"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleBarcodeSearch}
                    disabled={searching || !formData.barcode}
                    className="px-3 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-primary disabled:opacity-50 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                  >
                    {searching ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "検索"
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  入力するとタイトルを自動で取得します
                </p>
              </div>

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

      {/* Barcode Scanner Modal */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl overflow-hidden w-full max-w-md relative">
            <div className="p-4 border-b flex items-center justify-between bg-white z-10 relative">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">
                  {scanStatus === "detected" ? "検出しました！" : "バーコードを読み取り中"}
                </h3>
                {scanStatus === "scanning" && (
                  <Scan className="w-5 h-5 text-primary animate-pulse" />
                )}
              </div>
              <button
                onClick={stopScanner}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative w-full aspect-[3/4] bg-black">
              <div ref={scannerRef} className="absolute inset-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />

              {/* Overlay guides */}
              <div className={`absolute inset-0 m-8 rounded-lg pointer-events-none transition-all duration-300 ${
                scanStatus === "detected"
                  ? "border-4 border-green-500 bg-green-500/20"
                  : "border-2 border-primary/50"
              }`}>
                {scanStatus === "scanning" && (
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                    <div className="w-full h-1 bg-red-500 animate-scan-line" />
                  </div>
                )}
                {scanStatus === "detected" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto scan indicator */}
              {scanStatus === "scanning" && (
                <div className="absolute top-4 left-4 right-4 flex justify-center z-20">
                  <div className="bg-black/60 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    自動検出中...
                  </div>
                </div>
              )}

              {/* Zoom Controls - 小さいバーコード用 */}
              {scanStatus === "scanning" && maxZoom > 1 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
                  <button
                    onClick={() => changeZoom(zoomLevel + 0.5)}
                    disabled={zoomLevel >= maxZoom}
                    className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-30 text-lg font-bold"
                  >
                    +
                  </button>
                  <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-full text-center">
                    {zoomLevel.toFixed(1)}x
                  </div>
                  <button
                    onClick={() => changeZoom(zoomLevel - 0.5)}
                    disabled={zoomLevel <= 1}
                    className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-30 text-lg font-bold"
                  >
                    −
                  </button>
                </div>
              )}

              {/* Manual Snapshot Button */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
                <button
                  onClick={captureAndScan}
                  disabled={scanStatus === "detected"}
                  className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                >
                  <div className="w-14 h-14 border-2 border-black rounded-full flex items-center justify-center">
                    <Camera className="w-6 h-6 text-gray-700" />
                  </div>
                </button>
              </div>
            </div>
            <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
              {scanStatus === "detected" ? (
                <span className="text-green-600 font-medium">バーコードを検出しました！書籍情報を取得中...</span>
              ) : (
                <>バーコードを枠の中央に入れると自動で読み取ります<br/>
                <span className="text-xs text-gray-400">小さいバーコードは右の＋ボタンでズームしてください</span></>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
