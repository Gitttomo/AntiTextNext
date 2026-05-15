"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

type ChatConversation = {
  item_id: string;
  transaction_id?: string;
  item_title: string;
  other_user_id: string;
  last_message: string;
  last_message_time: string;
};

export default function ChatListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    // 同じユーザーで既に読み込み済みなら再取得しない
    if (loadedUserRef.current === user.id) return;
    loadedUserRef.current = user.id;
    loadConversations();
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      // Get all messages for this user
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select(`
          *,
          items(id, title)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (messagesError) throw messagesError;

      // Group by item + counterpart so multiple purchase requests for one item stay separate.
      const grouped = new Map<string, any>();

      for (const msg of (messages || []) as any[]) {
        const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const conversationKey = `${msg.item_id}:${otherUserId}`;
        if (!grouped.has(conversationKey)) {
          grouped.set(conversationKey, {
            item_id: msg.item_id,
            item_title: msg.items?.title || "不明",
            last_message: msg.message,
            last_message_time: msg.created_at,
            other_user_id: otherUserId,
          });
        }
      }

      const conversationList = Array.from(grouped.values());
      const { data: transactions } = await (supabase as any)
        .from("transactions")
        .select("id, item_id, buyer_id, seller_id, status")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .not("status", "in", "(cancelled)");

      for (const conversation of conversationList) {
        const tx = (transactions || []).find((candidate: any) => {
          const otherUserId = candidate.buyer_id === user.id ? candidate.seller_id : candidate.buyer_id;
          return candidate.item_id === conversation.item_id && otherUserId === conversation.other_user_id;
        });
        if (tx) conversation.transaction_id = tx.id;
      }

      setConversations(conversationList);
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white px-6 pt-8 pb-6 border-b">
        <h1 className="text-3xl font-bold text-primary">チャット</h1>
      </header>

      <div className="px-6 py-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">読み込み中...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">チャットがありません</p>
            <p className="text-sm text-gray-400">
              商品ページからチャットを開始できます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((chat) => (
              <Link key={`${chat.item_id}-${chat.transaction_id || chat.other_user_id}`} href={chat.transaction_id ? `/chat/${chat.item_id}?tx=${chat.transaction_id}` : `/chat/${chat.item_id}`}>
                <div className="bg-white rounded-2xl border p-5 hover:shadow-lg hover:border-primary/30 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 mb-1 truncate">
                        {chat.item_title}
                      </h3>
                      <p className="text-gray-600 text-sm truncate">
                        {chat.last_message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(chat.last_message_time).toLocaleString("ja-JP", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
