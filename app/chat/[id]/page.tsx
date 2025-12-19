"use client";

import Link from "next/link";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
};

type Transaction = {
  id: string;
  item_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  item?: {
    title: string;
  };
};

export default function ChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    // 重複リクエスト防止
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadTransactionAndMessages();

    // Subscribe to real-time messages
    const channel = supabase
      .channel(`transaction-chat-${params.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `transaction_id=eq.${params.id}`,
        },
        (payload) => {
          console.log("New message received:", payload);
          setMessages((current) => [...current, payload.new as Message]);
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    // Cleanup on unmount
    return () => {
      console.log("Unsubscribing from chat channel");
      supabase.removeChannel(channel);
    };
  }, [params.id, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadTransactionAndMessages = async () => {
    if (!user) return;

    try {
      // トランザクションとメッセージを並列取得で高速化
      const txPromise = supabase
        .from("transactions")
        .select("*, item:items(title)")
        .eq("id", params.id)
        .single();

      const messagesPromise = supabase
        .from("messages")
        .select("*")
        .eq("transaction_id", params.id)
        .order("created_at", { ascending: true });

      const [txResult, messagesResult] = await Promise.all([txPromise, messagesPromise]) as [any, any];

      if (txResult.error) throw txResult.error;

      if (txResult.data) {
        const tx = txResult.data;

        // Check if user is part of this transaction
        if (tx.buyer_id !== user.id && tx.seller_id !== user.id) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        setTransaction({
          id: tx.id,
          item_id: tx.item_id,
          buyer_id: tx.buyer_id,
          seller_id: tx.seller_id,
          status: tx.status,
          item: tx.item,
        });

        // Set other user
        const other = tx.buyer_id === user.id ? tx.seller_id : tx.buyer_id;
        setOtherUserId(other);
      }

      if (messagesResult.error) throw messagesResult.error;
      if (messagesResult.data) setMessages(messagesResult.data as Message[]);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !transaction || !otherUserId || sending) return;

    setSending(true);

    try {
      const { error } = await (supabase.from("messages") as any).insert({
        item_id: transaction.item_id,
        transaction_id: transaction.id,
        sender_id: user.id,
        receiver_id: otherUserId,
        message: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage("");
    } catch (err: any) {
      alert("メッセージの送信に失敗しました: " + err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">このチャットにアクセスする権限がありません</p>
          <Link href="/" className="text-primary hover:underline">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">取引が見つかりませんでした</p>
          <Link href="/" className="text-primary hover:underline">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {transaction.item?.title || "取引チャット"}
            </h1>
            <p className="text-sm text-gray-600">
              {transaction.status === "pending" ? "取引調整中" : "取引完了"}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                まだメッセージがありません
                <br />
                最初のメッセージを送信してください
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-2xl shadow-sm ${isOwnMessage
                      ? "bg-primary text-white"
                      : "bg-white text-gray-900 border"
                      }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    <p
                      className={`text-xs mt-1 ${isOwnMessage ? "text-primary-foreground/70" : "text-gray-500"
                        }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="fixed bottom-20 left-0 right-0 bg-white border-t px-6 py-4 z-40">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="メッセージを入力..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
