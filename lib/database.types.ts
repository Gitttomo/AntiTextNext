/**
 * Supabaseデータベース型定義ファイル
 * 
 * このファイルはSupabaseデータベースのテーブル構造をTypeScript型として定義します。
 * 
 * テーブル構成:
 * - profiles: ユーザープロフィール（ニックネーム、学部）
 * - items: 出品商品（タイトル、価格、状態、画像URL）
 * - search_histories: 検索履歴
 * - messages: チャットメッセージ
 * - transactions: 取引情報（購入者、出品者、支払い方法、受け渡し情報）
 */

// JSONデータの型定義
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

// データベース全体の型定義
export interface Database {
    public: {
        Tables: {
            // ユーザープロフィールテーブル
            profiles: {
                Row: {
                    user_id: string
                    nickname: string
                    department: string
                    created_at: string
                }
                Insert: {
                    user_id: string
                    nickname: string
                    department: string
                    created_at?: string
                }
                Update: {
                    user_id?: string
                    nickname?: string
                    department?: string
                    created_at?: string
                }
            }
            items: {
                Row: {
                    id: string
                    seller_id: string
                    title: string
                    original_price: number
                    selling_price: number
                    condition: string
                    status: string
                    front_image_url: string | null
                    back_image_url: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    seller_id: string
                    title: string
                    original_price: number
                    selling_price: number
                    condition: string
                    status?: string
                    front_image_url?: string | null
                    back_image_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    seller_id?: string
                    title?: string
                    original_price?: number
                    selling_price?: number
                    condition?: string
                    status?: string
                    front_image_url?: string | null
                    back_image_url?: string | null
                    created_at?: string
                }
            }
            search_histories: {
                Row: {
                    id: string
                    user_id: string
                    keyword: string
                    searched_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    keyword: string
                    searched_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    keyword?: string
                    searched_at?: string
                }
            }
            messages: {
                Row: {
                    id: string
                    item_id: string
                    transaction_id: string | null
                    sender_id: string
                    receiver_id: string
                    message: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    item_id: string
                    transaction_id?: string | null
                    sender_id: string
                    receiver_id: string
                    message: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    item_id?: string
                    transaction_id?: string | null
                    sender_id?: string
                    receiver_id?: string
                    message?: string
                    created_at?: string
                }
            }
            transactions: {
                Row: {
                    id: string
                    item_id: string
                    buyer_id: string
                    seller_id: string
                    payment_method: string
                    meetup_time_slots: string[]
                    meetup_locations: string[]
                    status: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    item_id: string
                    buyer_id: string
                    seller_id: string
                    payment_method: string
                    meetup_time_slots: string[]
                    meetup_locations: string[]
                    status?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    item_id?: string
                    buyer_id?: string
                    seller_id?: string
                    payment_method?: string
                    meetup_time_slots?: string[]
                    meetup_locations?: string[]
                    status?: string
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
