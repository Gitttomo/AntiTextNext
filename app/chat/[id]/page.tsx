"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Send, Loader2, User, Check, CheckCheck, Calendar, MapPin, Clock, RotateCcw, ImageIcon, Plus, X as XIcon, ChevronRight, CheckCircle2, AlertCircle, BookOpen } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { uploadChatImage } from "@/lib/image-storage";

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
  buyer_completed: boolean;
  seller_completed: boolean;
  cancellation_reason: string | null;
  schedule_change_requested_by: string | null;
  previous_final_meetup_time: string | null;
  previous_final_meetup_location: string | null;
};

type UserProfile = {
  avatar_url: string | null;
  nickname: string;
  is_deactivated?: boolean;
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

const formatTimeSlotLabel = (timeSlot: string) => {
  const [datePart, slotPart] = timeSlot.split("_");
  const date = new Date(datePart);
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]}) ${TIME_SLOT_LABELS[slotPart] || slotPart}`;
};

const formatLocationLabel = (location: string) => LOCATION_LABELS[location] || location;

const formatScheduleCandidates = (slots: string[], locations: string[]) => {
  const formattedSlots = slots.map((slot) => `・${formatTimeSlotLabel(slot)}`).join("\n");
  const formattedLocations = locations.map((location) => `・${formatLocationLabel(location)}`).join("\n");

  return `候補日時:\n${formattedSlots}\n\n候補場所:\n${formattedLocations}`;
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
  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
  const [isCancellationReasonModalOpen, setIsCancellationReasonModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showCancellationSection, setShowCancellationSection] = useState(false);
  const [backHref, setBackHref] = useState("/transactions");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scheduleCandidatesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const userScrolledUpRef = useRef(false);
  const previousMessagesLengthRef = useRef(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("from");
    setBackHref(from === "notifications" ? "/notifications" : "/transactions");
  }, []);

  // 未読メッセージを既読にする
  const markMessagesAsRead = useCallback(async () => {
    if (!user || !params.id) return;

    try {
      const { error: messagesError } = await (supabase.from("messages") as any)
        .update({ is_read: true })
        .eq("item_id", params.id)
        .eq("receiver_id", user.id)
        .eq("is_read", false);

      if (messagesError) throw messagesError;

      const { error: notificationsError } = await (supabase.from("notifications") as any)
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("link_type", "chat")
        .eq("link_id", params.id)
        .eq("is_read", false);

      if (notificationsError) {
        console.error("Error marking chat notifications as read:", notificationsError);
      }

      setMessages(current =>
        current.map(message =>
          message.receiver_id === user.id ? { ...message, is_read: true } : message
        )
      );
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
    // 新しいメッセージが追加された場合のみスクロール
    const hasNewMessages = messages.length > previousMessagesLengthRef.current;
    previousMessagesLengthRef.current = messages.length;

    // ユーザーが上にスクロールしていない場合、または新しいメッセージがある場合のみスクロール
    if (hasNewMessages && !userScrolledUpRef.current) {
      scrollToBottom();
    }
  }, [messages]);

  const scrollToBottom = (force?: boolean) => {
    if (force) {
      userScrolledUpRef.current = false;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToScheduleCandidates = useCallback(() => {
    userScrolledUpRef.current = true;
    scheduleCandidatesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  // スクロール位置を監視してユーザーが上にスクロールしたかを追跡
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // 下から100px以内にいる場合はボトムにいると判定
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    userScrolledUpRef.current = !isNearBottom;
  }, []);

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
            .select("avatar_url, nickname, is_deactivated")
            .eq("user_id", other)
            .single();

          if (profileData) {
            const profile = profileData as UserProfile;
            if (profile.is_deactivated) {
              setOtherUserProfile({
                avatar_url: null,
                nickname: "退会済みユーザー",
                is_deactivated: true,
              });
            } else {
              setOtherUserProfile(profile);
            }
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
    if (!file || !user || !item || !otherUserId || isUploadingImage || sending) return;

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
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const publicUrl = await uploadChatImage(file, `${item.id}/${fileName}`);

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
    if (!transaction || isFinalizing || !canConfirmSchedule) return;
    setIsFinalizing(true);

    try {
      const formattedTime = formatTimeSlotLabel(timeSlot);
      const formattedLocation = formatLocationLabel(location);
      const isChangeApproval = !!transaction.schedule_change_requested_by;

      const { error } = await (supabase.from("transactions") as any)
        .update({
          final_meetup_time: formattedTime,
          final_meetup_location: formattedLocation,
          status: 'confirmed',
          schedule_change_requested_by: null,
        })
        .eq("id", transaction.id);

      if (error) throw error;

      // ローカル状態を即座に更新（即時UI反映のため）
      setTransaction(prev => prev ? {
        ...prev,
        final_meetup_time: formattedTime,
        final_meetup_location: formattedLocation,
        status: 'confirmed',
        schedule_change_requested_by: null,
        previous_final_meetup_time: null,
        previous_final_meetup_location: null,
      } : prev);

      // 自動メッセージを送信
      await handleSend(`${isChangeApproval ? "【日程変更が承認されました】" : "【受け渡し日時が決まりました】"}\n\n日時: ${formattedTime}\n場所: ${formattedLocation}\n\n当日はよろしくお願いいたします！`);

    } catch (err: any) {
      alert("日程の確定に失敗しました: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleReschedule = async () => {
    if (!transaction || isFinalizing) return;
    if (user?.id !== transaction.buyer_id && user?.id !== transaction.seller_id) return;
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

      // ローカル状態を即座に更新（即時UI反映のため）
      setTransaction(prev => prev ? {
        ...prev,
        final_meetup_time: null,
        final_meetup_location: null,
        status: 'pending'
      } : prev);

      await handleSend("この先の受け渡し日程については、こちらのチャットにてご相談ください。\n\n日程が決まりましたら、日程変更・登録を行っていただくことで、予定が自動的にカレンダーへ登録されます");
    } catch (err: any) {
      alert("再調整の処理に失敗しました: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCompleteTransaction = async () => {
    if (isFinalizing || !item || !transaction || !user) return;
    if (user.id !== transaction.buyer_id && user.id !== transaction.seller_id) return;
    setIsFinalizing(true);
    try {
      const isBuyer = user.id === transaction.buyer_id;
      const updateField = isBuyer ? 'buyer_completed' : 'seller_completed';
      const otherField = isBuyer ? 'seller_completed' : 'buyer_completed';

      // Update current user's completion status
      const { data: updatedTx, error: txError } = await (supabase.from("transactions") as any)
        .update({ [updateField]: true })
        .eq("id", transaction.id)
        .select()
        .single();

      if (txError) throw txError;

      // Check if both parties have completed
      const bothCompleted = updatedTx[otherField] === true;

      if (bothCompleted) {
        // Both completed - mark transaction as awaiting_rating (will be completed after both rate)
        const { error: statusError } = await (supabase.from("transactions") as any)
          .update({ status: 'awaiting_rating' })
          .eq("id", transaction.id);
        if (statusError) throw statusError;
      } else {
        // Only current user completed - mark as awaiting_rating
        const { error: statusError } = await (supabase.from("transactions") as any)
          .update({ status: 'awaiting_rating' })
          .eq("id", transaction.id);
        if (statusError) throw statusError;
      }

      // Always redirect to rating page
      router.push(`/rating/${transaction.id}`);
    } catch (err: any) {
      alert("取引の完了に失敗しました: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCancelTransaction = async (reason: string) => {
    if (isFinalizing || !item || !transaction || !user) return;
    if (user.id !== transaction.buyer_id && user.id !== transaction.seller_id) return;
    setIsFinalizing(true);
    try {
      // Update transaction status to cancelled with reason
      const { error: txError } = await (supabase.from("transactions") as any)
        .update({
          status: 'cancelled',
          cancellation_reason: reason
        })
        .eq("id", transaction.id);
      if (txError) throw txError;

      // Reset item status to available
      const { error: itemError } = await (supabase.from("items") as any)
        .update({ status: 'available' })
        .eq("id", item.id);
      if (itemError) throw itemError;

      // Send notification message to other user
      await handleSend(`【取引がキャンセルされました】\n\n理由: ${reason}`);

      // Redirect to home
      router.push('/');
    } catch (err: any) {
      alert("取引のキャンセルに失敗しました: " + err.message);
    } finally {
      setIsFinalizing(false);
      setIsCancellationReasonModalOpen(false);
      setIsCancellationModalOpen(false);
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
      <div className="h-screen bg-gray-100 flex items-center justify-center">
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
    awaiting_rating: "評価待ち",
    sold: "取引完了",
  }[item.status] || item.status;

  const isSeller = user?.id === item.seller_id;
  const isScheduleChangeRequester = !!transaction?.schedule_change_requested_by && transaction.schedule_change_requested_by === user?.id;
  const canConfirmSchedule = !!transaction && (
    transaction.schedule_change_requested_by
      ? transaction.schedule_change_requested_by !== user?.id
      : isSeller
  );

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.x > 56) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (deltaX > 90 && Math.abs(deltaY) < 70) {
      router.push(backHref);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-white overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center gap-3 z-50 border-b border-gray-100 h-16">
        <Link href={backHref} className="p-1">
          <ArrowLeft className="w-6 h-6 text-black" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-black font-bold truncate">
            {item.title}
          </h1>
          <p className="text-gray-500 text-xs">
            {otherUserProfile?.is_deactivated ? "相手は退会済みです" : statusLabel}
          </p>
        </div>
      </header>

      {/* Action Bar (Below Header) */}
      <div className="fixed top-16 left-0 right-0 bg-white/95 backdrop-blur-md px-4 py-2 z-40 flex gap-2 border-b border-gray-100">
        <button
          onClick={() => setIsScheduleModalOpen(true)}
          disabled={transaction?.status === 'awaiting_rating' || transaction?.status === 'completed'}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl transition-all border border-slate-600 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Calendar className="w-4 h-4" />
          日程調整・変更
        </button>
        <button
          onClick={() => setIsCompletionModalOpen(true)}
          disabled={
            transaction?.status === 'completed' ||
            (user?.id === transaction?.buyer_id && transaction?.buyer_completed) ||
            (user?.id === transaction?.seller_id && transaction?.seller_completed)
          }
          className="flex-1 flex items-center justify-center gap-2 bg-primary/80 hover:bg-primary text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-black/5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle2 className="w-4 h-4" />
          取引を完了する
        </button>
      </div>

      <div className="flex-1 overflow-hidden pt-[116px] flex flex-col">
        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
        >
          {/* Sticky Schedule Summary */}
          {transaction && (
            <div className="sticky top-0 z-30 -mx-4 mb-4 bg-white/95 px-4 pb-3 pt-2 backdrop-blur-md">
              {transaction.final_meetup_time ? (
                <div className="bg-green-500/10 backdrop-blur-sm border-2 border-green-500/20 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-500/20">
                    <CheckCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">受け渡し日時</p>
                    <p className="text-sm font-black text-green-900">{transaction.final_meetup_time}</p>
                    <p className="text-[10px] text-green-700/60 font-medium">場所: {transaction.final_meetup_location}</p>
                  </div>
                </div>
              ) : transaction.schedule_change_requested_by ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={scrollToScheduleCandidates}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      scrollToScheduleCandidates();
                    }
                  }}
                  className="cursor-pointer bg-amber-50 backdrop-blur-sm border-2 border-amber-200 rounded-2xl p-4 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-100/70 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-400/20">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">変更提案中</p>
                      <p className="text-sm font-black text-amber-950">
                        {isScheduleChangeRequester ? "相手の承認待ちです" : "候補から行ける日時を選んで承認してください"}
                      </p>
                    </div>
                  </div>
                  {transaction.previous_final_meetup_time && (
                    <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs text-amber-900">
                      変更前: {transaction.previous_final_meetup_time}
                      {transaction.previous_final_meetup_location ? ` / ${transaction.previous_final_meetup_location}` : ""}
                    </div>
                  )}
                </div>
              ) : transaction.meetup_time_slots && transaction.meetup_time_slots.length > 0 ? (
                <div className="bg-gray-100/80 backdrop-blur-sm border-2 border-gray-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 bg-gray-400 rounded-xl flex items-center justify-center text-white shadow-lg shadow-gray-400/20">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">受け渡し日時</p>
                    <p className="text-sm font-bold text-gray-700">候補から日程を決定してください。</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Scheduling Component (Injected at the top like a pinned post) */}
          {transaction && transaction.meetup_time_slots?.length > 0 && !transaction.final_meetup_time && (
            <div ref={scheduleCandidatesRef} className="scroll-mt-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 shadow-xl border border-white/20">
                <div className="flex items-center gap-2 mb-4 text-primary font-black">
                  <Calendar className="w-5 h-5" />
                  <span className="text-sm uppercase tracking-wider">
                    {transaction.schedule_change_requested_by ? "変更候補の確認" : "受け渡し日程調整"}
                  </span>
                </div>

                <p className="text-xs text-gray-500 font-bold mb-4 px-1">
                  {transaction.schedule_change_requested_by
                    ? isScheduleChangeRequester
                      ? "相手が承認するまでお待ちください。候補は以下の内容で提案されています。"
                      : "提案された候補から行けそうな日時を選ぶと、変更が承認されます。"
                    : "募集された候補から都合の良い日時を選択してください："}
                </p>

                <div className="space-y-2.5">
                  {transaction.meetup_time_slots.map((slot) => {
                    const label = formatTimeSlotLabel(slot);

                    return (
                      <button
                        key={slot}
                        onClick={() => {
                          if (canConfirmSchedule && !transaction.final_meetup_time) {
                            handleFinalizeSchedule(slot, transaction.meetup_locations[0]);
                          }
                        }}
                        disabled={isFinalizing || !canConfirmSchedule || !!transaction.final_meetup_time}
                        className={`w-full text-left bg-primary/5 border-2 rounded-2xl p-4 transition-all group flex items-center justify-between active:scale-95 disabled:opacity-50 ${canConfirmSchedule && !transaction.final_meetup_time
                          ? "hover:bg-primary/10 border-primary/20 hover:border-primary/40 cursor-pointer"
                          : "border-primary/10 cursor-default"
                          }`}
                      >
                        <span className={`text-primary font-black ${canConfirmSchedule && !transaction.final_meetup_time ? "group-hover:translate-x-1" : ""} transition-transform`}>{label}</span>
                        <Clock className={`w-4 h-4 transition-colors ${canConfirmSchedule && !transaction.final_meetup_time ? "text-primary/40 group-hover:text-primary" : "text-primary/20"}`} />
                      </button>
                    );
                  })}

                  <button
                    onClick={() => {
                      if (isSeller && !transaction.final_meetup_time) {
                        handleReschedule();
                      }
                    }}
                    disabled={isFinalizing || !isSeller || !!transaction.final_meetup_time}
                    className="w-full text-center py-3 text-gray-400 hover:text-gray-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    再度日程調整をお願いする
                  </button>
                </div>
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
                        className={`w-fit min-w-[50px] px-4 py-2.5 rounded-2xl shadow-sm border ${isOwnMessage
                          ? "rounded-br-sm bg-sky-50 border-sky-200"
                          : "rounded-bl-sm bg-sky-100 border-sky-300"
                          }`}
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
                        <p className="whitespace-pre-wrap break-all text-[15px] leading-relaxed text-slate-800 font-medium">
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

      {/* Cancellation Section */}
      {transaction && transaction.status !== 'completed' && transaction.status !== 'cancelled' &&
        !((user?.id === transaction.buyer_id && transaction.buyer_completed) || (user?.id === transaction.seller_id && transaction.seller_completed)) && (
          <div className="flex-shrink-0 bg-white border-t border-gray-100">
            <div className="px-4 py-2">
              <button
                onClick={() => setShowCancellationSection(!showCancellationSection)}
                className="w-full text-center py-2 text-gray-500 hover:text-gray-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                取引キャンセルを行う場合
                <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${showCancellationSection ? "rotate-90" : "-rotate-90"}`} />
              </button>

              {showCancellationSection && (
                <div className="mt-2 pb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4">
                    <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                      取引をキャンセルする場合は、取引相手への配慮が必要です。キャンセル理由を記入してお送りください。
                    </p>
                    <button
                      onClick={() => setIsCancellationModalOpen(true)}
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <XIcon className="w-4 h-4" />
                      取引をキャンセルする
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex-shrink-0 bg-white px-4 py-2.5 border-t border-gray-200">
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
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${(newMessage.trim() || isUploadingImage) && !sending
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
      </div>

      {/* Schedule Adjustment Modal */}
      <ScheduleAdjustmentModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onConfirm={async (slots: string[], locations: string[]) => {
          if (!transaction || !user) return;
          setIsFinalizing(true);
          const previousTime = transaction.final_meetup_time;
          const previousLocation = transaction.final_meetup_location;
          try {
            const { error } = await (supabase.from("transactions") as any)
              .update({
                meetup_time_slots: slots,
                meetup_locations: locations,
                final_meetup_time: null,
                final_meetup_location: null,
                status: 'pending',
                schedule_change_requested_by: user.id,
                previous_final_meetup_time: previousTime,
              })
              .eq("id", transaction.id);
            if (error) throw error;

            setTransaction(prev => prev ? {
              ...prev,
              meetup_time_slots: slots,
              meetup_locations: locations,
              final_meetup_time: null,
              final_meetup_location: null,
              status: 'pending',
              schedule_change_requested_by: user.id,
              previous_final_meetup_time: previousTime,
              previous_final_meetup_location: previousLocation,
            } : prev);

            // Send notification message
            const previousSchedule = previousTime
              ? `変更前:\n・日時: ${previousTime}\n・場所: ${previousLocation || "未設定"}`
              : "変更前:\n・まだ受け渡し日時は決まっていません";
            await handleSend(`【受け渡し日時の変更提案】\n\n${previousSchedule}\n\n変更後の候補:\n${formatScheduleCandidates(slots, locations)}\n\nこの候補で問題ないか、相手の方はチャット上部の候補から行けそうな日時を選んで承認してください。`);
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

      {/* Transaction Cancellation Confirmation Modal */}
      <CancellationConfirmationModal
        isOpen={isCancellationModalOpen}
        onClose={() => setIsCancellationModalOpen(false)}
        onConfirm={() => {
          setIsCancellationModalOpen(false);
          setIsCancellationReasonModalOpen(true);
        }}
      />

      {/* Cancellation Reason Input Modal */}
      <CancellationReasonModal
        isOpen={isCancellationReasonModalOpen}
        onClose={() => setIsCancellationReasonModalOpen(false)}
        onConfirm={handleCancelTransaction}
        isSubmitting={isFinalizing}
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
                              className={`px-3 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border-2 ${isSelected
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
                    className={`px-5 py-4 rounded-2xl text-sm font-bold transition-all text-left flex items-center justify-between border-2 ${isSelected
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
              if (isSubmitting) return;
              setIsSubmitting(true);
              onConfirm(selectedTimeSlots, selectedLocations).finally(() => setIsSubmitting(false));
            }}
            disabled={!isValid || isSubmitting}
            className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-2 ${isValid && !isSubmitting
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
  const [confirmed, setConfirmed] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) setConfirmed(false);
  }, [isOpen]);

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
            <BookOpen className="w-8 h-8 text-primary" />
          </div>

          <h2 className="text-xl font-black text-gray-900 text-center mb-2">
            受け渡し確認
          </h2>
          <p className="text-gray-500 text-sm text-center mb-6 font-medium">
            商品の受け渡しは完了しましたか？
          </p>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="w-5 h-5 mt-0.5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={4} />
              </div>
              <p className="text-sm font-bold text-gray-700">
                {isSeller ? "代金を受け取りましたか？" : "商品を受け取りましたか？"}
              </p>
            </div>
            <div className="flex items-start gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="w-5 h-5 mt-0.5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={4} />
              </div>
              <p className="text-sm font-bold text-gray-700">
                {isSeller ? "商品を渡しましたか？" : "代金を支払いましたか？"}
              </p>
            </div>
          </div>

          {/* 警告 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 mb-6">
            <p className="text-xs font-bold text-yellow-700 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              この操作は取り消せません。受け渡しが完了してから押してください。
            </p>
          </div>

          {/* 確認チェックボックス */}
          <button
            onClick={() => setConfirmed(!confirmed)}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all mb-6 ${
              confirmed
                ? "border-primary bg-primary/5"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
              confirmed ? "bg-primary border-primary" : "bg-white border-gray-300"
            }`}>
              {confirmed && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
            </div>
            <span className={`text-sm font-bold ${confirmed ? "text-primary" : "text-gray-500"}`}>
              受け渡しが完了したことを確認しました
            </span>
          </button>

          <div className="space-y-3">
            <button
              onClick={onConfirm}
              disabled={!confirmed}
              className={`w-full py-4 rounded-2xl font-black shadow-lg transition-all active:scale-[0.98] ${
                confirmed
                  ? "bg-primary text-white shadow-primary/20 hover:bg-primary/90"
                  : "bg-gray-100 text-gray-400 shadow-none cursor-not-allowed"
              }`}
            >
              取引を完了して評価へ
            </button>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-400 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all active:scale-[0.98]"
            >
              チャットに戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Transaction Cancellation Confirmation Modal ---
function CancellationConfirmationModal({
  isOpen,
  onClose,
  onConfirm
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>

          <h2 className="text-xl font-black text-gray-900 text-center mb-2">
            取引をキャンセルしますか?
          </h2>
          <p className="text-gray-500 text-sm text-center mb-8 font-medium">
            以下の内容を確認してください
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 bg-red-50 p-4 rounded-2xl border border-red-100">
              <div className="w-5 h-5 mt-0.5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <XIcon className="w-3 h-3 text-white" strokeWidth={4} />
              </div>
              <p className="text-sm font-bold text-gray-700">
                取引をキャンセルすると、取引相手へ通知が送信され、この取引は終了します。
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onConfirm}
              className="w-full bg-red-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-[0.98]"
            >
              取引をキャンセルして申請する
            </button>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-400 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all active:scale-[0.98]"
            >
              チャットに戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Cancellation Reason Modal ---
function CancellationReasonModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isSubmitting: boolean;
}) {
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!reason.trim()) {
      alert("キャンセル理由を入力してください");
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-in fade-in duration-300">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-300">
        <div className="p-8">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>

          <h2 className="text-xl font-black text-gray-900 text-center mb-2">
            キャンセル理由を入力
          </h2>
          <p className="text-gray-500 text-sm text-center mb-6 font-medium">
            取引相手への配慮のため、キャンセル理由を記入してください
          </p>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ここに入力"
            disabled={isSubmitting}
            className="w-full h-40 px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-red-500 focus:bg-white transition-all resize-none text-gray-700 placeholder:text-gray-400 font-medium mb-6"
            maxLength={500}
          />

          <div className="space-y-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !reason.trim()}
              className="w-full bg-red-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "送信する"
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full bg-gray-100 text-gray-400 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
