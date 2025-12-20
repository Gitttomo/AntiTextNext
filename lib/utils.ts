/**
 * ユーティリティ関数ファイル
 * 
 * アプリ全体で使用する共通関数を定義します。
 * - cn: Tailwind CSSクラスを結合するための関数
 * - calculateSellingPrice: 定価から販売価格を計算する関数
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * CSSクラス名を結合するユーティリティ関数
 * clsxで条件付きクラスを処理し、tailwind-mergeで重複を解決します
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 販売価格を計算する関数
 * 定価の30%を販売価格として設定（小数点以下切り捨て）
 */
export function calculateSellingPrice(originalPrice: number): number {
  return Math.floor(originalPrice * 0.3);
}
