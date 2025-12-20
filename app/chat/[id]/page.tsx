"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Send, Loader2, User, Check, CheckCheck } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type ItemWithTransaction = {
  id: string;
  title: string;
  seller_id: string;
  status: string;
};

type UserProfile = {
  avatar_url: string | null;
  nickname: string;
};

export default function ChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, loading: authLoading, avatarUrl } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [item, setItem] = useState<ItemWithTransaction | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherUserProfile, setOtherUserProfile] = useState<UserProfile | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 未読メッセージを既読にする
  const markMessagesAsRead = useCallback(async () => {
    if (!user || !params.id) return;

    try {
      await (supabase.from("messages") as any)
        .update({ is_read: true })
        .eq("item_id", params.id)
        .eq("receiver_id", user.id)
        .eq("is_read", false);
    } catch (err) {
      console.error("Error marking messages as read:", err);
    }
  }, [params.id, user]);

  // メッセージ取得関数
  const fetchMessages = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("item_id", params.id)
        .order("created_at", { ascending: true });

      if (!error && data) {
        const realMessages = data as Message[];
        setMessages(prev => {
          const tempMessages = prev.filter(m => m.id.startsWith('temp-'));
          const filteredTemp = tempMessages.filter(temp =>
            !realMessages.some(real =>
              real.sender_id === temp.sender_id &&
              real.message === temp.message
            )
          );
          return [...realMessages, ...filteredTemp];
        });

        // 自分宛ての未読メッセージがあれば既読にする
        const hasUnread = realMessages.some(m =>
          m.receiver_id === user.id && !m.is_read
        );
        if (hasUnread) {
          markMessagesAsRead();
        }
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, [params.id, user, markMessagesAsRead]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/auth/login");
      return;
    }

    if (loadedRef.current) return;
    loadedRef.current = true;
    loadItemAndMessages();

    // リアルタイム購読
    const channel = supabase
      .channel(`item-chat-${params.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `item_id=eq.${params.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Message;
            setMessages((current) => {
              if (current.some(m => m.id === newMsg.id)) return current;
              const filtered = current.filter(m =>
                !m.id.startsWith('temp-') ||
                (m.message !== newMsg.message || m.sender_id !== newMsg.sender_id)
              );
              return [...filtered, newMsg];
            });
            // 自分宛てなら既読にする
            if (newMsg.receiver_id === user.id) {
              markMessagesAsRead();
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedMsg = payload.new as Message;
            setMessages(current =>
              current.map(m => m.id === updatedMsg.id ? updatedMsg : m)
            );
          }
        }
      )
      .subscribe();

    // ポーリング: 3秒ごとにメッセージを取得
    pollingRef.current = setInterval(() => {
      fetchMessages();
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [params.id, user, authLoading, router, fetchMessages, markMessagesAsRead]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadItemAndMessages = async () => {
    if (!user) return;

    try {
      const itemPromise = supabase
        .from("items")
        .select("id, title, seller_id, status")
        .eq("id", params.id)
        .single();

      const messagesPromise = supabase
        .from("messages")
        .select("*")
        .eq("item_id", params.id)
        .order("created_at", { ascending: true });

      const transactionPromise = supabase
        .from("transactions")
        .select("buyer_id, seller_id")
        .eq("item_id", params.id)
        .single();

      const [itemResult, messagesResult, transactionResult] = await Promise.all([
        itemPromise,
        messagesPromise,
        transactionPromise
      ]) as [any, any, any];

      if (itemResult.error) throw itemResult.error;

      if (itemResult.data) {
        const itemData = itemResult.data;
        const buyerId = transactionResult.data?.buyer_id;
        const sellerId = itemData.seller_id;

        if (user.id !== buyerId && user.id !== sellerId) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        setItem({
          id: itemData.id,
          title: itemData.title,
          seller_id: itemData.seller_id,
          status: itemData.status,
        });

        const other = user.id === sellerId ? buyerId : sellerId;
        setOtherUserId(other);

        if (other) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("avatar_url, nickname")
            .eq("user_id", other)
            .single();

          if (profileData) {
            setOtherUserProfile(profileData as UserProfile);
          }
        }
      }

      if (messagesResult.error) throw messagesResult.error;
      if (messagesResult.data) {
        setMessages(messagesResult.data as Message[]);
        // 初回読み込み時に既読にする
        markMessagesAsRead();
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const messageText = newMessage.trim();
    if (!messageText || !user || !item || !otherUserId || sending) return;

    setNewMessage("");
    setSending(true);

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: otherUserId,
      message: messageText,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMessage]);

    try {
      const { error } = await (supabase.from("messages") as any).insert({
        item_id: item.id,
        sender_id: user.id,
        receiver_id: otherUserId,
        message: messageText,
        is_read: false,
      });

      if (error) throw error;

      // 送信成功後、すぐにメッセージを再取得
      setTimeout(() => fetchMessages(), 300);
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      setNewMessage(messageText); // 元に戻す
      alert("メッセージの送信に失敗しました: " + err.message);
    } finally {
      setSending(false);
      // 入力欄にフォーカスを戻す
      inputRef.current?.focus();
    }
  };

  // アバターコンポーネント
  const Avatar = ({ url, size = 40 }: { url: string | null; size?: number }) => (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 bg-gray-200"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image
          src={url}
          alt="avatar"
          width={size}
          height={size}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-300">
          <User className="w-1/2 h-1/2 text-gray-500" />
        </div>
      )}
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="h-screen bg-[#B2C7D9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">このチャットにアクセスする権限がありません</p>
          <Link href="/" className="text-primary hover:underline">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">商品が見つかりませんでした</p>
          <Link href="/" className="text-primary hover:underline">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  const statusLabel = {
    available: "出品中",
    transaction_pending: "取引調整中",
    sold: "取引完了",
  }[item.status] || item.status;

  return (
    <div className="h-screen flex flex-col bg-[#B2C7D9] overflow-hidden">
      {/* Header */}
      <header className="bg-[#B2C7D9] px-4 py-3 flex items-center gap-3 flex-shrink-0 border-b border-white/20">
        <Link href="/transactions" className="p-1">
          <ArrowLeft className="w-6 h-6 text-white" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold truncate">
            {item.title}
          </h1>
          <p className="text-white/70 text-xs">
            {statusLabel}
          </p>
        </div>
      </header>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/80 text-sm">
              メッセージを送信して取引を開始しましょう
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const isOwnMessage = msg.sender_id === user?.id;
              const prevMsg = messages[index - 1];
              const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* アバター */}
                  <div className="flex-shrink-0" style={{ width: 40 }}>
                    {showAvatar && (
                      <Avatar url={isOwnMessage ? avatarUrl : otherUserProfile?.avatar_url || null} />
                    )}
                  </div>

                  {/* メッセージバブル */}
                  <div className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"} max-w-[85%]`}>
                    <div
                      className={`w-fit min-w-[50px] px-4 py-2.5 rounded-2xl shadow-sm bg-white ${
                        isOwnMessage ? "rounded-br-sm" : "rounded-bl-sm"
                      }`}
                      style={{ border: "2px solid #3B5998" }}
                    >
                      <p className="whitespace-pre-wrap break-all text-[15px] leading-relaxed text-[#3B5998] font-medium">
                        {msg.message}
                      </p>
                    </div>
                    {/* 既読表示（自分のメッセージのみ） */}
                    {isOwnMessage && (
                      <div className="flex items-center gap-1 mt-1 mr-1">
                        {msg.is_read ? (
                          <span className="text-[10px] text-blue-200 flex items-center gap-0.5">
                            <CheckCheck className="w-3 h-3" />
                            既読
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/50 flex items-center gap-0.5">
                            <Check className="w-3 h-3" />
                            送信済み
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 bg-white px-4 py-3 border-t border-gray-200">
        <form
          onSubmit={handleSend}
          className="flex items-center gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="メッセージを入力..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-full text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-200"
            disabled={sending}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!newMessage.trim() || sending}
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              newMessage.trim() && !sending
                ? "bg-primary text-white shadow-md active:scale-95"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>

      <style jsx global>{`
        .safe-area-bottom {
          padding-bottom: max(12px, env(safe-area-inset-bottom));
        }
      `}</style>
    </div>
  );
}
