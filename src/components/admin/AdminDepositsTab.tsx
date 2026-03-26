// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, Landmark, CreditCard, User, Receipt, X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DepositRecord {
  id: string;
  sender_id: string;
  receiver_id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  amount: number | null;
  transfer_content: string | null;
  status: string;
  type: string;
  created_at: string;
  receipt_url: string | null;
  qr_url: string | null;
}

interface UserInfo {
  full_name: string;
  display_id: string;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
};

const statusLabel: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã gửi bill',
  approved: 'Đã xác nhận',
  rejected: 'Từ chối',
  cancelled: 'Đã huỷ',
};

export default function AdminDepositsTab() {
  const [records, setRecords] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'payment'>('all');
  const [billViewerOpen, setBillViewerOpen] = useState(false);
  const [billImages, setBillImages] = useState<string[]>([]);
  const [billIndex, setBillIndex] = useState(0);
  const [billZoom, setBillZoom] = useState(1);
  const [billRecord, setBillRecord] = useState<DepositRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRecords(data as DepositRecord[]);

      const userIds = [...new Set([...data.map(r => r.receiver_id), ...data.map(r => r.sender_id)])];
      if (userIds.length > 0) {
        const [profiles, settings] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
          supabase.from('user_settings').select('user_id, display_id').in('user_id', userIds),
        ]);
        const map: Record<string, UserInfo> = {};
        userIds.forEach(id => {
          const p = (profiles.data || []).find(x => x.user_id === id);
          const s = (settings.data || []).find(x => x.user_id === id);
          map[id] = {
            full_name: p?.full_name || 'Không xác định',
            display_id: s?.display_id || 'N/A',
          };
        });
        setUserMap(map);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const filtered = records.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const receiverInfo = userMap[r.receiver_id];
    const senderInfo = userMap[r.sender_id];
    return (
      receiverInfo?.full_name.toLowerCase().includes(q) ||
      receiverInfo?.display_id.toLowerCase().includes(q) ||
      senderInfo?.full_name.toLowerCase().includes(q) ||
      senderInfo?.display_id.toLowerCase().includes(q) ||
      r.account_holder.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });

  const openBillViewer = (record: DepositRecord) => {
    const imgs: string[] = [];
    if (record.receipt_url) imgs.push(record.receipt_url);
    if (record.qr_url) imgs.push(record.qr_url);
    if (imgs.length === 0) return;
    setBillImages(imgs);
    setBillIndex(0);
    setBillZoom(1);
    setBillRecord(record);
    setBillViewerOpen(true);
  };

  const handleDownloadBill = () => {
    const url = billImages[billIndex];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-${billRecord?.id || 'image'}-${billIndex + 1}`;
    a.target = '_blank';
    a.click();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Quản lí tiền cọc & thanh toán
          </CardTitle>
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Tìm theo tên, ID người thuê..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1">
              {[
                { value: 'all', label: 'Tất cả' },
                { value: 'deposit', label: 'Tiền cọc' },
                { value: 'payment', label: 'Thanh toán' },
              ].map(f => (
                <Button key={f.value} size="sm" variant={filterType === f.value ? 'default' : 'outline'} onClick={() => setFilterType(f.value as any)}>
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Landmark className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Chưa có dữ liệu</p>
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3">
                {filtered.map(r => {
                  const info = userMap[r.receiver_id];
                  const isDeposit = r.type === 'deposit';
                  const hasBill = !!(r.receipt_url || r.qr_url);
                  return (
                    <div key={r.id} className={cn(
                      "border rounded-xl p-4 space-y-2 transition-colors",
                      isDeposit ? "border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20" : "border-primary/30 bg-primary/5"
                    )}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {isDeposit ? <Landmark className="h-4 w-4 text-orange-500" /> : <CreditCard className="h-4 w-4 text-primary" />}
                          <span className="font-medium text-sm">{isDeposit ? 'Tiền cọc' : 'Thanh toán'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasBill && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openBillViewer(r)}
                              className="gap-1.5 h-7 px-2.5 rounded-lg text-xs border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-400 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950 dark:hover:text-emerald-300 transition-colors"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Xem Bill
                            </Button>
                          )}
                          <Badge className={cn('text-xs', statusColor[r.status] ?? '')}>{statusLabel[r.status] ?? r.status}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{info?.full_name || 'N/A'}</span>
                        <Badge variant="outline" className="font-mono text-xs">{info?.display_id || 'N/A'}</Badge>
                      </div>
                      {r.amount !== null && (
                        <p className={cn("text-lg font-bold", isDeposit ? "text-orange-600 dark:text-orange-400" : "text-primary")}>
                          {formatCurrency(r.amount)}
                        </p>
                      )}
                      {r.transfer_content && (
                        <p className="text-sm"><span className="text-muted-foreground">Nội dung:</span> {r.transfer_content}</p>
                      )}
                      <p className="text-sm"><span className="text-muted-foreground">Ngân hàng:</span> {r.bank_name} - {r.account_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Bill Fullscreen Viewer */}
      <Dialog open={billViewerOpen} onOpenChange={setBillViewerOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0 rounded-2xl overflow-hidden [&>button]:hidden">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-3">
              <Receipt className="h-4 w-4 text-emerald-400" />
              <span className="text-white/90 text-sm font-medium">
                {billImages.length > 1
                  ? `${billIndex === 0 ? 'Biên lai' : 'Mã QR'} (${billIndex + 1}/${billImages.length})`
                  : 'Biên lai thanh toán'}
              </span>
              {billRecord && (
                <Badge className="bg-white/15 text-white/80 border-0 text-xs backdrop-blur-sm">
                  {userMap[billRecord.receiver_id]?.full_name || ''}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setBillZoom(z => Math.max(0.5, z - 0.25))}
                className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Thu nhỏ"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-white/60 text-xs w-12 text-center">{Math.round(billZoom * 100)}%</span>
              <button
                onClick={() => setBillZoom(z => Math.min(3, z + 0.25))}
                className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Phóng to"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={handleDownloadBill}
                className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors ml-1"
                title="Tải về"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => setBillViewerOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors ml-1"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Image */}
          <div className="flex items-center justify-center min-h-[70vh] max-h-[95vh] overflow-auto p-8 pt-16">
            <img
              src={billImages[billIndex]}
              alt="Bill"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl transition-transform duration-200"
              style={{ transform: `scale(${billZoom})` }}
              draggable={false}
            />
          </div>

          {/* Navigation arrows */}
          {billImages.length > 1 && (
            <>
              <button
                onClick={() => setBillIndex(i => (i - 1 + billImages.length) % billImages.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-colors z-10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setBillIndex(i => (i + 1) % billImages.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-colors z-10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Dots indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {billImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setBillIndex(idx)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-200",
                      idx === billIndex ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
