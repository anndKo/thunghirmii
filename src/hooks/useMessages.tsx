// @ts-nocheck
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  room_id: string | null;
  is_read: boolean;
  created_at: string;
  reply_to_id: string | null;
  is_recalled: boolean;
  is_edited: boolean;
  edited_at: string | null;
}

export interface Conversation {
  user_id: string;
  full_name: string;
  display_id: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export interface UserSettings {
  user_id: string;
  display_id: string;
  avatar_url: string | null;
}

const PAGE_SIZE = 25;

// Cache for profile/settings data to avoid refetching
const profileCache = new Map<string, string>();
const settingsCache = new Map<string, string>();

export function useMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const selectedUserIdRef = useRef<string | null>(null);
  const isOpenRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  const fetchUserSettings = useCallback(async () => {
    if (!user) return;

    const { data: existing } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      setUserSettings(existing);
    } else {
      const { data: newId } = await supabase.rpc('generate_display_id');
      const { data: newSettings, error } = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          display_id: newId || `TT${Date.now().toString().slice(-6)}`,
        })
        .select()
        .single();

      if (newSettings && !error) {
        setUserSettings(newSettings);
      }
    }
  }, [user]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    const isFirstLoad = conversations.length === 0;
    if (isFirstLoad) setLoading(true);

    const { data: allMessages } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!allMessages) {
      setLoading(false);
      return;
    }

    const conversationMap = new Map<string, {
      lastMsg: typeof allMessages[0];
      unread_count: number;
    }>();

    allMessages.forEach(msg => {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, { lastMsg: msg, unread_count: 0 });
      }
      
      if (!msg.is_read && msg.receiver_id === user.id) {
        conversationMap.get(partnerId)!.unread_count++;
      }
    });

    const partnerIds = Array.from(conversationMap.keys());
    
    const uncachedProfileIds = partnerIds.filter(id => !profileCache.has(id));
    const uncachedSettingsIds = partnerIds.filter(id => !settingsCache.has(id));

    const [profilesRes, settingsRes] = await Promise.all([
      uncachedProfileIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name').in('user_id', uncachedProfileIds)
        : { data: [] },
      uncachedSettingsIds.length > 0
        ? supabase.from('user_settings').select('user_id, display_id').in('user_id', uncachedSettingsIds)
        : { data: [] },
    ]);

    (profilesRes.data || []).forEach(p => profileCache.set(p.user_id, p.full_name));
    (settingsRes.data || []).forEach(s => settingsCache.set(s.user_id, s.display_id));

    const convos: Conversation[] = partnerIds.map(partnerId => {
      const data = conversationMap.get(partnerId)!;
      const lastMsg = data.lastMsg;
      const senderName = lastMsg.sender_id === user.id
        ? 'Bạn'
        : (profileCache.get(lastMsg.sender_id) || 'Người dùng');
      
      let previewText = lastMsg.content;
      if (lastMsg.is_recalled) {
        previewText = 'Tin nhắn đã thu hồi';
      } else {
        const mediaRegex = /https?:\/\/\S+\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg|tiff?|mp4|mov|avi|webm)/gi;
        const mediaMatches = lastMsg.content.match(mediaRegex);
        const nonMediaText = lastMsg.content.replace(mediaRegex, '').trim();
        
        if (mediaMatches && mediaMatches.length > 0) {
          const imageExts = /\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg|tiff?)$/i;
          const imageCount = mediaMatches.filter(u => imageExts.test(u)).length;
          const videoCount = mediaMatches.length - imageCount;
          
          const parts: string[] = [];
          if (imageCount > 0) parts.push(`${imageCount} ảnh`);
          if (videoCount > 0) parts.push(`${videoCount} video`);
          
          if (nonMediaText) {
            previewText = `${senderName}: ${nonMediaText}`;
          } else {
            previewText = `${senderName} đã gửi ${parts.join(' và ')}`;
          }
        } else {
          previewText = `${senderName}: ${lastMsg.content}`;
        }
      }
      
      return {
        user_id: partnerId,
        full_name: profileCache.get(partnerId) || 'Người dùng',
        display_id: settingsCache.get(partnerId) || 'N/A',
        last_message: previewText,
        last_message_time: lastMsg.created_at,
        unread_count: data.unread_count,
      };
    });

    setConversations(convos.sort((a, b) => 
      new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
    ));
    
    setLoading(false);
  }, [user]);

  // Incrementally update a single conversation instead of refetching all
  const updateConversationWithMessage = useCallback(async (msg: Message) => {
    if (!user) return;
    const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;

    let partnerName = profileCache.get(partnerId);
    let partnerDisplayId = settingsCache.get(partnerId);

    if (!partnerName || !partnerDisplayId) {
      const [profileRes, settingsRes] = await Promise.all([
        !partnerName ? supabase.from('profiles').select('full_name').eq('user_id', partnerId).single() : { data: null },
        !partnerDisplayId ? supabase.from('user_settings').select('display_id').eq('user_id', partnerId).single() : { data: null },
      ]);
      if (profileRes.data) {
        partnerName = profileRes.data.full_name;
        profileCache.set(partnerId, partnerName);
      }
      if (settingsRes.data) {
        partnerDisplayId = settingsRes.data.display_id;
        settingsCache.set(partnerId, partnerDisplayId);
      }
    }

    const senderName = msg.sender_id === user.id ? 'Bạn' : (partnerName || 'Người dùng');
    let previewText = msg.content;
    if (msg.is_recalled) {
      previewText = 'Tin nhắn đã thu hồi';
    } else {
      const mediaRegex = /https?:\/\/\S+\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg|tiff?|mp4|mov|avi|webm)/gi;
      const mediaMatches = msg.content.match(mediaRegex);
      const nonMediaText = msg.content.replace(mediaRegex, '').trim();

      if (mediaMatches && mediaMatches.length > 0) {
        const imageExts = /\.(jpg|jpeg|jfif|png|gif|webp|bmp|svg|tiff?)$/i;
        const imageCount = mediaMatches.filter(u => imageExts.test(u)).length;
        const videoCount = mediaMatches.length - imageCount;
        const parts: string[] = [];
        if (imageCount > 0) parts.push(`${imageCount} ảnh`);
        if (videoCount > 0) parts.push(`${videoCount} video`);

        if (nonMediaText) {
          previewText = `${senderName}: ${nonMediaText}`;
        } else {
          previewText = `${senderName} đã gửi ${parts.join(' và ')}`;
        }
      } else {
        previewText = `${senderName}: ${msg.content}`;
      }
    }

    setConversations(prev => {
      const existing = prev.find(c => c.user_id === partnerId);
      const updatedConvo: Conversation = {
        user_id: partnerId,
        full_name: partnerName || existing?.full_name || 'Người dùng',
        display_id: partnerDisplayId || existing?.display_id || 'N/A',
        last_message: previewText,
        last_message_time: msg.created_at,
        unread_count: (existing?.unread_count || 0) + (msg.receiver_id === user.id && !msg.is_read ? 1 : 0),
      };

      const filtered = prev.filter(c => c.user_id !== partnerId);
      return [updatedConvo, ...filtered];
    });
  }, [user]);

  // Fetch latest PAGE_SIZE messages (paginated - newest first, then reverse for display)
  const fetchMessages = useCallback(async (partnerId: string) => {
    if (!user) return;

    const { data, count } = await supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (data) {
      // Reverse to get chronological order (oldest first for display)
      setMessages(data.reverse());
      setHasMoreMessages((count || 0) > PAGE_SIZE);
      
      // Mark as read in background
      supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', partnerId)
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .then();
    }
  }, [user]);

  // Load older messages (infinite scroll up)
  const fetchOlderMessages = useCallback(async (partnerId: string) => {
    if (!user || !hasMoreMessages || loadingMore) return;
    
    setLoadingMore(true);
    
    const oldestMessage = messages[0];
    if (!oldestMessage) {
      setLoadingMore(false);
      return;
    }

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .lt('created_at', oldestMessage.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (data && data.length > 0) {
      // Prepend older messages (reverse to chronological order)
      setMessages(prev => [...data.reverse(), ...prev]);
      setHasMoreMessages(data.length === PAGE_SIZE);
    } else {
      setHasMoreMessages(false);
    }
    
    setLoadingMore(false);
  }, [user, messages, hasMoreMessages, loadingMore]);

  const sendMessage = useCallback(async (receiverId: string, content: string, roomId?: string, replyToId?: string) => {
    if (!user) return null;

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: receiverId,
      content,
      room_id: roomId || null,
      is_read: false,
      created_at: new Date().toISOString(),
      reply_to_id: replyToId || null,
      is_recalled: false,
      is_edited: false,
      edited_at: null,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content,
        room_id: roomId || null,
        reply_to_id: replyToId || null,
      } as any)
      .select()
      .single();

    if (data && !error) {
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data : m));
      updateConversationWithMessage(data);
      return data;
    } else {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }
    
    return null;
  }, [user, updateConversationWithMessage]);

  const findAdminUser = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_admin_user_id');
    if (error) return null;
    return data || null;
  }, []);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) return [];

    const [profileResults, settingsResults] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').ilike('full_name', `%${query}%`).limit(10),
      supabase.from('user_settings').select('user_id, display_id').ilike('display_id', `%${query}%`).limit(10),
    ]);

    const userIds = new Set([
      ...(profileResults.data?.map(p => p.user_id) || []),
      ...(settingsResults.data?.map(s => s.user_id) || []),
    ]);

    const profileMap = new Map((profileResults.data || []).map(p => [p.user_id, p.full_name]));
    const settingsMap = new Map((settingsResults.data || []).map(s => [s.user_id, s.display_id]));

    const missingProfileIds = [...userIds].filter(id => id !== user?.id && !profileMap.has(id));
    const missingSettingsIds = [...userIds].filter(id => id !== user?.id && !settingsMap.has(id));

    const [missingProfiles, missingSettings] = await Promise.all([
      missingProfileIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name').in('user_id', missingProfileIds)
        : { data: [] },
      missingSettingsIds.length > 0
        ? supabase.from('user_settings').select('user_id, display_id').in('user_id', missingSettingsIds)
        : { data: [] },
    ]);

    (missingProfiles.data || []).forEach(p => profileMap.set(p.user_id, p.full_name));
    (missingSettings.data || []).forEach(s => settingsMap.set(s.user_id, s.display_id));

    const results: { user_id: string; full_name: string; display_id: string }[] = [];
    for (const userId of userIds) {
      if (userId === user?.id) continue;
      results.push({
        user_id: userId,
        full_name: profileMap.get(userId) || 'Người dùng',
        display_id: settingsMap.get(userId) || 'N/A',
      });
    }

    return results;
  }, [user]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user) return;

    fetchUserSettings();

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as Message;
          
          if (newMessage.sender_id === user.id || newMessage.receiver_id === user.id) {
            const currentSelected = selectedUserIdRef.current;
            if (currentSelected && 
                (newMessage.sender_id === currentSelected || newMessage.receiver_id === currentSelected)) {
              setMessages(prev => {
                if (prev.some(m => m.id === newMessage.id)) return prev;
                const filtered = prev.filter(m => !m.id.startsWith('temp-') || m.content !== newMessage.content);
                return [...filtered, newMessage];
              });
            }
            updateConversationWithMessage(newMessage);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updated = payload.new as Message;
          if (updated.sender_id === user.id || updated.receiver_id === user.id) {
            setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
            updateConversationWithMessage(updated);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUserSettings, updateConversationWithMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasMoreMessages(true);
  }, []);

  return {
    conversations,
    messages,
    selectedUserId,
    setSelectedUserId,
    loading,
    userSettings,
    fetchMessages,
    fetchOlderMessages,
    hasMoreMessages,
    loadingMore,
    sendMessage,
    findAdminUser,
    searchUsers,
    fetchConversations,
    clearMessages,
  };
}
