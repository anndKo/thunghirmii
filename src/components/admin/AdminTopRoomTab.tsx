// @ts-nocheck
import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Pencil, Trash2, Loader2, CheckCircle, XCircle, Eye, Upload,
  Package, CreditCard, ClipboardList, Star, Clock, Image as ImageIcon,
  X, MessageSquare, Send, Home,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TopPackage {
  id: string; name: string; features: string; description: string | null;
  price: number; duration_days: number; is_active: boolean; created_at: string;
}

interface PaymentSettings {
  id: string; bank_name: string; account_number: string; account_holder: string;
  qr_image_url: string | null; transfer_template: string | null;
}

interface TopOrder {
  id: string; landlord_id: string; room_id: string; package_name: string;
  package_id: string; price: number; bill_url: string | null; status: string;
  created_at: string; approved_at: string | null; expires_at: string | null;
  duration_days: number | null; landlord_name?: string; room_title?: string;
}

interface Feedback {
  id: string; order_id: string; sender_id: string; content: string;
  media_urls: string[]; created_at: string;
}

export default function AdminTopRoomTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('packages');

  // Packages state
  const [packages, setPackages] = useState<TopPackage[]>([]);
  const [pkgDialogOpen, setPkgDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<TopPackage | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: '', features: '', description: '', price: '', duration_days: '' });
  const [pkgSubmitting, setPkgSubmitting] = useState(false);

  // Payment settings state
  const [paySettings, setPaySettings] = useState<PaymentSettings | null>(null);
  const [payForm, setPayForm] = useState({ bank_name: '', account_number: '', account_holder: '', transfer_template: '' });
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // Orders state
  const [orders, setOrders] = useState<TopOrder[]>([]);
  const [billOverlay, setBillOverlay] = useState<string | null>(null);
  const [orderSubmitting, setOrderSubmitting] = useState<string | null>(null);

  // Approval with priority dialog
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState<TopOrder | null>(null);
  const [priorityInput, setPriorityInput] = useState('1');

  // Feedback state
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackOrder, setFeedbackOrder] = useState<TopOrder | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackImages, setFeedbackImages] = useState<File[]>([]);
  const [feedbackImagePreviews, setFeedbackImagePreviews] = useState<string[]>([]);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const feedbackImgRef = useRef<HTMLInputElement>(null);

  // Feedback unread counts
  const [feedbackCounts, setFeedbackCounts] = useState<Map<string, number>>(new Map());
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [feedbacks]);
  
  const fetchAll = async () => {
    setLoading(true);
    // Auto-cleanup expired top rooms
    await supabase.rpc('cleanup_expired_top_rooms');
    await Promise.all([fetchPackages(), fetchPaySettings(), fetchOrders()]);
    setLoading(false);
  };

  const fetchPackages = async () => {
    const { data } = await supabase.from('top_packages').select('*').order('created_at', { ascending: false });
    if (data) setPackages(data);
  };

  const fetchPaySettings = async () => {
    const { data } = await supabase.from('top_payment_settings').select('*').limit(1).maybeSingle();
    if (data) {
      setPaySettings(data);
      setPayForm({ bank_name: data.bank_name, account_number: data.account_number, account_holder: data.account_holder, transfer_template: data.transfer_template || '' });
      setQrPreview(data.qr_image_url);
    }
  };

  const fetchOrders = async () => {
    const { data } = await supabase.from('top_orders').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const landlordIds = [...new Set(data.map(o => o.landlord_id))];
      const roomIds = [...new Set(data.map(o => o.room_id))];
      const [profilesRes, roomsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', landlordIds),
        supabase.from('rooms').select('id, title, priority').in('id', roomIds),
      ]);
      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.full_name]));
      const roomMap = new Map((roomsRes.data || []).map(r => [r.id, { title: r.title, priority: r.priority }]));
      const enriched = data.map(o => {
        const roomInfo = roomMap.get(o.room_id);
        const priorityValue = roomInfo?.priority || 0;
        // Convert priority value back to rank: 1000 → #1, 990 → #2, etc.
        const topNumber = priorityValue > 0 ? Math.max(1, Math.round((1000 - priorityValue) / 10) + 1) : null;
        return { ...o, landlord_name: profileMap.get(o.landlord_id) || 'N/A', room_title: roomInfo?.title || 'N/A', top_number: topNumber };
      });
      setOrders(enriched);

      // Fetch feedback counts per order
      const orderIds = data.map(o => o.id);
      const { data: fbData } = await supabase.from('top_feedbacks').select('order_id').in('order_id', orderIds);
      const countMap = new Map<string, number>();
      (fbData || []).forEach(fb => countMap.set(fb.order_id, (countMap.get(fb.order_id) || 0) + 1));
      setFeedbackCounts(countMap);
    } else {
      setOrders([]);
    }
  };

  // === PACKAGES ===
  const openAddPkg = () => {
    setEditingPkg(null);
    setPkgForm({ name: '', features: '', description: '', price: '', duration_days: '' });
    setPkgDialogOpen(true);
  };
  const openEditPkg = (pkg: TopPackage) => {
    setEditingPkg(pkg);
    setPkgForm({ name: pkg.name, features: pkg.features, description: pkg.description || '', price: pkg.price.toString(), duration_days: pkg.duration_days.toString() });
    setPkgDialogOpen(true);
  };
  const handleSavePkg = async () => {
    if (!pkgForm.name || !pkgForm.features || !pkgForm.price || !pkgForm.duration_days) {
      toast({ title: 'Thiếu thông tin', description: 'Vui lòng điền đầy đủ', variant: 'destructive' }); return;
    }
    setPkgSubmitting(true);
    const payload = { name: pkgForm.name, features: pkgForm.features, description: pkgForm.description || null, price: parseFloat(pkgForm.price), duration_days: parseInt(pkgForm.duration_days) };
    if (editingPkg) {
      const { error } = await supabase.from('top_packages').update(payload).eq('id', editingPkg.id);
      if (error) toast({ title: 'Lỗi', variant: 'destructive' }); else { toast({ title: 'Đã cập nhật gói!' }); setPkgDialogOpen(false); fetchPackages(); }
    } else {
      const { error } = await supabase.from('top_packages').insert(payload);
      if (error) toast({ title: 'Lỗi', variant: 'destructive' }); else { toast({ title: 'Đã tạo gói mới!' }); setPkgDialogOpen(false); fetchPackages(); }
    }
    setPkgSubmitting(false);
  };
  const handleDeletePkg = async (id: string) => {
    if (!confirm('Xóa gói dịch vụ này?')) return;
    await supabase.from('top_packages').delete().eq('id', id);
    toast({ title: 'Đã xóa!' }); fetchPackages();
  };

  // === PAYMENT SETTINGS ===
  const handleQrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setQrFile(file); setQrPreview(URL.createObjectURL(file)); }
  };
  const handleSavePaySettings = async () => {
    if (!payForm.bank_name || !payForm.account_number || !payForm.account_holder) {
      toast({ title: 'Thiếu thông tin', variant: 'destructive' }); return;
    }
    setPaySubmitting(true);
    let qrUrl = paySettings?.qr_image_url || null;
    if (qrFile) {
      const ext = qrFile.name.split('.').pop();
      const path = `qr-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('top-qr').upload(path, qrFile);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('top-qr').getPublicUrl(path);
        qrUrl = urlData.publicUrl;
      }
    }
    const payload = { bank_name: payForm.bank_name, account_number: payForm.account_number, account_holder: payForm.account_holder, qr_image_url: qrUrl, transfer_template: payForm.transfer_template || null };
    if (paySettings) {
      await supabase.from('top_payment_settings').update(payload).eq('id', paySettings.id);
    } else {
      await supabase.from('top_payment_settings').insert(payload);
    }
    toast({ title: 'Đã lưu thiết lập thanh toán!' });
    setPaySubmitting(false); setPayDialogOpen(false); setQrFile(null); fetchPaySettings();
  };

  // === ORDERS — APPROVE with priority ===
  const openApproveDialog = (order: TopOrder) => {
    setApprovingOrder(order);
    setPriorityInput('1');
    setApproveDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!approvingOrder) return;
    const priority = parseInt(priorityInput) || 1;
    // Convert priority rank to actual priority value: rank 1 → 1000, rank 2 → 999, etc.
    const priorityValue = Math.max(1, 1000 - (priority - 1) * 10);

    setOrderSubmitting(approvingOrder.id);
    const now = new Date();
    const pkg = packages.find(p => p.id === approvingOrder.package_id);
    const durationDays = pkg?.duration_days || approvingOrder.duration_days || 7;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const { error } = await supabase.from('top_orders').update({
      status: 'approved',
      reviewed_at: now.toISOString(),
      approved_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      duration_days: durationDays,
    }).eq('id', approvingOrder.id);

    if (!error) {
      await supabase.from('rooms').update({ priority: priorityValue }).eq('id', approvingOrder.room_id);

      // Notify landlord
      await supabase.from('notifications').insert({
        created_by: user?.id,
        title: '✅ Trọ đã được duyệt lên top!',
        content: `Phòng "${approvingOrder.room_title}" đã được duyệt lên top vị trí #${priority} trong ${durationDays} ngày. Hãy kiểm tra lịch sử đưa lên top để xem chi tiết.`,
        target_role: 'landlord',
        is_active: true,
      });

      toast({ title: `Đã duyệt! Trọ lên vị trí #${priority}, hiển thị ${durationDays} ngày.` });
      fetchOrders();
    } else {
      toast({ title: 'Lỗi', variant: 'destructive' });
    }
    setOrderSubmitting(null);
    setApproveDialogOpen(false);
    setApprovingOrder(null);
  };

  const handleReject = async (order: TopOrder) => {
    setOrderSubmitting(order.id);
    const { error } = await supabase.from('top_orders').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', order.id);
    if (!error) {
      // Notify landlord
      await supabase.from('notifications').insert({
        created_by: user?.id,
        title: '❌ Yêu cầu đưa trọ lên top bị từ chối',
        content: `Yêu cầu đưa phòng "${order.room_title}" lên top đã bị từ chối. Vui lòng liên hệ Admin để biết thêm chi tiết.`,
        target_role: 'landlord',
        is_active: true,
      });
      toast({ title: 'Đã từ chối!' });
      fetchOrders();
    } else {
      toast({ title: 'Lỗi', variant: 'destructive' });
    }
    setOrderSubmitting(null);
  };

  // === FEEDBACK ===
  const openFeedback = async (order: TopOrder) => {
    setFeedbackOrder(order);
    setFeedbackDialogOpen(true);
    setFeedbackText('');
    setFeedbackImages([]);
    setFeedbackImagePreviews([]);
    setFeedbackLoading(true);
    const { data } = await supabase.from('top_feedbacks').select('*').eq('order_id', order.id).order('created_at', { ascending: true });
    setFeedbacks(data || []);
    setFeedbackLoading(false);
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
    if (!feedbackOrder || !user) return;
    setFeedbackSending(true);
    const mediaUrls: string[] = [];
    for (const file of feedbackImages) {
      const ext = file.name.split('.').pop();
      const path = `${feedbackOrder.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('top-feedbacks').upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from('top-feedbacks').getPublicUrl(path);
        mediaUrls.push(urlData.publicUrl);
      }
    }
    const { error } = await supabase.from('top_feedbacks').insert({
      order_id: feedbackOrder.id,
      sender_id: user.id,
      content: feedbackText.trim(),
      media_urls: mediaUrls,
    });
    if (!error) {
      setFeedbackText('');
      setFeedbackImages([]);
      setFeedbackImagePreviews([]);
      // Reload feedbacks
      const { data } = await supabase.from('top_feedbacks').select('*').eq('order_id', feedbackOrder.id).order('created_at', { ascending: true });
      setFeedbacks(data || []);
      setFeedbackCounts(prev => { const m = new Map(prev); m.set(feedbackOrder.id, (m.get(feedbackOrder.id) || 0) + 1); return m; });
    } else {
      toast({ title: 'Lỗi gửi phản hồi', variant: 'destructive' });
    }
    setFeedbackSending(false);
  };

  const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ';

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'pending': return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Chờ duyệt</Badge>;
      case 'approved': return <Badge className="gap-1 bg-emerald-500"><CheckCircle className="w-3 h-3" />Đã duyệt</Badge>;
      case 'rejected': return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Từ chối</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="packages" className="gap-2"><Package className="h-4 w-4" />Gói dịch vụ</TabsTrigger>
          <TabsTrigger value="payment" className="gap-2"><CreditCard className="h-4 w-4" />Thiết lập TT</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2"><ClipboardList className="h-4 w-4" />Quản lí TT</TabsTrigger>
        </TabsList>

        {/* === PACKAGES TAB === */}
        <TabsContent value="packages" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Gói dịch vụ đưa trọ lên top</h3>
            <Button onClick={openAddPkg} className="gap-2"><Plus className="h-4 w-4" />Đặt dịch vụ</Button>
          </div>
          {packages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Chưa có gói dịch vụ nào</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {packages.map(pkg => (
                  <motion.div key={pkg.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg group">
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />
                      <CardContent className="p-5 pt-6 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                            <h4 className="font-bold text-lg">{pkg.name}</h4>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{pkg.features}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />{pkg.duration_days} ngày</Badge>
                          <span className="text-xl font-bold text-primary">{formatPrice(pkg.price)}</span>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEditPkg(pkg)}>
                            <Pencil className="w-3.5 h-3.5" />Sửa
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDeletePkg(pkg.id)}>
                            <Trash2 className="w-3.5 h-3.5" />Xóa
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* === PAYMENT SETTINGS TAB === */}
        <TabsContent value="payment" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Thiết lập thanh toán</h3>
            <Button onClick={() => setPayDialogOpen(true)} className="gap-2"><CreditCard className="h-4 w-4" />Thiết lập thanh toán</Button>
          </div>
          {paySettings ? (
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="grid gap-2 text-sm">
                  <div><span className="text-muted-foreground">Ngân hàng:</span> <span className="font-medium">{paySettings.bank_name}</span></div>
                  <div><span className="text-muted-foreground">Số TK:</span> <span className="font-mono font-medium">{paySettings.account_number}</span></div>
                  <div><span className="text-muted-foreground">Chủ TK:</span> <span className="font-medium">{paySettings.account_holder}</span></div>
                  {paySettings.transfer_template && <div><span className="text-muted-foreground">Nội dung CK mẫu:</span> <span className="font-medium">{paySettings.transfer_template}</span></div>}
                </div>
                {paySettings.qr_image_url && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">QR thanh toán:</p>
                    <img src={paySettings.qr_image_url} alt="QR" className="w-48 h-48 object-contain rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setBillOverlay(paySettings.qr_image_url)} />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Chưa thiết lập thông tin thanh toán</p>
            </div>
          )}
        </TabsContent>

        {/* === ORDERS TAB === */}
        <TabsContent value="orders" className="space-y-4">
          <h3 className="text-lg font-semibold">Quản lí thanh toán đưa trọ lên top</h3>
          {orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Chưa có đơn thanh toán nào</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Người dùng</TableHead>
                      <TableHead>Trọ</TableHead>
                      <TableHead>Gói</TableHead>
                      <TableHead>Số tiền</TableHead>
                      <TableHead className="text-center">Số Top</TableHead>
                      <TableHead>Bill</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.landlord_name}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{order.room_title}</TableCell>
                        <TableCell>{order.package_name}</TableCell>
                        <TableCell className="font-semibold">{formatPrice(order.price)}</TableCell>
                        <TableCell className="text-center">
                          {order.status === 'approved' && order.top_number ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold gap-1">
                              <Star className="w-3 h-3 fill-white" />#{order.top_number}
                            </Badge>
                          ) : order.status === 'approved' ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.bill_url ? (
                            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setBillOverlay(order.bill_url)}>
                              <Eye className="w-4 h-4" />Xem ảnh
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">Chưa có</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            {/* Feedback button — always visible */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 relative"
                              onClick={() => openFeedback(order)}
                            >
                              <MessageSquare className="w-3 h-3" />
                              Phản hồi
                              {(feedbackCounts.get(order.id) || 0) > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                  {feedbackCounts.get(order.id)}
                                </span>
                              )}
                            </Button>

                            {order.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  className="gap-1 bg-emerald-500 hover:bg-emerald-600"
                                  disabled={orderSubmitting === order.id}
                                  onClick={() => openApproveDialog(order)}
                                >
                                  {orderSubmitting === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}Duyệt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="gap-1"
                                  disabled={orderSubmitting === order.id}
                                  onClick={() => handleReject(order)}
                                >
                                  <XCircle className="w-3 h-3" />Từ chối
                                </Button>
                              </>
                            )}
                            {order.status === 'approved' && order.expires_at && (
                              <div className="text-xs text-muted-foreground self-center">
                                {new Date(order.expires_at) > new Date() ? (
                                  <span className="text-emerald-600">Còn {Math.ceil((new Date(order.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} ngày</span>
                                ) : (
                                  <span className="text-destructive">Đã hết hạn</span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Package Dialog */}
      <Dialog open={pkgDialogOpen} onOpenChange={setPkgDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPkg ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Tên gói dịch vụ *</Label><Input value={pkgForm.name} onChange={e => setPkgForm(p => ({ ...p, name: e.target.value }))} placeholder="VD: Top trang chủ 3 ngày" /></div>
            <div><Label>Tính năng *</Label><Input value={pkgForm.features} onChange={e => setPkgForm(p => ({ ...p, features: e.target.value }))} placeholder="VD: Hiển thị đầu trang chủ" /></div>
            <div><Label>Nội dung chi tiết</Label><Textarea value={pkgForm.description} onChange={e => setPkgForm(p => ({ ...p, description: e.target.value }))} placeholder="Mô tả chi tiết gói..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Số tiền (đ) *</Label><Input type="number" value={pkgForm.price} onChange={e => setPkgForm(p => ({ ...p, price: e.target.value }))} placeholder="50000" /></div>
              <div><Label>Thời gian (ngày) *</Label><Input type="number" value={pkgForm.duration_days} onChange={e => setPkgForm(p => ({ ...p, duration_days: e.target.value }))} placeholder="3" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPkgDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSavePkg} disabled={pkgSubmitting}>
              {pkgSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingPkg ? 'Cập nhật' : 'Tạo gói'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Settings Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Thiết lập thanh toán</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Tên ngân hàng *</Label><Input value={payForm.bank_name} onChange={e => setPayForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="VD: Vietcombank" /></div>
            <div><Label>Số tài khoản *</Label><Input value={payForm.account_number} onChange={e => setPayForm(p => ({ ...p, account_number: e.target.value }))} /></div>
            <div><Label>Tên tài khoản *</Label><Input value={payForm.account_holder} onChange={e => setPayForm(p => ({ ...p, account_holder: e.target.value }))} /></div>
            <div>
              <Label>Mã QR thanh toán</Label>
              <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrChange} />
              <Button variant="outline" className="w-full mt-1 gap-2" onClick={() => qrInputRef.current?.click()}>
                <Upload className="w-4 h-4" />Tải ảnh QR từ thiết bị
              </Button>
              {qrPreview && <img src={qrPreview} alt="QR Preview" className="mt-3 w-40 h-40 object-contain rounded-lg border" />}
            </div>
            <div><Label>Nội dung chuyển khoản mẫu</Label><Input value={payForm.transfer_template} onChange={e => setPayForm(p => ({ ...p, transfer_template: e.target.value }))} placeholder="VD: TOPROOM [Tên trọ]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSavePaySettings} disabled={paySubmitting}>
              {paySubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve with Priority Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              Duyệt & xếp vị trí top
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
              <p className="font-medium">{approvingOrder?.room_title}</p>
              <p className="text-muted-foreground">{approvingOrder?.landlord_name} · {approvingOrder?.package_name}</p>
            </div>
            <div>
              <Label className="font-medium">Vị trí hiển thị trên top *</Label>
              <p className="text-xs text-muted-foreground mb-2">Số 1 = đầu tiên, số 2 = thứ hai, ...</p>
              <Input
                type="number"
                min="1"
                value={priorityInput}
                onChange={e => setPriorityInput(e.target.value)}
                placeholder="1"
                className="text-center text-lg font-bold"
              />
            </div>
            {parseInt(priorityInput) > 1 && (
              <p className="text-xs text-muted-foreground text-center">
                Phòng này sẽ hiển thị sau {parseInt(priorityInput) - 1} phòng ưu tiên cao hơn
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Hủy</Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 gap-2"
              onClick={handleApprove}
              disabled={orderSubmitting !== null}
            >
              {orderSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Xác nhận duyệt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={(v) => { if (!billOverlay) setFeedbackDialogOpen(v); }}>
        <DialogContent
          className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
          onPointerDownOutside={(e) => { if (billOverlay) e.preventDefault(); }}
          onInteractOutside={(e) => { if (billOverlay) e.preventDefault(); }}
        >
          <DialogHeader className="p-5 pb-3 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-primary" />
              Phản hồi — {feedbackOrder?.room_title}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{feedbackOrder?.landlord_name} · {feedbackOrder?.package_name}</p>
          </DialogHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 h-[420px] overflow-y-auto px-5 py-4">
            {feedbackLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : feedbacks.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Chưa có phản hồi nào</p>
              </div>
            ) : (
              <div className="space-y-3 pb-2">
                {feedbacks.map(fb => {
                  const isAdmin = fb.sender_id === user?.id;
                  return (
                    <div key={fb.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 space-y-2 ${isAdmin ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                        <p className="text-sm leading-relaxed">{fb.content}</p>
                        {fb.media_urls?.length > 0 && (
                          <div className="grid grid-cols-2 gap-1.5 mt-1">
                            {fb.media_urls.map((url, i) => (
                              <img key={i} src={url} alt="" className="rounded-lg object-cover w-full aspect-square cursor-pointer hover:opacity-90" onClick={() => setBillOverlay(url)} />
                            ))}
                          </div>
                        )}
                        <p className={`text-[10px] ${isAdmin ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {isAdmin ? 'Admin' : 'Chủ trọ'} · {new Date(fb.created_at).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}></div>
              </div>
            )}
          </ScrollArea>

          {/* Input area */}
          <div className="p-4 border-t shrink-0 space-y-3">
            {feedbackImagePreviews.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {feedbackImagePreviews.map((src, i) => (
                  <div key={i} className="relative w-16 h-16">
                    <img src={src} alt="" className="w-full h-full object-cover rounded-lg border" />
                    <button onClick={() => removeFeedbackImage(i)} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center">
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
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendFeedback} disabled={feedbackSending || (!feedbackText.trim() && feedbackImages.length === 0)}>
                  {feedbackSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill/QR Overlay */}
      {billOverlay &&
        createPortal(
          <div
            className="fixed inset-0 z-[999999] bg-black/80 flex items-center justify-center p-4"
            style={{ pointerEvents: 'auto' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setBillOverlay(null);
            }}
          >
            <div
              className="relative max-w-lg max-h-[90vh]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 cursor-pointer"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setBillOverlay(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={billOverlay}
                alt="Bill"
                className="max-w-full max-h-[85vh] object-contain rounded-xl"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
