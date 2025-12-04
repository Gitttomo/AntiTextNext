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

type Item = {
  id: string;
  title: string;
  seller_id: string;
};

export default function ChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    loadItemAndMessages();
    subscribeToMessages();
  }, [params.id, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadItemAndMessages = async () => {
    if (!user) return;

    try {
      // Load item info
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id, title, seller_id")
        .eq("id", params.id)
        .single();

      if (itemError) throw itemError;
      if (itemData) {
        const item = itemData as Item;
        setItem(item);
        // Determine the other user (if current user is seller, other user is buyer and vice versa)
        const other = item.seller_id === user.id ? null : item.seller_id;
        setOtherUserId(other);
      }

      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("item_id", params.id)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;
      if (messagesData) setMessages(messagesData as Message[]);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages:${params.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `item_id=eq.${params.id}`,
        },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !item || sending) return;

    setSending(true);

    try {
      const { error } = await supabase.from("messages").insert({
        item_id: params.id,
        sender_id: user.id,
        receiver_id: otherUserId || item.seller_id,
        message: newMessage.trim(),
      } as any);

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

  if (!item) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-600">商品が見つかりませんでした</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-6 py-4 border-b sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href={`/product/${params.id}`}>
            <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{item.title}</h1>
            <p className="text-sm text-gray-600">チャット</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
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
      <div className="bg-white border-t px-6 py-4 safe-area-bottom">
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
