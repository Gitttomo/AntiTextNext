export type PurchaseData = {
    paymentMethod: "cash" | "paypay";
    timeSlots: string[];
    locations: string[];
};

// 自動メッセージ生成用のヘルパー関数
export function generatePurchaseMessage(data: PurchaseData): string {
    const paymentMethodLabel = data.paymentMethod === "cash" ? "現金手渡し" : "PayPay（対面・送金）";

    const timeSlotLabels: Record<string, string> = {
        "12period": "12限終わり休み",
        "lunch": "お昼休み",
        "56period": "56限終わり休み",
        "78period": "78限終わり休み",
        "other": "その他",
    };

    const locationLabels: Record<string, string> = {
        library: "図書館前",
        taki_plaza: "タキプラザ一階",
        seven_eleven: "セブンイレブン前",
        other: "その他（チャットで相談）",
    };

    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

    const formattedTimeSlots = data.timeSlots.map((slot) => {
        const [dateStr, slotId] = slot.split("_");
        const date = new Date(dateStr);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dayName = dayNames[date.getDay()];
        return `・${month}/${day}(${dayName}) ${timeSlotLabels[slotId] || slotId}`;
    }).join("\n");

    const formattedLocations = data.locations
        .map((loc) => `・${locationLabels[loc] || loc}`)
        .join("\n");

    return `【購入リクエストが届きました】

■ 支払い方法: ${paymentMethodLabel}

▼ 受け渡し希望日時（候補）:
${formattedTimeSlots}

▼ 受け渡し希望場所（候補）:
${formattedLocations}

出品者様は、この中から都合の良い条件を選んで返信してください。`;
}
