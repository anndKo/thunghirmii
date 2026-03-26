// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Star, Clock, Eye, Upload, Loader2, X, ChevronRight, Home, MapPin, Check, CreditCard, Package, ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TopPackage {
  id: string; name: string; features: string; description: string | null; price: number; duration_days: number;
}
interface Room {
  id: string; title: string; address_detail: string; images: string[] | null;
}
interface PaymentSettings {
  bank_name: string; account_number: string; account_holder: string; qr_image_url: string | null; transfer_template: string | null;
}

type Step = 'packages' | 'detail' | 'select-room' | 'payment' | 'upload-bill';

export function LandlordTopRoom({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { findAdminUser, sendMessage } = useMessages();
  const [step, setStep] = useState<Step>('packages');
  const [packages, setPackages] = useState<TopPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<TopPackage | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [paySettings, setPaySettings] = useState<PaymentSettings | null>(null);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreview, setBillPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrOverlay, setQrOverlay] = useState(false);
  const billInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStep('packages');
      setSelectedPkg(null);
      setSelectedRoom(null);
      setBillFile(null);
      setBillPreview(null);
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    const [pkgRes, roomRes, payRes] = await Promise.all([
      supabase.from('top_packages').select('*').eq('is_active', true).order('price'),
      supabase.from('rooms').select('id, title, address_detail, images').eq('landlord_id', user?.id),
      supabase.from('top_payment_settings').select('*').limit(1).maybeSingle(),
    ]);
    if (pkgRes.data) setPackages(pkgRes.data);
    if (roomRes.data) setRooms(roomRes.data);
    if (payRes.data) setPaySettings(payRes.data);
    setLoading(false);
  };

  const handleViewDetail = (pkg: TopPackage) => { setSelectedPkg(pkg); setStep('detail'); };
  const handleOrderPkg = () => setStep('select-room');
  const handleSelectRoom = (room: Room) => { setSelectedRoom(room); setStep('payment'); };

  const handleBillChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setBillFile(file); setBillPreview(URL.createObjectURL(file)); }
  };

  const handleSubmitPayment = async () => {
    if (!billFile || !selectedPkg || !selectedRoom) {
      toast({ title: 'Vui lòng tải bill thanh toán', variant: 'destructive' }); return;
    }
    setSubmitting(true);
    // Upload bill
    const ext = billFile.name.split('.').pop();
    const path = `bill-${Date.now()}-${user?.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('top-bills').upload(path, billFile);
    if (uploadErr) { toast({ title: 'Lỗi tải ảnh', variant: 'destructive' }); setSubmitting(false); return; }
    const { data: urlData } = supabase.storage.from('top-bills').getPublicUrl(path);
    const billUrl = urlData.publicUrl;

    // Create order
    const { error: orderErr } = await supabase.from('top_orders').insert({
      landlord_id: user?.id,
      room_id: selectedRoom.id,
      package_id: selectedPkg.id,
      package_name: selectedPkg.name,
      price: selectedPkg.price,
      bill_url: billUrl,
      duration_days: selectedPkg.duration_days,
    });
    if (orderErr) { toast({ title: 'Lỗi tạo đơn', variant: 'destructive' }); setSubmitting(false); return; }

    // Send message to admin
    const adminId = await findAdminUser();
    if (adminId) {
      const msg = `⭐ YÊU CẦU ĐƯA TRỌ LÊN TOP

Gói dịch vụ: ${selectedPkg.name}
Số tiền: ${new Intl.NumberFormat('vi-VN').format(selectedPkg.price)}đ

🏠 Thông tin trọ:
Tên: ${selectedRoom.title}
Địa chỉ: ${selectedRoom.address_detail}

📎 Bill thanh toán:
${billUrl}`;
      await sendMessage(adminId, msg);
    }

    toast({ title: 'Đã gửi thanh toán!', description: 'Admin sẽ duyệt trong thời gian sớm nhất.' });
    setSubmitting(false);
    onOpenChange(false);
  };

  const formatPrice = (p: number) => new Intl.NumberFormat('vi-VN').format(p) + 'đ';

  const goBack = () => {
    switch (step) {
      case 'detail': setStep('packages'); break;
      case 'select-room': setStep('detail'); break;
      case 'payment': setStep('select-room'); break;
      case 'upload-bill': setStep('payment'); break;
      default: onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              {step !== 'packages' && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}><ArrowLeft className="w-4 h-4" /></Button>
              )}
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                {step === 'packages' && 'Đưa trọ lên top'}
                {step === 'detail' && selectedPkg?.name}
                {step === 'select-room' && 'Chọn trọ'}
                {step === 'payment' && 'Thông tin thanh toán'}
                {step === 'upload-bill' && 'Gửi thanh toán'}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <AnimatePresence mode="wait">
                {/* STEP 1: Package List */}
                {step === 'packages' && (
                  <motion.div key="packages" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    {packages.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Chưa có gói dịch vụ nào</p>
                      </div>
                    ) : (
                      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'thin' }}>
                        {packages.map(pkg => (
                          <Card key={pkg.id} className="min-w-[260px] max-w-[280px] snap-center shrink-0 border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
                            <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                <h4 className="font-bold">{pkg.name}</h4>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{pkg.features}</p>
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />{pkg.duration_days} ngày</Badge>
                                <span className="text-lg font-bold text-primary">{formatPrice(pkg.price)}</span>
                              </div>
                              <Button className="w-full gap-2" variant="outline" onClick={() => handleViewDetail(pkg)}>
                                <Eye className="w-4 h-4" />Xem chi tiết
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* STEP 2: Package Detail */}
                {step === 'detail' && selectedPkg && (
                  <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    <Card className="border-2 border-primary/20">
                      <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                          <h3 className="text-xl font-bold">{selectedPkg.name}</h3>
                        </div>
                        {selectedPkg.description && <p className="text-sm text-muted-foreground">{selectedPkg.description}</p>}
                        <div>
                          <Label className="text-muted-foreground">Tính năng</Label>
                          <p className="font-medium">{selectedPkg.features}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-muted-foreground">Thời gian</Label>
                            <p className="font-medium">{selectedPkg.duration_days} ngày</p>
                          </div>
                          <div className="text-right">
                            <Label className="text-muted-foreground">Giá</Label>
                            <p className="text-2xl font-bold text-primary">{formatPrice(selectedPkg.price)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Button className="w-full gap-2" size="lg" onClick={handleOrderPkg}>
                      <CreditCard className="w-4 h-4" />Đặt dịch vụ
                    </Button>
                  </motion.div>
                )}

                {/* STEP 3: Select Room */}
                {step === 'select-room' && (
                  <motion.div key="select-room" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                    <h4 className="font-semibold text-muted-foreground">Trọ của tôi</h4>
                    {rooms.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Home className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>Bạn chưa có phòng trọ nào</p>
                      </div>
                    ) : (
                      rooms.map(room => (
                        <Card key={room.id} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md" onClick={() => handleSelectRoom(room)}>
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                              {room.images?.[0] ? (
                                <img src={room.images[0]} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Home className="w-6 h-6 text-muted-foreground" /></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h5 className="font-semibold truncate">{room.title}</h5>
                              <p className="text-sm text-muted-foreground truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{room.address_detail}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </motion.div>
                )}

                {/* STEP 4: Payment Info */}
                {step === 'payment' && (
                  <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    <h4 className="font-semibold">Thông tin thanh toán</h4>
                    {paySettings ? (
                      <ScrollArea className="max-h-[50vh]">
                        <Card>
                          <CardContent className="p-4 space-y-3">
                            <div className="grid gap-2 text-sm">
                              <div><span className="text-muted-foreground">Ngân hàng:</span> <span className="font-medium">{paySettings.bank_name}</span></div>
                              <div><span className="text-muted-foreground">Số TK:</span> <span className="font-mono font-medium">{paySettings.account_number}</span></div>
                              <div><span className="text-muted-foreground">Chủ TK:</span> <span className="font-medium">{paySettings.account_holder}</span></div>
                              {paySettings.transfer_template && <div><span className="text-muted-foreground">Nội dung CK:</span> <span className="font-medium">{paySettings.transfer_template}</span></div>}
                            </div>
                            {paySettings.qr_image_url && (
                              <div className="mt-3">
                                <p className="text-sm text-muted-foreground mb-2">QR thanh toán:</p>
                                <img
                                  src={paySettings.qr_image_url}
                                  alt="QR"
                                  className="w-48 h-48 mx-auto object-contain rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => setQrOverlay(true)}
                                />
                              </div>
                            )}
                            <div className="pt-3 border-t space-y-2">
                              <p className="text-sm font-medium">Gói: {selectedPkg?.name}</p>
                              <p className="text-sm font-bold text-primary">Số tiền: {selectedPkg ? formatPrice(selectedPkg.price) : ''}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>Admin chưa thiết lập thông tin thanh toán</p>
                      </div>
                    )}
                    {paySettings && (
                      <Button className="w-full gap-2" size="lg" onClick={() => setStep('upload-bill')}>
                        <Upload className="w-4 h-4" />Gửi thanh toán
                      </Button>
                    )}
                  </motion.div>
                )}

                {/* STEP 5: Upload Bill */}
                {step === 'upload-bill' && (
                  <motion.div key="upload-bill" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                    <h4 className="font-semibold">Tải bill thanh toán</h4>
                    <input ref={billInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleBillChange} />
                    <Button variant="outline" className="w-full gap-2 h-24 border-dashed border-2" onClick={() => billInputRef.current?.click()}>
                      <Upload className="w-6 h-6" />
                      <span>{billFile ? 'Chọn lại ảnh' : 'Chọn ảnh bill (JPG, PNG)'}</span>
                    </Button>
                    {billPreview && (
                      <div className="relative">
                        <img src={billPreview} alt="Bill" className="w-full max-h-64 object-contain rounded-lg border" />
                        <Button variant="outline" size="icon" className="absolute top-2 right-2" onClick={() => { setBillFile(null); setBillPreview(null); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                      <p><span className="text-muted-foreground">Gói:</span> <span className="font-medium">{selectedPkg?.name}</span></p>
                      <p><span className="text-muted-foreground">Trọ:</span> <span className="font-medium">{selectedRoom?.title}</span></p>
                      <p><span className="text-muted-foreground">Số tiền:</span> <span className="font-bold text-primary">{selectedPkg ? formatPrice(selectedPkg.price) : ''}</span></p>
                    </div>
                    <Button className="w-full gap-2" size="lg" onClick={handleSubmitPayment} disabled={!billFile || submitting}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Gửi thanh toán
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Overlay */}
      <AnimatePresence>
        {qrOverlay && paySettings?.qr_image_url && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setQrOverlay(false)}
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative">
              <Button variant="outline" size="icon" className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white border-white/20" onClick={() => setQrOverlay(false)}>
                <X className="w-5 h-5" />
              </Button>
              <img src={paySettings.qr_image_url} alt="QR" className="max-w-full max-h-[85vh] object-contain rounded-xl" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
