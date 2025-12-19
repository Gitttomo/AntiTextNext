import { useState } from "react";
import { X, CreditCard, Banknote, Smartphone } from "lucide-react";
import { PurchaseData } from "./purchase-utils";

type PurchaseModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: PurchaseData) => void;
    itemTitle: string;
};

const TIME_SLOTS = [
    { id: "12period", label: "12限終わり休み" },
    { id: "lunch", label: "お昼休み" },
    { id: "56period", label: "56限終わり休み" },
    { id: "78period", label: "78限終わり休み" },
];

const LOCATIONS = [
    { id: "library", label: "図書館前" },
    { id: "taki_plaza", label: "タキプラザ一階" },
    { id: "seven_eleven", label: "セブンイレブン前" },
    { id: "other", label: "その他（チャットで相談）" },
];

// 今日から7日間の日付を生成
const getNext7Days = () => {
    const days = [];
    const today = new Date();
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dayName = dayNames[date.getDay()];
        days.push({
            id: date.toISOString().split("T")[0],
            label: `${month}/${day}(${dayName})`,
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
        });
    }
    return days;
};

export default function PurchaseModal({
    isOpen,
    onClose,
    onSubmit,
    itemTitle,
}: PurchaseModalProps) {
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "paypay">("cash");
    const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [expandedDays, setExpandedDays] = useState<string[]>([]);

    const days = getNext7Days();

    const toggleTimeSlot = (dateId: string, slotId: string) => {
        const key = `${dateId}_${slotId}`;
        setSelectedTimeSlots((prev) =>
            prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
        );
    };

    const toggleLocation = (locationId: string) => {
        setSelectedLocations((prev) =>
            prev.includes(locationId)
                ? prev.filter((l) => l !== locationId)
                : [...prev, locationId]
        );
    };

    const toggleDay = (dayId: string) => {
        setExpandedDays((prev) =>
            prev.includes(dayId)
                ? prev.filter((d) => d !== dayId)
                : [...prev, dayId]
        );
    };

    const handleSubmit = () => {
        if (selectedTimeSlots.length === 0) {
            alert("受け渡し希望日時を1つ以上選択してください");
            return;
        }
        if (selectedLocations.length === 0) {
            alert("受け渡し希望場所を1つ以上選択してください");
            return;
        }

        onSubmit({
            paymentMethod,
            timeSlots: selectedTimeSlots,
            locations: selectedLocations,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-xl">
                {/* Header */}
                <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">購入リクエスト</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="px-6 py-6 space-y-6">
                    {/* 商品名 */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                        <p className="text-sm text-gray-600">購入商品</p>
                        <p className="font-semibold text-gray-900">{itemTitle}</p>
                    </div>

                    {/* 支払い方法 */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3">
                            支払い方法
                        </h3>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:border-primary transition-colors">
                                <input
                                    type="radio"
                                    name="payment"
                                    value="cash"
                                    checked={paymentMethod === "cash"}
                                    onChange={() => setPaymentMethod("cash")}
                                    className="w-5 h-5 text-primary"
                                />
                                <Banknote className="w-5 h-5 text-green-600" />
                                <span className="font-medium">現金手渡し</span>
                            </label>

                            <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:border-primary transition-colors">
                                <input
                                    type="radio"
                                    name="payment"
                                    value="paypay"
                                    checked={paymentMethod === "paypay"}
                                    onChange={() => setPaymentMethod("paypay")}
                                    className="w-5 h-5 text-primary"
                                />
                                <Smartphone className="w-5 h-5 text-red-500" />
                                <div>
                                    <span className="font-medium">PayPay（対面・送金）</span>
                                    <p className="text-xs text-gray-500">対面でのQR読み取り、またはリンク送金</p>
                                </div>
                            </label>

                            <div className="flex items-center gap-3 p-4 border rounded-xl bg-gray-50 opacity-60">
                                <input
                                    type="radio"
                                    disabled
                                    className="w-5 h-5"
                                />
                                <CreditCard className="w-5 h-5 text-gray-400" />
                                <div className="flex-1">
                                    <span className="font-medium text-gray-500">クレジットカード</span>
                                </div>
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                                    準備中
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 受け渡し希望日時 */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3">
                            受け渡し希望日時
                            <span className="text-sm font-normal text-gray-500 ml-2">（複数選択可）</span>
                        </h3>
                        <div className="space-y-2">
                            {days.map((day) => (
                                <div key={day.id} className="border rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => toggleDay(day.id)}
                                        className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${day.isWeekend ? "bg-blue-50" : ""
                                            }`}
                                    >
                                        <span className="font-medium">{day.label}</span>
                                        <span className="text-gray-400">
                                            {expandedDays.includes(day.id) ? "−" : "+"}
                                        </span>
                                    </button>
                                    {expandedDays.includes(day.id) && (
                                        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                                            {TIME_SLOTS.map((slot) => {
                                                const key = `${day.id}_${slot.id}`;
                                                const isSelected = selectedTimeSlots.includes(key);
                                                return (
                                                    <label
                                                        key={slot.id}
                                                        className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${isSelected
                                                                ? "bg-primary/10 border-primary border"
                                                                : "bg-gray-50 hover:bg-gray-100"
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleTimeSlot(day.id, slot.id)}
                                                            className="w-4 h-4 text-primary rounded"
                                                        />
                                                        <span className="text-sm">{slot.label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {selectedTimeSlots.length > 0 && (
                            <p className="text-sm text-primary mt-2">
                                {selectedTimeSlots.length}件の日時を選択中
                            </p>
                        )}
                    </div>

                    {/* 受け渡し場所 */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3">
                            受け渡し場所
                            <span className="text-sm font-normal text-gray-500 ml-2">（複数選択可）</span>
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {LOCATIONS.map((location) => {
                                const isSelected = selectedLocations.includes(location.id);
                                return (
                                    <label
                                        key={location.id}
                                        className={`flex items-center gap-2 p-4 rounded-xl cursor-pointer transition-colors ${isSelected
                                                ? "bg-primary/10 border-primary border"
                                                : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleLocation(location.id)}
                                            className="w-4 h-4 text-primary rounded"
                                        />
                                        <span className="text-sm font-medium">{location.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Submit Button - BottomNavの高さ（80px）分の余白を確保 */}
                <div className="sticky bottom-0 bg-white px-6 py-4 border-t pb-24 sm:pb-4">
                    <button
                        onClick={handleSubmit}
                        disabled={selectedTimeSlots.length === 0 || selectedLocations.length === 0}
                        className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                    >
                        購入リクエストの送信
                    </button>
                </div>
            </div>
        </div>
    );
}

