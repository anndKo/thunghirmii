// @ts-nocheck
import { useState, useEffect, useRef, useCallback, memo, useMemo, TouchEvent as ReactTouchEvent } from 'react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMessages, Conversation, Message } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PaymentBoxDialog } from '@/components/PaymentBoxDialog';
import { PaymentCard } from '@/components/PaymentCard';
import { DepositBoxDialog } from '@/components/DepositBoxDialog';
import { DepositCard } from '@/components/DepositCard';
import { MediaPreviewDialog } from '@/components/MediaPreviewDialog';
import { AutoMessageDialog } from '@/components/AutoMessageDialog';
import { RoomInfoSendDialog } from '@/components/RoomInfoSendDialog';
import {
  MessageCircle,
  X,
  Search,
  Send,
  ArrowLeft,
  ArrowDown,
  User,
  Loader2,
  ImagePlus,
  CreditCard,
  Landmark,
  Eye,
  MoreVertical,
  Reply,
  Pencil,
  Undo2,
  Check,
  ShieldCheck,
  Trash2,
  MessageSquareText,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { validateImageFile, sanitizeImage, containsLink, isSystemMessage } from '@/lib/chat-security';

interface PaymentRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  due_day: number;
  amount: number | null;
  note: string | null;
  status: string;
  receipt_url: string | null;
  qr_url?: string | null;
}

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUserId?: string;
  initialMessage?: string;
}

/* Lazy image with skeleton + fade-in */
const ChatImage = memo(function ChatImage({ src, alt = '', className = '', onClick }: { src: string; alt?: string; className?: string; onClick?: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button onClick={onClick} className={cn("block cursor-pointer overflow-hidden rounded-lg relative bg-muted", className)}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-muted rounded-lg" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn("w-full h-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
      />
    </button>
  );
});

const isImageUrl = (text: string) => {
  const t = text.trim();
  return /^https?:\/\/.+/i.test(t) && /\.(png|jpe?g|jfif|gif|webp|bmp|svg|tiff?)(\?.*)?$/i.test(t);
};

const parseMessageContent = (content: string): Array<{ type: 'text' | 'image'; value: string }> => {
  const lines = content.split('\n');
  const parts: Array<{ type: 'text' | 'image'; value: string }> = [];
  let textBuffer: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (isImageUrl(trimmed)) {
      if (textBuffer.length > 0) {
        parts.push({ type: 'text', value: textBuffer.join('\n') });
        textBuffer = [];
      }
      parts.push({ type: 'image', value: trimmed });
    } else {
      textBuffer.push(line);
    }
  }
  if (textBuffer.length > 0) {
    parts.push({ type: 'text', value: textBuffer.join('\n') });
  }

  return parts;
};

const getChatThumbUrl = (url: string, size = 120) => url;

/* Role badge inline - memoized */
const RoleBadgeInline = memo(function RoleBadgeInline({ role }: { role: string }) {
  if (role === 'admin') {
    return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"><ShieldCheck className="h-3 w-3" />Admin</span>;
  }
  if (role === 'landlord') {
    return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">Chủ trọ</span>;
  }
  if (role === 'tenant') {
    return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Người thuê</span>;
  }
  return null;
});

const SenderLabel = memo(function SenderLabel({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-[11px] font-semibold text-foreground">{name}</span>
      <RoleBadgeInline role={role} />
    </div>
  );
});

