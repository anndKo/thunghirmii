// @ts-nocheck
import { createPortal } from "react-dom";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Star, Clock, CheckCircle, XCircle, Loader2, Home, Timer, History,
  MessageSquare, Send, Image as ImageIcon, X, ChevronLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TopOrder {
  id: string;
  room_id: string;
  package_name: string;
  price: number;
  status: string;
  created_at: string;
  approved_at: string | null;
  expires_at: string | null;
  duration_days: number | null;
  room_title?: string;
  room_image?: string | null;
}

interface Feedback {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  media_urls: string[];
  created_at: string;
}

type View = 'list' | 'feedback';

export function LandlordTopHistory({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<TopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selectedOrder, setSelectedOrder] = useState<TopOrder | null>(null);

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackImages, setFeedbackImages] = useState<File[]>([]);
  const [feedbackImagePreviews, setFeedbackImagePreviews] = useState<string[]>([]);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [imageOverlay, setImageOverlay] = useState<string | null>(null);
  const [feedbackCounts, setFeedbackCounts] = useState<Map<string, number>>(new Map());
  const feedbackImgRef = useRef<HTMLInputElement>(null);
  const feedbackEndRef = useRef<HTMLDivElement>(null);
  const [adminId, setAdminId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchOrders();
      fetchAdminId();
    }
    if (!open) {
      setView('list');
      setSelectedOrder(null);
    }
  }, [open, user]);
  
  useEffect(() => {
    if (imageOverlay) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  
    return () => {
      document.body.style.overflow = "";
    };
  }, [imageOverlay]);

  const fetchAdminId = async () => {
    const { data } = await supabase.rpc('get_admin_user_id');
    setAdminId(data || null);
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('top_orders')
      .select('*')
      .eq('landlord_id', user?.id)
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const roomIds = [...new Set(data.map(o => o.room_id))];
      const { data: roomsData } = await supabase.from('rooms').select('id, title, images').in('id', roomIds);
      const roomMap = new Map((roomsData || []).map(r => [r.id, r]));
      const enriched = data.map(o => ({
        ...o,
        room_title: roomMap.get(o.room_id)?.title || 'N/A',
        room_image: roomMap.get(o.room_id)?.images?.[0] || null,
      }));
      setOrders(enriched);

      // Fetch feedback counts
      const orderIds = data.map(o => o.id);
      const { data: fbData } = await supabase.from('top_feedbacks').select('order_id').in('order_id', orderIds);
      const countMap = new Map<string, number>();
      (fbData || []).forEach(fb => countMap.set(fb.order_id, (countMap.get(fb.order_id) || 0) + 1));
      setFeedbackCounts(countMap);
    } else {
      setOrders([]);
    }
    setLoading(false);
  };

  const scrollFeedbackToBottom = useCallback(() => {
    setTimeout(() => {
      feedbackEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const openFeedback = async (order: TopOrder) => {
    setSelectedOrder(order);
    setView('feedback');
    setFeedbackText('');
    setFeedbackImages([]);
    setFeedbackImagePreviews([]);
    setFeedbackLoading(true);
    const { data } = await supabase.from('top_feedbacks').select('*').eq('order_id', order.id).order('created_at', { ascending: true });
    setFeedbacks(data || []);
    setFeedbackLoading(false);
    setTimeout(() => {
      feedbackEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 150);
  };

  const handleFeedbackImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFeedbackImages(prev => [...prev, ...files]);
    const previews = files.map(f => URL.createObjectURL(f));
    setFeedbackImagePreviews(prev => [...prev, ...previews]);
  };

  const removeFeedbackImage = (i: number) => {
    setFeedbackImages(prev => prev.filter((_, idx) => idx !== i));
    setFeedbackImagePreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const sendFeedback = async () => {
    if (!feedbackText.trim() && feedbackImages.length === 0) return;
    if (!selectedOrder || !user) return;
    setFeedbackSending(true);
    const mediaUrls: string[] = [];
    for (const file of feedbackImages) {
      const ext = file.name.split('.').pop();
      const path = `${selectedOrder.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('top-feedbacks').upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from('top-feedbacks').getPublicUrl(path);
        mediaUrls.push(urlData.publicUrl);
      }
    }
    const { error } = await supabase.from('top_feedbacks').insert({
      order_id: selectedOrder.id,
      sender_id: user.id,
      content: feedbackText.trim(),
      media_urls: mediaUrls,
    });
    if (!error) {
      setFeedbackText('');
      setFeedbackImages([]);
      setFeedbackImagePreviews([]);
      const { data } = await supabase.from('top_feedbacks').select('*').eq('order_id', selectedOrder.id).order('created_at', { ascending: true });
      setFeedbacks(data || []);
      setFeedbackCounts(prev => { const m = new Map(prev); m.set(selectedOrder.id, (m.get(selectedOrder.id) || 0) + 1); return m; });
      scrollFeedbackToBottom();
    }
    setFeedbackSending(false);
  };

  const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ';

  const getRemainingDays = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getStatusInfo = (order: TopOrder) => {
    if (order.status === 'pending')
      return { label: 'Chờ duyệt', variant: 'secondary' as const, icon: Clock };
  
    if (order.status === 'rejected')
      return { label: 'Từ chối', variant: 'destructive' as const, icon: XCircle };
  
    if (order.status === 'expired')
      return { label: 'Đã hết hạn', variant: 'outline' as const, icon: Timer };
  
    if (order.status === 'approved') {
      const remaining = getRemainingDays(order.expires_at);
      if (remaining === null || remaining <= 0)
        return { label: 'Đã hết hạn', variant: 'outline' as const, icon: Timer };
  
      return {
        label: `Còn ${remaining} ngày`,
        variant: 'default' as const,
        icon: CheckCircle
      };
    }
  
    return { label: 'Không xác định', variant: 'outline' as const, icon: Clock };
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (imageOverlay) return; 
          onOpenChange(v);
        }}
      >
        <DialogContent
          className={`max-w-lg max-h-[85vh] flex flex-col min-h-0 p-0 gap-0 ${
            imageOverlay ? "pointer-events-none" : ""
          }`}
          onPointerDownOutside={(e) => {
            if (imageOverlay) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (imageOverlay) e.preventDefault();
          }}
        >
          {/* Header */}
          <DialogHeader className="p-5 pb-3 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2">
              {view === 'list' ? (
                <>
                  <History className="h-5 w-5 text-primary" />
                  Lịch sử đưa trọ lên top
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
            
                  <span className="text-muted-foreground text-sm">
                    Phản hồi
                  </span>
            
                  <span className="text-muted-foreground">—</span>
            
                  <span className="font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                    {selectedOrder?.room_title}
                  </span>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* === LIST VIEW === */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Chưa có lịch sử đưa trọ lên top</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {orders.map((order, i) => {
                      const status = getStatusInfo(order);
                      const remaining = getRemainingDays(order.expires_at);
                      const isActive = order.status === 'approved' && remaining !== null && remaining > 0;
                      const fbCount = feedbackCounts.get(order.id) || 0;

                      return (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <Card
                            className={`cursor-pointer transition-all duration-300 hover:shadow-md hover:border-primary/30 ${isActive ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 shadow-md ring-1 ring-amber-200/50 dark:ring-amber-800/30' : ''}`}
                            onClick={() => openFeedback(order)}
                          >
                            {isActive && <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />}
                            <CardContent className="p-4">
                              <div className="flex gap-3">
                                <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                                  {order.room_image ? (
                                    <img src={order.room_image} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center"><Home className="w-6 h-6 text-muted-foreground" /></div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-semibold text-sm truncate">{order.room_title}</h4>
                                    <Badge variant={status.variant} className="gap-1 shrink-0 text-xs">
                                      <status.icon className="w-3 h-3" />
                                      {status.label}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                    <span>{order.package_name}</span>
                                    <span>•</span>
                                    <span className="font-semibold text-foreground">{formatPrice(order.price)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                      <span>Đặt: {new Date(order.created_at).toLocaleDateString('vi-VN')}</span>
                                      {order.duration_days && <span>• {order.duration_days} ngày</span>}
                                    </div>
                                    <div className="flex items-center gap-1 text-primary font-medium">
                                      <MessageSquare className="w-3 h-3" />
                                      {fbCount > 0 ? <span>{fbCount} phản hồi</span> : <span>Gửi phản hồi</span>}
                                    </div>
                                  </div>
                                  {isActive && remaining !== null && (
                                    <div className="mt-1.5">
                                      <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-amber-700 dark:text-amber-400 font-medium">Đang hiển thị top</span>
                                        <span className="text-amber-600 dark:text-amber-500 font-bold">{remaining}/{order.duration_days} ngày</span>
                                      </div>
                                      <div className="w-full bg-muted rounded-full h-1.5">
                                        <div
                                          className="bg-gradient-to-r from-amber-400 to-orange-500 h-1.5 rounded-full transition-all"
                                          style={{ width: `${Math.max(5, (remaining / (order.duration_days || 1)) * 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* === FEEDBACK VIEW === */}
          {view === 'feedback' && (
            <>
              {/* Messages area - fixed height with scroll */}
              <div className="chat-scroll flex-1 min-h-0 overflow-y-auto px-5 py-4 max-h-[50vh]">
                {feedbackLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : feedbacks.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Chưa có phản hồi nào</p>
                    <p className="text-xs mt-1">Nhập nội dung bên dưới để gửi phản hồi đến Admin</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {feedbacks.map(fb => {
                      const isMe = fb.sender_id === user?.id;
                      const isAdmin = fb.sender_id === adminId;
                      return (
                        <div key={fb.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[65%] rounded-xl px-4 py-2.5 space-y-2 ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
                              {fb.content}
                            </p>
                            {fb.media_urls?.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {fb.media_urls.map((url, i) => (
                                  <img
                                    key={i}
                                    src={url}
                                    alt=""
                                    className="rounded-lg object-cover max-w-[160px] max-h-[160px] cursor-pointer hover:opacity-90 transition"
                                    onClick={() => setImageOverlay(url)}
                                  />
                                ))}
                              </div>
                            )}
                            <p className={`text-[10px] ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {isAdmin ? 'Admin' : 'Bạn'} · {new Date(fb.created_at).toLocaleString('vi-VN')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={feedbackEndRef} />
                  </div>
                )}
              </div>

              {/* Input area */}
              <div className="p-4 border-t shrink-0 space-y-2.5">
                {feedbackImagePreviews.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {feedbackImagePreviews.map((src, i) => (
                      <div key={i} className="relative w-16 h-16">
                        <img src={src} alt="" className="w-full h-full object-cover rounded-lg border" />
                        <button
                          onClick={() => removeFeedbackImage(i)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    placeholder="Nhập nội dung phản hồi..."
                    rows={2}
                    className="flex-1 resize-none text-sm"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFeedback(); } }}
                  />
                  <div className="flex flex-col gap-1.5">
                    <input ref={feedbackImgRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFeedbackImageChange} />
                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => feedbackImgRef.current?.click()}>
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={sendFeedback}
                      disabled={feedbackSending || (!feedbackText.trim() && feedbackImages.length === 0)}
                    >
                      {feedbackSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image overlay */}
      {imageOverlay &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="fixed inset-0 z-[999999] bg-black/90 flex items-center justify-center p-4 pointer-events-auto"
            >
              {/* nền click */}
              <div
                className="absolute inset-0"
                onClick={() => setImageOverlay(null)}
              />
              {/* Nút đóng */}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setImageOverlay(null);
                }}
                className="absolute top-6 right-6 z-[100000] bg-black/60 hover:bg-black/80 text-white rounded-full p-2 cursor-pointer transition"
              >
                <X className="w-6 h-6" />
              </button>
      
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                src={imageOverlay}
                alt=""
                className="max-w-full max-h-[90vh] object-contain rounded-xl"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
