"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Send, Loader2, User, Check, CheckCheck, Calendar, MapPin, Clock, RotateCcw, ImageIcon, Plus, X as XIcon, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  image_url?: string | null;
  is_read: boolean;
  created_at: string;
};

type ItemWithTransaction = {
  id: string;
  title: string;
  seller_id: string;
  status: string;
};

type Transaction = {
  id: string;
  item_id: string;
  buyer_id: string;
  seller_id: string;
  payment_method: string;
  meetup_time_slots: string[];
  meetup_locations: string[];
  final_meetup_time: string | null;
  final_meetup_location: string | null;
  status: string;
};

type UserProfile = {
  avatar_url: string | null;
  nickname: string;
};

const TIME_SLOT_LABELS: Record<string, string> = {
  "12period": "12限終わり休み",
  "lunch": "お昼休み",
  "56period": "56限終わり休み",
  "78period": "78限終わり休み",
  "other": "その他",
};

const LOCATION_LABELS: Record<string, string> = {
  library: "図書館前",
  taki_plaza: "タキプラザ一階",
  seven_eleven: "セブンイレブン前",
  other: "その他（チャットで相談）",
};

export default function ChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, loading: authLoading, avatarUrl } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [item, setItem] = useState<ItemWithTransaction | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherUserProfile, setOtherUserProfile] = useState<UserProfile | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
          filter: `item_id=eq.${params.id}`,
        },
        (payload) => {
          setTransaction(payload.new as Transaction);
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
        .select("*")
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

        if (transactionResult.data) {
          setTransaction(transactionResult.data as Transaction);
        }

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

  const handleSend = async (textOverride?: string, imageUrlOverride?: string) => {
    const messageText = textOverride || newMessage.trim();
    if (!messageText && !imageUrlOverride) return;
    if (!user || !item || !otherUserId || sending) return;

    if (!textOverride) setNewMessage("");
    setSending(true);

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: otherUserId,
      message: messageText,
      image_url: imageUrlOverride,
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
        image_url: imageUrlOverride,
        is_read: false,
      });

      if (error) throw error;

      // 送信成功後、すぐにメッセージを再取得
      setTimeout(() => fetchMessages(), 300);
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      if (!textOverride) setNewMessage(messageText); // 元に戻す
      alert("メッセージの送信に失敗しました: " + err.message);
    } finally {
      setSending(false);
      // 入力欄にフォーカスを戻す
      if (!imageUrlOverride) inputRef.current?.focus();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !item || !otherUserId) return;

    // ファイル形式・サイズチェック（例: 5MB以下）
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('5MB以下の画像を選択してください');
      return;
    }

    setIsUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${item.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      await handleSend("[画像]", publicUrl);

    } catch (err: any) {
      console.error('Image upload failed:', err);
      alert('画像のアップロードに失敗しました: ' + err.message);
    } finally {
      setIsUploadingImage(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleFinalizeSchedule = async (timeSlot: string, location: string) => {
    if (!transaction || isFinalizing) return;
    setIsFinalizing(true);

    try {
      const [datePart, slotPart] = timeSlot.split("_");
      const date = new Date(datePart);
      const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
      const formattedTime = `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]}) ${TIME_SLOT_LABELS[slotPart] || slotPart}`;
      const formattedLocation = LOCATION_LABELS[location] || location;

      const { error } = await (supabase.from("transactions") as any)
        .update({
          final_meetup_time: formattedTime,
          final_meetup_location: formattedLocation,
          status: 'confirmed'
        })
        .eq("id", transaction.id);

      if (error) throw error;

      // 自動メッセージを送信
      await handleSend(`【日程が確定しました】\n\n日時: ${formattedTime}\n場所: ${formattedLocation}\n\n当日はよろしくお願いいたします！`);
      
    } catch (err: any) {
      alert("日程の確定に失敗しました: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleReschedule = async () => {
    if (!transaction || isFinalizing) return;
    setIsFinalizing(true);
    try {
      // 日程調整をリセット
      const { error } = await (supabase.from("transactions") as any)
        .update({
          final_meetup_time: null,
          final_meetup_location: null,
          status: 'pending' // または再調整用のステータス
        })
        .eq("id", transaction.id);

      if (error) throw error;

      await handleSend("この先の受け渡し日程については、こちらのチャットにてご相談ください。\n\n日程が決まりましたら、日程変更・登録を行っていただくことで、予定が自動的にカレンダーへ登録されます");
    } catch (err: any) {
      alert("再調整の処理に失敗しました: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCompleteTransaction = async () => {
    if (!item || !transaction) return;
    setIsFinalizing(true);
    try {
      const { error: txError } = await (supabase.from("transactions") as any)
        .update({ status: 'completed' })
        .eq("id", transaction.id);
      if (txError) throw txError;

      const { error: itemError } = await (supabase.from("items") as any)
        .update({ status: 'sold' })
        .eq("id", item.id);
      if (itemError) throw itemError;

      router.push(`/rating/${transaction.id}`);
    } catch (err: any) {
      alert("取引の完了に失敗しました: " + err.message);
    } finally {
      setIsFinalizing(false);
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

  const isSeller = user?.id === item.seller_id;

  return (
    <div className="h-screen flex flex-col bg-[#B2C7D9] overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-[#B2C7D9]/95 backdrop-blur-md px-4 py-3 flex items-center gap-3 z-50 border-b border-white/20 h-16">
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

      {/* Action Bar (Below Header) */}
      <div className="fixed top-16 left-0 right-0 bg-[#B2C7D9]/95 backdrop-blur-md px-4 py-2 z-40 flex gap-2 border-b border-white/10">
        <button
          onClick={() => setIsScheduleModalOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white font-bold py-2.5 rounded-xl transition-all border border-white/20 text-xs"
        >
          <Calendar className="w-4 h-4" />
          日程調整・変更
        </button>
        <button
          onClick={() => setIsCompletionModalOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-primary/80 hover:bg-primary text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-black/5 text-xs"
        >
          <CheckCircle2 className="w-4 h-4" />
          取引を完了する
        </button>
      </div>

      <div className="flex-1 overflow-hidden pt-[116px] flex flex-col">
        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
        >
        {/* Scheduling Component (Injected at the top like a pinned post) */}
        {transaction && transaction.meetup_time_slots?.length > 0 && !transaction.final_meetup_time && (
           <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
             <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 shadow-xl border border-white/20">
               <div className="flex items-center gap-2 mb-4 text-primary font-black">
                 <Calendar className="w-5 h-5" />
                 <span className="text-sm uppercase tracking-wider">受け渡し日程調整</span>
               </div>
               
               <p className="text-xs text-gray-500 font-bold mb-4 px-1">募集された候補から都合の良い日時を選択してください：</p>
               
               <div className="space-y-2.5">
                 {transaction.meetup_time_slots.map((slot) => {
                   const [datePart, slotPart] = slot.split("_");
                   const date = new Date(datePart);
                   const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
                   const label = `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]}) ${TIME_SLOT_LABELS[slotPart] || slotPart}`;
                   
                   return (
                     <button
                       key={slot}
                       onClick={() => {
                         if (isSeller) {
                           handleFinalizeSchedule(slot, transaction.meetup_locations[0]);
                         }
                       }}
                       disabled={isFinalizing || !isSeller}
                       className={`w-full text-left bg-primary/5 border-2 rounded-2xl p-4 transition-all group flex items-center justify-between active:scale-95 disabled:opacity-50 ${
                         isSeller 
                           ? "hover:bg-primary/10 border-primary/20 hover:border-primary/40 cursor-pointer" 
                           : "border-primary/10 cursor-default"
                       }`}
                     >
                       <span className={`text-primary font-black ${isSeller ? "group-hover:translate-x-1" : ""} transition-transform`}>{label}</span>
                       <Clock className={`w-4 h-4 transition-colors ${isSeller ? "text-primary/40 group-hover:text-primary" : "text-primary/20"}`} />
                     </button>
                   );
                 })}
                 
                 <button
                    onClick={() => {
                      if (isSeller) {
                        handleReschedule();
                      }
                    }}
                    disabled={isFinalizing || !isSeller}
                    className="w-full text-center py-3 text-gray-400 hover:text-gray-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                   <RotateCcw className="w-3.5 h-3.5" />
                   再度日程調整をお願いする
                 </button>
               </div>
             </div>
           </div>
        )}

        {/* Finalized Schedule Banner */}
        {transaction?.final_meetup_time && (
          <div className="mb-6 bg-green-500/10 backdrop-blur-sm border-2 border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-500/20">
               <CheckCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">日程確定済み</p>
              <p className="text-sm font-black text-green-900">{transaction.final_meetup_time}</p>
              <p className="text-[10px] text-green-700/60 font-medium">場所: {transaction.final_meetup_location}</p>
            </div>
          </div>
        )}

        {/* Messages List */}
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
                      {msg.image_url && (
                        <div className="mb-2 -mx-2 -mt-1 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                          <Image
                            src={msg.image_url}
                            alt="添付画像"
                            width={300}
                            height={300}
                            className="w-full h-auto object-cover max-h-[300px] hover:scale-105 transition-transform duration-500 cursor-pointer"
                            onClick={() => window.open(msg.image_url!, '_blank')}
                          />
                        </div>
                      )}
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
    </div>

      {/* Input Area */}
      <div className="flex-shrink-0 bg-white px-4 py-3 border-t border-gray-200 safe-area-bottom">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-3"
        >
          {/* Image Picker */}
          <label className="cursor-pointer p-2 hover:bg-gray-100 rounded-full transition-colors relative">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={isUploadingImage}
            />
            {isUploadingImage ? (
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            ) : (
              <ImageIcon className="w-6 h-6 text-gray-500" />
            )}
          </label>

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
            type="submit"
            disabled={(!newMessage.trim() && !isUploadingImage) || sending}
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              (newMessage.trim() || isUploadingImage) && !sending
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

      {/* Schedule Adjustment Modal */}
      <ScheduleAdjustmentModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onConfirm={async (slots: string[], locations: string[]) => {
          if (!transaction) return;
          setIsFinalizing(true);
          try {
            const { error } = await (supabase.from("transactions") as any)
              .update({
                meetup_time_slots: slots,
                meetup_locations: locations,
                final_meetup_time: null,
                final_meetup_location: null,
                status: 'pending'
              })
              .eq("id", transaction.id);
            if (error) throw error;
            
            // Send notification message
            await handleSend("日程候補が変更されました。ご確認ください。");
          } catch (err: any) {
            alert("日程の変更に失敗しました: " + err.message);
          } finally {
            setIsFinalizing(false);
            setIsScheduleModalOpen(false);
          }
        }}
      />

      {/* Transaction Completion Modal */}
      <CompletionConfirmationModal
        isOpen={isCompletionModalOpen}
        onClose={() => setIsCompletionModalOpen(false)}
        onConfirm={handleCompleteTransaction}
        isSeller={isSeller}
      />

      <style jsx global>{`
        .safe-area-bottom {
          padding-bottom: max(12px, env(safe-area-inset-bottom));
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

// --- Sub-components for Schedule Adjustment ---

const TIME_SLOTS = [
  { id: "12period", label: "12限終わり休み" },
  { id: "lunch", label: "お昼休み" },
  { id: "56period", label: "56限終わり休み" },
  { id: "78period", label: "78限終わり休み" },
  { id: "other", label: "その他" },
];

const LOCATIONS = [
  { id: "library", label: "図書館前" },
  { id: "taki_plaza", label: "タキプラザ一階" },
  { id: "seven_eleven", label: "セブンイレブン前" },
  { id: "other", label: "その他（チャットで相談）" },
];

const getNext7Days = () => {
  const days = [];
  const today = new Date();
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = date.getDay();
    const dayName = dayNames[dayOfWeek];
    days.push({
      id: date.toISOString().split("T")[0],
      label: `${month}/${day}(${dayName})`,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }
  return days;
};

function ScheduleAdjustmentModal({
  isOpen,
  onClose,
  onConfirm
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (slots: string[], locations: string[]) => Promise<void>;
}) {
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [expandedDays, setExpandedDays] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const days = useMemo(() => getNext7Days(), []);

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

  const isValid = selectedTimeSlots.length > 0 && selectedLocations.length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white w-full max-w-lg h-[80vh] overflow-hidden rounded-t-[32px] sm:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b flex items-center justify-between bg-white">
          <div>
            <h2 className="text-xl font-black text-gray-900">日程の変更・登録</h2>
            <p className="text-xs text-gray-500 font-bold mt-1">改めて候補を選択してください</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XIcon className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 custom-scrollbar pb-32">
          {/* 日程選択 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider">受け渡し可能日程</h3>
            </div>
            <div className="space-y-3">
              {days.map((day: any) => {
                const isExpanded = expandedDays.includes(day.id);
                const selectedInDay = selectedTimeSlots.filter(s => s.startsWith(day.id)).length;

                return (
                  <div key={day.id} className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
                    <button
                      onClick={() => toggleDay(day.id)}
                      className={`w-full px-5 py-4 flex items-center justify-between transition-colors ${isExpanded ? "bg-primary/5" : "hover:bg-gray-50"}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`font-black ${day.isWeekend ? "text-red-500" : "text-gray-900"}`}>{day.label}</span>
                        {selectedInDay > 0 && (
                          <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            {selectedInDay}スロット選択中
                          </span>
                        )}
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
                    </button>

                    {isExpanded && (
                      <div className="p-4 bg-gray-50/50 border-t border-gray-100 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                        {TIME_SLOTS.map((slot) => {
                          const isSelected = selectedTimeSlots.includes(`${day.id}_${slot.id}`);
                          return (
                            <button
                              key={slot.id}
                              onClick={() => toggleTimeSlot(day.id, slot.id)}
                              className={`px-3 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border-2 ${
                                isSelected
                                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[0.98]"
                                  : "bg-white text-gray-500 border-gray-100 hover:border-primary/20 hover:text-primary"
                              }`}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 場所選択 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider">受け渡し場所</h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {LOCATIONS.map((location) => {
                const isSelected = selectedLocations.includes(location.id);
                return (
                  <button
                    key={location.id}
                    onClick={() => toggleLocation(location.id)}
                    className={`px-5 py-4 rounded-2xl text-sm font-bold transition-all text-left flex items-center justify-between border-2 ${
                      isSelected
                        ? "bg-primary/5 text-primary border-primary shadow-sm"
                        : "bg-white text-gray-500 border-gray-100 hover:border-primary/20"
                    }`}
                  >
                    {location.label}
                    {isSelected && <Check className="w-5 h-5" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Action Button */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100">
          <button
            onClick={() => {
              setIsSubmitting(true);
              onConfirm(selectedTimeSlots, selectedLocations).finally(() => setIsSubmitting(false));
            }}
            disabled={!isValid || isSubmitting}
            className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
              isValid && !isSubmitting
                ? "bg-primary hover:bg-primary/90 active:scale-[0.98] shadow-primary/30"
                : "bg-gray-300 shadow-none cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                候補を提案する
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Transaction Completion Modal ---
function CompletionConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isSeller
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSeller: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <div className="relative bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-300">
        <div className="p-8">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="text-xl font-black text-gray-900 text-center mb-2">
            取引を完了しますか？
          </h2>
          <p className="text-gray-500 text-sm text-center mb-8 font-medium">
            以下の内容を確認してください
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="w-5 h-5 mt-0.5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={4} />
              </div>
              <p className="text-sm font-bold text-gray-700">
                {isSeller ? "代金を受け取りましたか？" : "商品を受け取りましたか？"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onConfirm}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              はい、取引を終了する
            </button>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-400 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all active:scale-[0.98]"
            >
              いいえ、チャットに戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