const MessageMenu = memo(function MessageMenu({ mine, onReply, onEdit, onRecall }: {
  mine: boolean;
  onReply: () => void;
  onEdit?: () => void;
  onRecall?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className="h-7 w-7 flex items-center justify-center rounded-full transition-colors duration-400 shrink-0 opacity-50 hover:opacity-100 hover:bg-muted"
          onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev); }}
          onPointerDown={(e) => e.preventDefault()}
        >
          <MoreVertical className="h-4 w-4 text-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={mine ? "left" : "right"} align="center" className="z-[100] min-w-[140px] bg-popover border shadow-lg rounded-lg">
        <DropdownMenuItem onClick={() => { setOpen(false); onReply(); }} className="gap-2 text-sm cursor-pointer">
          <Reply className="h-3.5 w-3.5" />Trả lời
        </DropdownMenuItem>
        {mine && onEdit && (
          <DropdownMenuItem onClick={() => { setOpen(false); onEdit(); }} className="gap-2 text-sm cursor-pointer">
            <Pencil className="h-3.5 w-3.5" />Chỉnh sửa
          </DropdownMenuItem>
        )}
        {mine && onRecall && (
          <DropdownMenuItem onClick={() => { setOpen(false); onRecall(); }} className="gap-2 text-sm cursor-pointer text-destructive">
            <Undo2 className="h-3.5 w-3.5" />Thu hồi
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

const ConversationItem = memo(function ConversationItem({ conv, info, onClick }: {
  conv: Conversation;
  info?: { avatar_url: string | null; role: string };
  onClick: () => void;
}) {
  const convRole = info?.role || 'tenant';
  return (
    <button className="w-full p-3 flex items-center gap-3 hover:bg-muted rounded-lg transition-colors" onClick={onClick}>
      <div className="relative">
        <Avatar className={cn("h-12 w-12 ring-2", convRole === 'admin' ? 'ring-blue-500' : convRole === 'landlord' ? 'ring-orange-500' : 'ring-border')}>
          {info?.avatar_url ? <AvatarImage src={info.avatar_url} /> : null}
          <AvatarFallback><User className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
        </Avatar>
        {conv.unread_count > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold">{conv.unread_count}</span>
        )}
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold truncate text-sm">{conv.full_name}</p>
          <RoleBadgeInline role={convRole} />
        </div>
        <p className={cn("text-xs truncate mt-0.5", conv.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>{conv.last_message}</p>
      </div>
      <span className="text-[10px] text-muted-foreground">{new Date(conv.last_message_time).toLocaleDateString('vi-VN')}</span>
    </button>
  );
});

export function ChatPanel({ open, onOpenChange, initialUserId, initialMessage }: ChatPanelProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const {
    conversations,
    messages,
    selectedUserId,
    setSelectedUserId,
    loading,
    fetchMessages,
    fetchOlderMessages,
    hasMoreMessages,
    loadingMore,
    sendMessage,
    searchUsers,
    clearMessages,
    fetchConversations,
  } = useMessages();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ user_id: string; full_name: string; display_id: string }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedUserInfo, setSelectedUserInfo] = useState<{ full_name: string; display_id: string } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedConversations = useRef(false);

  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');
  const [recallConfirm, setRecallConfirm] = useState<Message | null>(null);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const isAdmin = role === 'admin';

  const [autoMessageDialogOpen, setAutoMessageDialogOpen] = useState(false);
  const [roomInfoDialogOpen, setRoomInfoDialogOpen] = useState(false);

  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([]);
  const [fullscreenImages, setFullscreenImages] = useState<string[]>([]);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const [userInfoCache, setUserInfoCache] = useState<Record<string, { avatar_url: string | null; role: string; full_name: string }>>({});
  const userInfoCacheRef = useRef(userInfoCache);
  userInfoCacheRef.current = userInfoCache;
  const [profileDialog, setProfileDialog] = useState<{ name: string; role: string } | null>(null);

  // Track if user is near bottom for auto-scroll behavior
  const isNearBottomRef = useRef(true);
  // Track if we just loaded older messages to preserve scroll position
  const loadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  const fetchUserInfo = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;
    const idsToFetch = userIds.filter(id => !userInfoCacheRef.current[id]);
    if (idsToFetch.length === 0) return;

    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('user_id, avatar_url, full_name').in('user_id', idsToFetch) as any,
      supabase.from('user_roles').select('user_id, role').in('user_id', idsToFetch),
    ]);

    const newCache: Record<string, { avatar_url: string | null; role: string; full_name: string }> = {};
    idsToFetch.forEach(id => {
      const profile = (profilesRes.data || []).find(p => p.user_id === id);
      const roleData = (rolesRes.data || []).find(r => r.user_id === id);
      newCache[id] = {
        avatar_url: profile?.avatar_url || null,
        role: roleData?.role || 'tenant',
        full_name: profile?.full_name || 'Người dùng',
      };
    });
    setUserInfoCache(prev => ({ ...prev, ...newCache }));
  }, []);

  useEffect(() => {
    if (open && !hasLoadedConversations.current) {
      hasLoadedConversations.current = true;
      fetchConversations();
    }
  }, [open, fetchConversations]);

  useEffect(() => {
    if (user) fetchUserInfo([user.id]);
  }, [user, fetchUserInfo]);

  useEffect(() => {
    const ids = conversations.map(c => c.user_id);
    if (ids.length > 0) fetchUserInfo(ids);
  }, [conversations, fetchUserInfo]);

  useEffect(() => {
    if (selectedUserId) fetchUserInfo([selectedUserId]);
  }, [selectedUserId, fetchUserInfo]);

  useEffect(() => {
    if (messages.length > 0) {
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      fetchUserInfo(senderIds);
    }
  }, [messages, fetchUserInfo]);

  const fetchPayments = useCallback(async () => {
    if (!user || !selectedUserId) return;
    const { data } = await supabase
      .from('payment_requests')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    setPayments((data as PaymentRequest[]) || []);
  }, [user, selectedUserId]);

  useEffect(() => {
    if (open && selectedUserId) fetchPayments();
  }, [open, selectedUserId, fetchPayments]);

  useEffect(() => {
    const initializeChat = async () => {
      if (open && initialUserId && !isInitializing) {
        setIsInitializing(true);
        setSelectedUserId(initialUserId);
        await fetchMessages(initialUserId);
        const conv = conversations.find(c => c.user_id === initialUserId);
        if (conv) {
          setSelectedUserInfo({ full_name: conv.full_name, display_id: conv.display_id });
        } else {
          const [{ data: profile }, { data: settings }] = await Promise.all([
            supabase.from('profiles').select('full_name').eq('user_id', initialUserId).single(),
            supabase.from('user_settings').select('display_id').eq('user_id', initialUserId).single(),
          ]);
          setSelectedUserInfo({
            full_name: profile?.full_name || 'Admin',
            display_id: settings?.display_id || 'N/A',
          });
        }
        if (initialMessage) setNewMessage(initialMessage);
        setIsInitializing(false);
        setTimeout(() => scrollToBottom(true), 300);
      }
    };
    initializeChat();
  }, [open, initialUserId]);

  useEffect(() => {
    if (!open) {
      if (!initialUserId) {
        setSelectedUserId(null);
        setSelectedUserInfo(null);
        clearMessages();
      }
      setSearchQuery('');
      setSearchResults([]);
      setReplyToMessage(null);
      setEditingMessage(null);
      setPendingImages([]);
    }
  }, [open, initialUserId]);

  useEffect(() => {
    if (open && !user) {
      onOpenChange(false);
    }
  }, [user, open, onOpenChange]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((instant = false) => {
    const container = messagesContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      });
    }
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }, instant ? 50 : 100);
  }, []);

  // Auto-scroll: when new message arrives, scroll to bottom only if user is near bottom
  const prevMsgCountRef = useRef(0);
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const isNewConversation = selectedUserId !== prevSelectedRef.current;
    const hasNewMessages = messages.length > prevMsgCountRef.current;

    if (isNewConversation) {
      // Opening a new conversation - always scroll to bottom
      scrollToBottom(true);
    } else if (hasNewMessages && !loadingOlderRef.current) {
      // New message arrived - only auto-scroll if user is near bottom
      if (isNearBottomRef.current) {
        scrollToBottom(false);
      }
    }

    // After loading older messages, restore scroll position
    if (loadingOlderRef.current) {
      const container = messagesContainerRef.current;
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
        container.scrollTop = scrollDiff;
      }
      loadingOlderRef.current = false;
    }

    prevMsgCountRef.current = messages.length;
    prevSelectedRef.current = selectedUserId;
  }, [messages.length, selectedUserId, scrollToBottom]);

  // Detect scroll position - show/hide scroll button & infinite scroll up
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollDown(distanceFromBottom > 150);
      isNearBottomRef.current = distanceFromBottom < 100;

      // Infinite scroll up - load older messages when near top
      if (container.scrollTop < 50 && hasMoreMessages && !loadingMore && selectedUserId) {
        loadingOlderRef.current = true;
        prevScrollHeightRef.current = container.scrollHeight;
        fetchOlderMessages(selectedUserId);
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [selectedUserId, hasMoreMessages, loadingMore, fetchOlderMessages]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim()) {
        const results = await searchUsers(searchQuery);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleSelectConversation = useCallback(async (conv: Conversation) => {
    setSelectedUserId(conv.user_id);
    setSelectedUserInfo({ full_name: conv.full_name, display_id: conv.display_id });
    await fetchMessages(conv.user_id);
    setSearchQuery('');
    setSearchResults([]);
    setTimeout(() => scrollToBottom(true), 100);
  }, [setSelectedUserId, fetchMessages]);

  const handleSelectSearchResult = useCallback(async (result: { user_id: string; full_name: string; display_id: string }) => {
    setSelectedUserId(result.user_id);
    setSelectedUserInfo({ full_name: result.full_name, display_id: result.display_id });
    await fetchMessages(result.user_id);
    setSearchQuery('');
    setSearchResults([]);
    setTimeout(() => scrollToBottom(true), 100);
  }, [setSelectedUserId, fetchMessages]);

  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});

  const handleSendMessage = useCallback(async () => {
    if (!selectedUserId) return;

    if (newMessage.trim() && !isSystemMessage(newMessage.trim()) && containsLink(newMessage.trim())) {
      toast({ title: 'Không được phép gửi liên kết trong tin nhắn.', variant: 'destructive' });
      return;
    }

    if (pendingImages.length > 0) {
      setSending(true);
      setUploadProgress({});

      const uploadPromises = pendingImages.map((img, idx) => {
        return new Promise<void>(async (resolve) => {
          const sanitized = await sanitizeImage(img.file, 1600, 0.82);
          const ext = sanitized.name.split('.').pop() || 'jpg';
          const filePath = `chat/${user!.id}/${crypto.randomUUID()}.${ext}`;

          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(prev => ({ ...prev, [idx]: percent }));
            }
          };

          xhr.onload = async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const { data } = supabase.storage.from('room-media').getPublicUrl(filePath);
              await sendMessage(selectedUserId, data.publicUrl);
            }
            resolve();
          };

          xhr.onerror = () => resolve();

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          
          supabase.auth.getSession().then(({ data: session }) => {
            const token = session?.session?.access_token || supabaseKey;
            xhr.open('POST', `${supabaseUrl}/storage/v1/object/room-media/${filePath}`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.setRequestHeader('apikey', supabaseKey);
            xhr.setRequestHeader('Content-Type', sanitized.type);
            xhr.send(sanitized);
          });
        });
      });

      await Promise.all(uploadPromises);
      pendingImages.forEach(img => URL.revokeObjectURL(img.preview));
      setPendingImages([]);
      setUploadProgress({});
    }

    if (newMessage.trim()) {
      await sendMessage(selectedUserId, newMessage.trim(), undefined, replyToMessage?.id);
      setNewMessage('');
      setReplyToMessage(null);
    }
    setSending(false);
    // After sending, scroll to bottom
    setTimeout(() => scrollToBottom(false), 150);
  }, [selectedUserId, pendingImages, newMessage, replyToMessage, user, sendMessage, toast, scrollToBottom]);

  const handlePickImage = useCallback(() => {
    if (!selectedUserId) return;
    imageInputRef.current?.click();
  }, [selectedUserId]);

  const handleImageSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedUserId || !user) {
      if (e.target) e.target.value = '';
      return;
    }

    const validFiles: { file: File; preview: string }[] = [];
    for (const file of Array.from(files)) {
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        toast({ title: validation.error || 'Ảnh không hợp lệ hoặc không an toàn.', variant: 'destructive' });
        continue;
      }
      validFiles.push({ file, preview: URL.createObjectURL(file) });
    }

    if (validFiles.length > 0) {
      setPendingImages(prev => [...prev, ...validFiles]);
    }
    if (e.target) e.target.value = '';
  }, [selectedUserId, user, toast]);

  const removePendingImage = useCallback((index: number) => {
    setPendingImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const handleBack = useCallback(() => {
    setSelectedUserId(null);
    setSelectedUserInfo(null);
    clearMessages();
    setReplyToMessage(null);
    setEditingMessage(null);
    setPendingImages([]);
  }, [setSelectedUserId, clearMessages]);

  const handleEditMessage = useCallback(async () => {
    if (!editingMessage || !editContent.trim()) return;
    const { error } = await supabase
      .from('messages')
      .update({ content: editContent.trim(), is_edited: true, edited_at: new Date().toISOString() } as any)
      .eq('id', editingMessage.id);
    if (!error) {
      if (selectedUserId) await fetchMessages(selectedUserId);
      toast({ title: 'Đã chỉnh sửa tin nhắn' });
    } else {
      toast({ title: 'Lỗi', description: 'Không thể chỉnh sửa tin nhắn', variant: 'destructive' });
    }
    setEditingMessage(null);
    setEditContent('');
  }, [editingMessage, editContent, selectedUserId, fetchMessages, toast]);

  const handleRecallMessage = useCallback(async () => {
    if (!recallConfirm) return;
    const { error } = await supabase
      .from('messages')
      .update({ is_recalled: true } as any)
      .eq('id', recallConfirm.id);
    if (!error) {
      if (selectedUserId) await fetchMessages(selectedUserId);
      toast({ title: t('chatRecalled') });
    } else {
      toast({ title: t('error'), description: t('chatRecallError'), variant: 'destructive' });
    }
    setRecallConfirm(null);
  }, [recallConfirm, selectedUserId, fetchMessages, toast]);

  const handleDeletePayment = useCallback(async () => {
    if (!deletePaymentId) return;
    const { error } = await supabase.from('payment_requests').delete().eq('id', deletePaymentId);
    if (!error) {
      toast({ title: t('chatDeletePaymentSuccess') });
      fetchPayments();
    } else {
      toast({ title: t('error'), description: t('chatDeletePaymentError'), variant: 'destructive' });
    }
    setDeletePaymentId(null);
  }, [deletePaymentId, fetchPayments, toast]);

  const getReplyContent = useCallback((replyToId: string | null | undefined) => {
    if (!replyToId) return null;
    return messages.find(m => m.id === replyToId);
  }, [messages]);

  const scrollToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
    }
  }, []);

  const allImageUrls = useMemo(() =>
    messages
      .filter(m => !(m as any).is_recalled && isImageUrl(m.content))
      .map(m => m.content),
    [messages]
  );

  const groupedMessages = useMemo(() => {
    const result: Array<{ type: 'single'; msg: Message } | { type: 'image-group'; msgs: Message[]; senderId: string }> = [];
    let i = 0;
    while (i < messages.length) {
      const msg = messages[i];
      const msgAny = msg as any;
      const isImg = !msgAny.is_recalled && isImageUrl(msg.content);
      if (isImg) {
        const group: Message[] = [msg];
        let j = i + 1;
        while (j < messages.length) {
          const next = messages[j];
          const nextAny = next as any;
          if (!nextAny.is_recalled && isImageUrl(next.content) && next.sender_id === msg.sender_id) {
            group.push(next);
            j++;
          } else break;
        }
        if (group.length > 1) {
          result.push({ type: 'image-group', msgs: group, senderId: msg.sender_id });
          i = j;
        } else {
          result.push({ type: 'single', msg });
          i++;
        }
      } else {
        result.push({ type: 'single', msg });
        i++;
      }
    }
    return result;
  }, [messages]);

  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const swipingMsgId = useRef<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<{ id: string; offset: number } | null>(null);

  const handleTouchStart = useCallback((e: ReactTouchEvent, msgId: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    swipingMsgId.current = msgId;
  }, []);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!swipingMsgId.current) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    const offset = Math.max(-60, Math.min(60, diff));
    if (Math.abs(offset) > 5) {
      setSwipeOffset({ id: swipingMsgId.current, offset });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!swipingMsgId.current) return;
    const diff = touchCurrentX.current - touchStartX.current;
    if (Math.abs(diff) > 40) {
      const msg = messages.find(m => m.id === swipingMsgId.current);
      if (msg && !(msg as any).is_recalled) {
        setReplyToMessage(msg);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    }
    swipingMsgId.current = null;
    setSwipeOffset(null);
  }, [messages]);

  if (!open) return null;

  const hasPendingContent = newMessage.trim() || pendingImages.length > 0;

  return (
    <div className={cn(
      "fixed z-50 bg-card flex flex-col overflow-hidden",
      selectedUserId
        ? "inset-0 sm:top-12 sm:right-4 sm:left-auto sm:bottom-auto sm:w-[420px] lg:w-[480px] sm:h-[700px] sm:max-h-[calc(100vh-4rem)] sm:rounded-2xl sm:shadow-2xl sm:border sm:border-border"
        : "top-12 right-4 w-[380px] lg:w-[460px] max-w-[calc(100vw-2rem)] h-[640px] max-h-[calc(100vh-4rem)] rounded-2xl shadow-2xl border border-border"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          {selectedUserId && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {selectedUserId && userInfoCache[selectedUserId] ? (
            <Avatar className={cn("h-9 w-9 ring-2", userInfoCache[selectedUserId]?.role === 'admin' ? 'ring-blue-500' : userInfoCache[selectedUserId]?.role === 'landlord' ? 'ring-orange-500' : 'ring-border')}>
              {userInfoCache[selectedUserId].avatar_url ? (
                <AvatarImage src={userInfoCache[selectedUserId].avatar_url!} />
              ) : null}
              <AvatarFallback className="text-xs"><User className="h-4 w-4" /></AvatarFallback>
            </Avatar>
          ) : !selectedUserId ? (
            <MessageCircle className="h-5 w-5 text-primary" />
          ) : null}
          <div>
            <button
              className="font-semibold text-sm hover:underline"
              onClick={() => {
                if (selectedUserId && selectedUserInfo) {
                  const info = userInfoCache[selectedUserId];
                  const r = info?.role || 'tenant';
                  setProfileDialog({ name: selectedUserInfo.full_name, role: r });
                }
              }}
            >
              {selectedUserInfo ? selectedUserInfo.full_name : t('chatMessages')}
            </button>
            {selectedUserInfo && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-mono">{selectedUserInfo.display_id}</span>
                {selectedUserId && userInfoCache[selectedUserId] && (
                  <RoleBadgeInline role={userInfoCache[selectedUserId].role} />
                )}
              </div>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!selectedUserId ? (
        /* Conversation list view */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('chatSearchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 rounded-full bg-muted border-0" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {searchQuery && searchResults.length > 0 ? (
              <div className="p-2">
                <p className="text-xs text-muted-foreground px-2 mb-2">{t('chatSearchResults')}</p>
                {searchResults.map((result) => (
                  <button key={result.user_id} className="w-full p-3 flex items-center gap-3 hover:bg-muted rounded-lg transition-colors" onClick={() => handleSelectSearchResult(result)}>
                    <Avatar className="h-10 w-10"><AvatarFallback><User className="h-5 w-5 text-primary" /></AvatarFallback></Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{result.full_name}</p>
                      <p className="text-xs text-muted-foreground">{result.display_id}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : conversations.length > 0 ? (
              <div className="p-1">
                {conversations.map((conv) => (
                  <ConversationItem
                    key={conv.user_id}
                    conv={conv}
                    info={userInfoCache[conv.user_id]}
                    onClick={() => handleSelectConversation(conv)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>{t('chatNoMessages')}</p>
                <p className="text-sm">{t('chatSearchToStart')}</p>
              </div>
            )}
          </ScrollArea>
        </div>
      ) : (
        /* Chat view */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Payment shortcuts */}
          {payments.length > 0 && (
            <div className="px-3 py-2 border-b flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-2 text-xs rounded-full" onClick={() => {
                const cards = document.querySelectorAll('[data-payment-card]');
                cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth' });
              }}>
                <CreditCard className="h-3 w-3 text-primary" />
                {t('chatPaymentBoxes', { count: String(payments.length) })}
              </Button>
            </div>
          )}

          {/* Messages area with infinite scroll */}
          <div 
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin" 
            ref={messagesContainerRef}
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="p-3 space-y-1 w-full overflow-hidden flex flex-col" style={{ maxWidth: '100%', boxSizing: 'border-box', minHeight: '100%' }}>
              {/* Loading indicator for older messages */}
              {loadingMore && (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
              {!hasMoreMessages && messages.length > 0 && (
                <div className="text-center py-3">
                  <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full">Đầu cuộc trò chuyện</span>
                </div>
              )}

              {/* Payment cards */}
              {payments.length > 0 && (
                <div className="space-y-3 overflow-hidden w-full" style={{ maxWidth: '100%' }}>
                  {payments.map((p) => (
                    <div key={p.id} data-payment-card className="overflow-hidden w-[85%] relative group/card" style={{ maxWidth: '85%' }}>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 z-10 h-7 w-7 opacity-0 group-hover/card:opacity-100 transition-opacity bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                          onClick={() => setDeletePaymentId(p.id)}
                          title="Xoá"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(p as any).type === 'deposit' ? (
                        <DepositCard payment={p as any} onRefresh={fetchPayments} />
                      ) : (
                        <PaymentCard payment={p} onRefresh={fetchPayments} onConsult={() => setNewMessage('Tôi cần tư vấn thêm về thanh toán.')} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Spacer to push messages to bottom when few messages */}
              <div className="flex-1" />

              {groupedMessages.map((item) => {
                  if (item.type === 'image-group') {
                    const { msgs: groupMsgs, senderId } = item;
                    const mine = senderId === user?.id;
                    const senderInfo = userInfoCache[senderId];
                    const senderRole = senderInfo?.role || 'tenant';
                    const lastMsg = groupMsgs[groupMsgs.length - 1];

                    return (
                      <div
                        key={`img-group-${groupMsgs[0].id}`}
                        className={cn("flex items-end gap-1.5 overflow-hidden group/msg py-0.5", mine ? "justify-end" : "justify-start")}
                        style={{ maxWidth: '100%', contentVisibility: 'auto', containIntrinsicSize: 'auto 120px' } as any}
                      >
                        {!mine && (
                          <Avatar className={cn("h-7 w-7 shrink-0 ring-1", senderRole === 'admin' ? 'ring-blue-500' : senderRole === 'landlord' ? 'ring-orange-500' : 'ring-border')}>
                            {senderInfo?.avatar_url ? <AvatarImage src={senderInfo.avatar_url} /> : null}
                            <AvatarFallback className="text-[10px]"><User className="h-3.5 w-3.5" /></AvatarFallback>
                          </Avatar>
                        )}
                        <div className="max-w-[75%] sm:max-w-[70%]">
                          {senderInfo && (
                            <SenderLabel name={mine ? 'Bạn' : (senderInfo.full_name || 'Người dùng')} role={senderRole} />
                          )}
                          <div className={cn("grid gap-1.5 rounded-2xl overflow-hidden", groupMsgs.length === 1 ? "grid-cols-1" : groupMsgs.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                            {groupMsgs.map((gMsg) => (
                              <ChatImage
                                key={gMsg.id}
                                src={gMsg.content}
                                className={cn("aspect-square rounded-lg border border-border hover:brightness-90 transition-all", groupMsgs.length === 1 && "max-w-[240px]")}
                                onClick={() => {
                                  const idx = allImageUrls.indexOf(gMsg.content);
                                  setFullscreenImages(allImageUrls);
                                  setFullscreenIndex(idx >= 0 ? idx : 0);
                                }}
                              />
                            ))}
                          </div>
                          <div className={cn("flex items-center gap-1 mt-1", mine ? "justify-end" : "justify-start")}>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(lastMsg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const { msg } = item;
                  const msgAny = msg as any;
                  const mine = msg.sender_id === user?.id;
                  const image = !msgAny.is_recalled && isImageUrl(msg.content);
                  const isRentalRequest = !msgAny.is_recalled && msg.content.includes('🏠 YÊU CẦU THUÊ PHÒNG');
                  const isRoomInfo = !msgAny.is_recalled && msg.content.includes('🏠 THÔNG TIN PHÒNG TRỌ');
                  const roomId = msg.room_id;
                  const repliedMsg = getReplyContent(msgAny.reply_to_id);
                  const msgSwipeOffset = swipeOffset?.id === msg.id ? swipeOffset.offset : 0;
                  const senderId = msg.sender_id;
                  const senderInfo = userInfoCache[senderId];
                  const senderRole = senderInfo?.role || 'tenant';
                  const isHighlighted = highlightedMsgId === msg.id;

                  const getBubbleBg = () => {
                    if (!mine) return 'bg-muted text-foreground';
                    if (senderRole === 'admin') return 'bg-blue-500 text-white';
                    if (senderRole === 'landlord') return 'bg-orange-400 text-white';
                    return 'bg-primary text-primary-foreground';
                  };

                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={cn(
                        "flex items-end gap-1.5 overflow-hidden group/msg py-0.5",
                        mine ? "justify-end" : "justify-start",
                        isHighlighted && "bg-primary/10 rounded-lg -mx-1 px-1 py-1 transition-colors duration-300"
                      )}
                      style={{ maxWidth: '100%', transform: msgSwipeOffset ? `translateX(${msgSwipeOffset}px)` : undefined, contentVisibility: 'auto', containIntrinsicSize: 'auto 40px' } as any}
                      onTouchStart={(e) => handleTouchStart(e, msg.id)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      {!mine && (
                        <Avatar className={cn("h-7 w-7 shrink-0 ring-1", senderRole === 'admin' ? 'ring-blue-500' : senderRole === 'landlord' ? 'ring-orange-500' : 'ring-border')}>
                          {senderInfo?.avatar_url ? <AvatarImage src={senderInfo.avatar_url} /> : null}
                          <AvatarFallback className="text-[10px]"><User className="h-3.5 w-3.5" /></AvatarFallback>
                        </Avatar>
                      )}
                      {mine && !msgAny.is_recalled && (
                        <MessageMenu
                          mine={mine}
                          onReply={() => { setReplyToMessage(msg); setTimeout(() => textareaRef.current?.focus(), 50); }}
                          onEdit={() => { setEditingMessage(msg); setEditContent(msg.content); setReplyToMessage(null); }}
                          onRecall={() => setRecallConfirm(msg)}
                        />
                      )}

                      <div className={cn("rounded-2xl min-w-0", (isRentalRequest || isRoomInfo) ? "max-w-[85%]" : "max-w-[70%] sm:max-w-[65%]", mine ? "rounded-br-md" : "rounded-bl-md")} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', overflow: 'hidden', maxWidth: (isRentalRequest || isRoomInfo) ? '85%' : undefined }}>
                        {msgAny.is_recalled ? (
                          <div className={cn("px-4 py-2", mine ? "bg-muted/60" : "bg-muted")}>
                            <p className="text-xs italic text-muted-foreground">{t('chatRecalledLabel')}</p>
                          </div>
                        ) : (
                          <div className={cn("px-4 py-2", getBubbleBg())}>
                            {senderInfo && (
                              <SenderLabel name={mine ? 'Bạn' : (senderInfo.full_name || 'Người dùng')} role={senderRole} />
                            )}
                            {repliedMsg && (
                              <button
                                onClick={() => scrollToMessage(repliedMsg.id)}
                                className={cn(
                                  "mb-2 px-3 py-2 rounded-lg border-l-3 -mx-1 w-full text-left cursor-pointer hover:opacity-80",
                                  mine ? "bg-primary-foreground/15 border-primary-foreground/50" : "bg-background/70 border-primary/50"
                                )}
                              >
                                <p className={cn("text-[10px] font-medium mb-0.5 truncate", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                  {repliedMsg.sender_id === user?.id ? 'Bạn' : selectedUserInfo?.full_name || 'Người dùng'}
                                </p>
                                <p className={cn("text-xs truncate", mine ? "text-primary-foreground/60" : "text-muted-foreground/80")}>
                                  {(repliedMsg as any).is_recalled ? t('chatRecalledLabel') : isImageUrl(repliedMsg.content) ? t('chatImageLabel') : repliedMsg.content}
                                </p>
                              </button>
                            )}

                            {(() => {
                              if (image) {
                                return (
                                  <ChatImage
                                    src={msg.content}
                                    className="max-w-[240px] rounded-lg"
                                    onClick={() => {
                                      const idx = allImageUrls.indexOf(msg.content);
                                      setFullscreenImages(allImageUrls);
                                      setFullscreenIndex(idx >= 0 ? idx : 0);
                                    }}
                                  />
                                );
                              }

                              const parts = parseMessageContent(msg.content);
                              
                              return (
                                <>
                                  {parts.map((part, idx) => {
                                    if (part.type === 'image') {
                                      return (
                                        <ChatImage
                                          key={idx}
                                          src={part.value}
                                          className="max-w-[240px] rounded-lg mt-2"
                                          onClick={() => {
                                            const imgIdx = allImageUrls.indexOf(part.value);
                                            setFullscreenImages(allImageUrls);
                                            setFullscreenIndex(imgIdx >= 0 ? imgIdx : 0);
                                          }}
                                        />
                                      );
                                    }
                                    return (
                                      <p key={idx} className="text-sm whitespace-pre-wrap break-words overflow-hidden" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                        {part.value}
                                      </p>
                                    );
                                  })}
                                  {isAdmin && isRentalRequest && roomId && (
                                    <Button size="sm" variant="secondary" className="mt-2 gap-1 text-xs" onClick={() => {
                                      onOpenChange(false);
                                      const url = `/admin?tab=requests&tenant=${msg.sender_id}${roomId ? `&room=${roomId}` : ''}`;
                                      if (window.location.pathname === '/admin') {
                                        window.dispatchEvent(new CustomEvent('navigate-admin-request', { detail: { tenant: msg.sender_id, room: roomId } }));
                                      } else {
                                        window.location.href = url;
                                      }
                                    }}>
                                      <Eye className="h-3 w-3" />
                                      Xem yêu cầu
                                    </Button>
                                  )}
                                  {isRoomInfo && roomId && (
                                    <Button size="sm" variant="secondary" className="mt-2 gap-1 text-xs" onClick={() => {
                                      onOpenChange(false);
                                      window.location.href = `/rooms/${roomId}`;
                                    }}>
                                      <Eye className="h-3 w-3" />
                                      Xem chi tiết
                                    </Button>
                                  )}
                                </>
                              );
                            })()}

                            <div className={cn("flex items-center gap-1 mt-1", mine ? "justify-end" : "justify-start")}>
                              {msgAny.is_edited && (
                                <span className={cn("text-[9px] italic", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>Đã chỉnh sửa</span>
                              )}
                              <span className={cn("text-[10px]", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {!mine && !msgAny.is_recalled && (
                        <MessageMenu
                          mine={mine}
                          onReply={() => { setReplyToMessage(msg); setTimeout(() => textareaRef.current?.focus(), 50); }}
                        />
                      )}
                    </div>
                  );
                })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Floating scroll to bottom button */}
          {showScrollDown && (
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  scrollToBottom(false);
                  setShowScrollDown(false);
                }}
                className="absolute -top-12 right-4 z-20 h-9 w-9 rounded-full bg-card text-foreground shadow-lg border flex items-center justify-center hover:scale-110 transition-transform"
                title="Cuộn xuống tin nhắn mới nhất"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          )}

          {editingMessage && (
            <div className="px-3 py-2 border-t bg-accent/30 flex items-center gap-2">
              <Pencil className="h-4 w-4 text-accent-foreground shrink-0" />
              <div className="flex-1 min-w-0 text-xs text-muted-foreground border-l-2 border-accent pl-2">
                <p className="text-[10px] font-medium text-accent-foreground">Đang chỉnh sửa</p>
                <p className="truncate">{editingMessage.content}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setEditingMessage(null); setEditContent(''); setNewMessage(''); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {replyToMessage && !editingMessage && (
            <div className="px-3 py-2 border-t bg-muted/50 flex items-center gap-2">
              <Reply className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0 text-xs text-muted-foreground border-l-2 border-primary pl-2 truncate">
                {(replyToMessage as any).is_recalled
                  ? t('chatRecalledLabel')
                  : isImageUrl(replyToMessage.content) ? t('chatImageLabel') : replyToMessage.content}
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setReplyToMessage(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {pendingImages.length > 0 && (
            <div className="px-3 pt-3 pb-2 border-t bg-muted/30 shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {pendingImages.map((img, idx) => (
                  <div key={idx} className="relative flex-shrink-0 w-20 h-20">
                    <button
                      type="button"
                      onClick={() => {
                        setFullscreenImages(pendingImages.map(i => i.preview));
                        setFullscreenIndex(idx);
                      }}
                      className="block w-full h-full cursor-pointer"
                    >
                      <img src={img.preview} alt="Preview" className="w-full h-full object-cover rounded-lg border-2 border-border" loading="eager" decoding="async" />
                    </button>
                    {sending && uploadProgress[idx] !== undefined && uploadProgress[idx] < 100 && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{uploadProgress[idx]}%</span>
                      </div>
                    )}
                    {!sending && (
                      <button
                        type="button"
                        onClick={() => removePendingImage(idx)}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-md z-10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-3 border-t bg-card">
            <div className="flex gap-2 items-end">
              <input ref={imageInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={handleImageSelected} />
              {!editingMessage && (
                <Button type="button" variant="ghost" size="icon" onClick={handlePickImage} disabled={!selectedUserId || uploadingImage} className="h-9 w-9 shrink-0 rounded-full" title={t('chatUploadImage')}>
                  {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                </Button>
              )}
              {!editingMessage && isAdmin && selectedUserId && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" title={t('chatFunctions')}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="min-w-[180px]">
                    <DropdownMenuItem onClick={() => setPaymentDialogOpen(true)} className="gap-2 cursor-pointer">
                      <CreditCard className="h-4 w-4 text-primary" />{t('chatPaymentBox')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDepositDialogOpen(true)} className="gap-2 cursor-pointer">
                      <Landmark className="h-4 w-4 text-orange-500" />{t('chatDepositBox')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAutoMessageDialogOpen(true)} className="gap-2 cursor-pointer">
                      <MessageSquareText className="h-4 w-4 text-blue-500" />Tin nhắn tự động
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRoomInfoDialogOpen(true)} className="gap-2 cursor-pointer">
                      <Home className="h-4 w-4 text-green-600" />Gửi thông tin trọ
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <textarea
                ref={textareaRef}
                placeholder={editingMessage ? t('chatEditPlaceholder') : t('chatInputPlaceholder')}
                value={editingMessage ? editContent : newMessage}
                onChange={(e) => editingMessage ? setEditContent(e.target.value) : setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && editingMessage) {
                    setEditingMessage(null);
                    setEditContent('');
                  }
                }}
                rows={1}
                className="flex-1 resize-none overflow-y-auto rounded-2xl border border-input bg-muted/50 px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40"
                style={{ maxHeight: '7.5rem', minHeight: '2.5rem', scrollbarWidth: 'thin', scrollbarGutter: 'stable' }}
                autoFocus={!!editingMessage}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
              {editingMessage ? (
                <Button onClick={handleEditMessage} disabled={!editContent.trim()} size="icon" className="h-9 w-9 rounded-full bg-accent hover:bg-accent/90 shrink-0">
                  <Check className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSendMessage} disabled={!hasPendingContent || sending} size="icon" className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 shrink-0">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recall confirm dialog */}
      <AlertDialog open={!!recallConfirm} onOpenChange={(open) => { if (!open) setRecallConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chatRecallMessage')}</AlertDialogTitle>
            <AlertDialogDescription>{t('chatRecallConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRecallMessage}>{t('chatRecall')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete payment/deposit confirm dialog */}
      <AlertDialog open={!!deletePaymentId} onOpenChange={(open) => { if (!open) setDeletePaymentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('chatDeletePaymentTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('chatDeletePaymentDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isAdmin && selectedUserId && user && (
        <PaymentBoxDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen} receiverId={selectedUserId} senderId={user.id} onSuccess={() => fetchPayments()} />
      )}
      {isAdmin && selectedUserId && user && (
        <DepositBoxDialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen} receiverId={selectedUserId} senderId={user.id} onSuccess={() => fetchPayments()} />
      )}
      {isAdmin && selectedUserId && user && (
        <AutoMessageDialog
          open={autoMessageDialogOpen}
          onOpenChange={setAutoMessageDialogOpen}
          onSend={async (content) => {
            await sendMessage(selectedUserId, content);
          }}
          userId={user.id}
        />
      )}
      {isAdmin && selectedUserId && user && (
        <RoomInfoSendDialog
          open={roomInfoDialogOpen}
          onOpenChange={setRoomInfoDialogOpen}
          onSend={async (content, roomId) => {
            await sendMessage(selectedUserId, content, roomId);
          }}
        />
      )}

      <MediaPreviewDialog
        open={fullscreenImages.length > 0}
        onOpenChange={(open) => { if (!open) { setFullscreenImages([]); setFullscreenIndex(0); } }}
        urls={fullscreenImages}
        initialIndex={fullscreenIndex}
        type="image"
      />

      <Dialog open={!!profileDialog} onOpenChange={(open) => { if (!open) setProfileDialog(null); }}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className={cn("h-5 w-5", profileDialog?.role === 'admin' ? 'text-blue-500' : profileDialog?.role === 'landlord' ? 'text-orange-500' : 'text-muted-foreground')} />
              {profileDialog?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {profileDialog?.role === 'admin' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <ShieldCheck className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-sm text-blue-700 dark:text-blue-300">Admin đã xác minh</p>
                  <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Tài khoản quản trị viên chính thức</p>
                </div>
              </div>
            )}
            {profileDialog?.role === 'landlord' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
                <ShieldCheck className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium text-sm text-orange-700 dark:text-orange-300">Chủ trọ đã xác minh</p>
                  <p className="text-xs text-orange-600/70 dark:text-orange-400/70">Tài khoản chủ trọ đã được xác minh</p>
                </div>
              </div>
            )}
            {profileDialog?.role === 'tenant' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Người thuê trọ</p>
                  <p className="text-xs text-muted-foreground">Tài khoản người dùng</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}