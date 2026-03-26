// @ts-nocheck
import { createPortal } from "react-dom";
import { 
  X,
  Loader2,
  Plus,
  Building2,
  Mail,
  MapPin,
  Phone,
  DollarSign,
  Maximize,
  UserCircle,
  Edit,
  MessageCircle,
  Eye,
  Users,
  Trash2,
  Star,
  Clock
} from "lucide-react";
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { MediaUpload } from '@/components/MediaUpload';
import { PriceInput } from '@/components/PriceInput';
import { AmenitiesSelector } from '@/components/AmenitiesSelector';
import { LocationCapture } from '@/components/LocationCapture';
import { useSavedProfile } from '@/components/ProfileSettingsDialog';
import { ChatPanel } from '@/components/ChatPanel';
import { LandlordTopRoom } from '@/components/LandlordTopRoom';
import { LandlordTopHistory } from '@/components/LandlordTopHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
interface Room {
  id: string;
  title: string;
  room_number: string;
  room_code?: string;
  description: string | null;
  price: number;
  area: number | null;
  province: string;
  district: string;
  ward: string;
  address_detail: string;
  phone: string;
  amenities: string[] | null;
  images: string[] | null;
  videos: string[] | null;
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  tenant_id: string | null;
}

interface TenantInfo {
  user_id: string;
  full_name: string;
  phone: string | null;
}

interface ForwardedRequest {
  id: string;
  room_id: string;
  message: string | null;
  status: string;
  admin_note: string | null;
  landlord_viewed: boolean;
  created_at: string;
  tenant: {
    full_name: string;
    phone: string | null;
  };
  room_info?: {
    title: string;
    room_number: string;
    room_code?: string;
    price: number;
    address_detail: string;
    images?: string[];
  };
}

interface CustomService {
  name: string;
  cost: string;
}

interface FormData {
  title: string;
  room_number: string;
  description: string;
  price: string;
  area: string;
  phone: string;
  address: string;
  electricity_cost: string;
  water_cost: string;
  water_cost_type: 'per_m3' | 'per_month';
  custom_services: CustomService[];
  contract_content: string;
  deposit_amount: string;
}

const initialFormData: FormData = {
  title: '',
  room_number: '',
  description: '',
  price: '',
  area: '',
  phone: '',
  address: '',
  electricity_cost: '',
  water_cost: '',
  water_cost_type: 'per_m3',
  custom_services: [],
  contract_content: '',
  deposit_amount: '',
};

export default function LandlordDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { getSavedProfile } = useSavedProfile();
  const { findAdminUser, sendMessage } = useMessages();
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [forwardedRequests, setForwardedRequests] = useState<ForwardedRequest[]>([]);
  const [tenantMap, setTenantMap] = useState<Map<string, TenantInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<ForwardedRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUserId, setChatUserId] = useState<string | null>(null);
  const [removeTenantSubmitting, setRemoveTenantSubmitting] = useState(false);
  const [topRoomOpen, setTopRoomOpen] = useState(false);
  const [topHistoryOpen, setTopHistoryOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedVideos, setUploadedVideos] = useState<string[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (user && role === 'landlord') {
      fetchData();
    }
  }, [user, role]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch my rooms
    const { data: rooms } = await supabase
      .from('rooms')
      .select('*')
      .eq('landlord_id', user?.id)
      .order('created_at', { ascending: false });

    if (rooms) {
      setMyRooms(rooms as Room[]);

      // Fetch tenant profiles for rooms with tenants
      const tenantIds = rooms.filter((r: any) => r.tenant_id).map((r: any) => r.tenant_id);
      if (tenantIds.length > 0) {
        const { data: tenantProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', tenantIds);
        
        const map = new Map<string, TenantInfo>();
        (tenantProfiles || []).forEach(p => {
          map.set(p.user_id, { user_id: p.user_id, full_name: p.full_name, phone: p.phone });
        });
        setTenantMap(map);
      }
    }

    // Fetch forwarded requests with tenant profiles
    const { data: requests, error: requestsError } = await supabase
      .from('room_requests')
      .select(`
        *,
        rooms!inner (id, title, room_number, room_code, landlord_id, price, address_detail, images)
      `)
      .eq('status', 'forwarded');

    if (requests && !requestsError) {
      const myRequests = requests.filter((r: any) => r.rooms.landlord_id === user?.id);
      
      const tenantIds = [...new Set(myRequests.map((r: any) => r.tenant_id))];
      let tenantProfiles = [];

      if (tenantIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', tenantIds);
      
        tenantProfiles = data || [];
      }

      const profileMap = new Map(
        (tenantProfiles || []).map(p => [p.user_id, { full_name: p.full_name, phone: p.phone }])
      );

      const formattedRequests = myRequests.map((r: any) => ({
        ...r,
        tenant: profileMap.get(r.tenant_id) || { full_name: 'Không xác định', phone: null },
        room_info: {
          title: r.rooms.title,
          room_number: r.rooms.room_number,
          room_code: r.rooms.room_code,
          price: r.rooms.price,
          address_detail: r.rooms.address_detail,
          images: r.rooms.images,
        },
      }));
      setForwardedRequests(formattedRequests);
    }

    setLoading(false);
  };

  const handleViewRequest = async (request: ForwardedRequest) => {
    // Mark as viewed
    if (!request.landlord_viewed) {
      await supabase
        .from('room_requests')
        .update({ landlord_viewed: true })
        .eq('id', request.id);
      
      // Update local state
      setForwardedRequests(prev =>
        prev.map(r => r.id === request.id ? { ...r, landlord_viewed: true } : r)
      );
    }
    
    setSelectedRequestDetail({ ...request, landlord_viewed: true });
    setDetailDialogOpen(true);
  };

  const handleMessageAdmin = async () => {
    const adminId = await findAdminUser();
    if (adminId && selectedRequestDetail) {
      // Send auto-message with room info
      const roomInfo = selectedRequestDetail.room_info;
      const autoMessage = t('autoMsgLandlordReply', {
        roomNumber: roomInfo?.room_number || 'N/A',
        roomCode: roomInfo?.room_code || 'N/A',
        roomTitle: roomInfo?.title || 'N/A',
        roomPrice: roomInfo?.price ? new Intl.NumberFormat('vi-VN').format(roomInfo.price) + 'đ/tháng' : 'N/A',
        roomAddress: roomInfo?.address_detail || 'N/A',
        tenantName: selectedRequestDetail.tenant?.full_name || 'N/A',
      });

      await sendMessage(adminId, autoMessage);

      setDetailDialogOpen(false);
      setChatUserId(adminId);
      setChatOpen(true);
    } else {
      toast({
        title: 'Lỗi',
        description: 'Không tìm thấy Admin.',
        variant: 'destructive',
      });
    }
  };

  const handleAutoFillProfile = async () => {
    const profile = await getSavedProfile();
    if (profile) {
      setFormData(prev => ({
        ...prev,
        phone: profile.phone || prev.phone,
        address: profile.address || prev.address,
      }));
      toast({
        title: 'Đã điền thông tin!',
        description: 'Thông tin cá nhân đã được điền tự động.',
      });
    } else {
      toast({
        title: 'Chưa có thông tin',
        description: 'Vui lòng cập nhật thông tin cá nhân trong phần Cài đặt.',
        variant: 'destructive',
      });
    }
  };

  const validateForm = (): boolean => {
    if (!formData.title || !formData.room_number || !formData.price || !formData.phone || !formData.address) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ các trường bắt buộc',
        variant: 'destructive',
      });
      return false;
    }

    if (!location) {
      toast({
        title: 'Thiếu vị trí',
        description: 'Vui lòng bật định vị để lấy tọa độ phòng trọ',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleAddRoom = async () => {
    if (!validateForm()) return;

    setSubmitting(true);

    const customServicesJson = formData.custom_services.filter(s => s.name && s.cost).length > 0
      ? formData.custom_services.filter(s => s.name && s.cost).map(s => ({ name: s.name, cost: Number(s.cost) }))
      : null;

    const { error } = await supabase.from('rooms').insert({
   
      landlord_id: user?.id,
      title: formData.title,
      room_number: formData.room_number,
      room_code: '',
      description: formData.description || null,
      price: parseFloat(formData.price),
      area: formData.area ? parseFloat(formData.area) : null,
      province: '',
      district: '',
      ward: '',
      address_detail: formData.address,
      phone: formData.phone,
      amenities: amenities.length > 0 ? amenities : null,
      images: uploadedImages.length > 0 ? uploadedImages : null,
      videos: uploadedVideos.length > 0 ? uploadedVideos : null,
      latitude: location?.lat || null,
      longitude: location?.lng || null,
      electricity_cost: formData.electricity_cost ? parseFloat(formData.electricity_cost) : null,
      water_cost: formData.water_cost ? parseFloat(formData.water_cost) : null,
      water_cost_type: formData.water_cost_type,
      custom_services: customServicesJson,
      contract_content: formData.contract_content || null,
      deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : null,
    } as any);

    setSubmitting(false);

    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể thêm phòng. Vui lòng thử lại.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Thành công!',
        description: 'Phòng trọ đã được thêm.',
      });
      setAddDialogOpen(false);
      resetForm();
      fetchData();
    }
  };

  const handleEditRoom = (room: Room) => {
    if (!room.is_available) {
      toast({
        title: 'Không thể chỉnh sửa',
        description: 'Không thể chỉnh sửa phòng đã có người thuê',
        variant: 'destructive',
      });
      return;
    }

    setEditingRoom(room);
    const roomAny = room as any;
    setFormData({
      title: room.title,
      room_number: room.room_number,
      description: room.description || '',
      price: room.price.toString(),
      area: room.area?.toString() || '',
      phone: room.phone,
      address: room.address_detail,
      electricity_cost: roomAny.electricity_cost?.toString() || '',
      water_cost: roomAny.water_cost?.toString() || '',
      water_cost_type: roomAny.water_cost_type || 'per_m3',
      custom_services: roomAny.custom_services
        ? (roomAny.custom_services as any[]).map((s: any) => ({ name: s.name, cost: s.cost?.toString() || '' }))
        : [],
      contract_content: roomAny.contract_content || '',
      deposit_amount: roomAny.deposit_amount?.toString() || '',
    });
    setAmenities(room.amenities || []);
    setUploadedImages(room.images || []);
    setUploadedVideos(room.videos || []);
    setLocation(room.latitude && room.longitude ? { lat: room.latitude, lng: room.longitude } : null);
    setEditDialogOpen(true);
  };

  const handleUpdateRoom = async () => {
    if (!editingRoom) return;
    
    if (!formData.title || !formData.room_number || !formData.price || !formData.phone || !formData.address) {
      toast({
        title: 'Thiếu thông tin',
        description: 'Vui lòng điền đầy đủ các trường bắt buộc',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const customServicesJson = formData.custom_services.filter(s => s.name && s.cost).length > 0
      ? formData.custom_services.filter(s => s.name && s.cost).map(s => ({ name: s.name, cost: Number(s.cost) }))
      : null;

    const { error } = await supabase
      .from('rooms')
      .update({
        title: formData.title,
        room_number: formData.room_number,
        description: formData.description || null,
        price: parseFloat(formData.price),
        area: formData.area ? parseFloat(formData.area) : null,
        address_detail: formData.address,
        phone: formData.phone,
        amenities: amenities.length > 0 ? amenities : null,
        images: uploadedImages.length > 0 ? uploadedImages : null,
        videos: uploadedVideos.length > 0 ? uploadedVideos : null,
        latitude: location?.lat || editingRoom.latitude,
        longitude: location?.lng || editingRoom.longitude,
        electricity_cost: formData.electricity_cost ? parseFloat(formData.electricity_cost) : null,
        water_cost: formData.water_cost ? parseFloat(formData.water_cost) : null,
        water_cost_type: formData.water_cost_type,
        custom_services: customServicesJson,
        contract_content: formData.contract_content || null,
        deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : null,
      } as any)
      .eq('id', editingRoom.id);

    setSubmitting(false);

    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật phòng.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Thành công!',
        description: 'Phòng trọ đã được cập nhật.',
      });
      setEditDialogOpen(false);
      setEditingRoom(null);
      resetForm();
      fetchData();
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setAmenities([]);
    setUploadedImages([]);
    setUploadedVideos([]);
    setLocation(null);
  };

  const toggleRoomAvailability = async (roomId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('rooms')
      .update({ is_available: !currentStatus })
      .eq('id', roomId);

    if (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể cập nhật trạng thái phòng',
        variant: 'destructive',
      });
    } else {
      fetchData();
    }
  };

  const handleRequestRemoveTenant = async (room: Room) => {
    setRemoveTenantSubmitting(true);
    const adminId = await findAdminUser();
    if (!adminId) {
      toast({ title: 'Lỗi', description: 'Không tìm thấy Admin.', variant: 'destructive' });
      setRemoveTenantSubmitting(false);
      return;
    }

    const tenantInfo = room.tenant_id ? tenantMap.get(room.tenant_id) : null;
    const autoMessage = `🗑️ Yêu cầu xoá người thuê

🏠 Thông tin phòng:
- Phòng: ${room.room_number}
- Mã phòng: ${room.room_code || 'N/A'}
- Tiêu đề: ${room.title}
- Giá: ${new Intl.NumberFormat('vi-VN').format(room.price)}đ/tháng
- Địa chỉ: ${room.address_detail}

👤 Người thuê hiện tại: ${tenantInfo?.full_name || 'Không xác định'}
📞 SĐT: ${tenantInfo?.phone || 'N/A'}

Tôi muốn xoá người thuê khỏi phòng này. Vui lòng xác nhận.`;

    await sendMessage(adminId, autoMessage);
    setRemoveTenantSubmitting(false);

    toast({ title: 'Đã gửi!', description: 'Yêu cầu xoá người thuê đã được gửi đến Admin.' });
    setChatUserId(adminId);
    setChatOpen(true);
  };

  const handleRequestDeleteRoom = async (room: Room) => {
    const adminId = await findAdminUser();
    if (!adminId) {
      toast({ title: 'Lỗi', description: 'Không tìm thấy Admin.', variant: 'destructive' });
      return;
    }

    const tenantInfo = room.tenant_id ? tenantMap.get(room.tenant_id) : null;
    const autoMessage = `🗑️ YÊU CẦU XÓA PHÒNG TRỌ

🏠 Thông tin phòng cần xóa:
━━━━━━━━━━━━━━━━━━━━━
📍 Phòng: ${room.room_number}
🏷️ Mã phòng: ${room.room_code || 'N/A'}
📝 Tiêu đề: ${room.title}
💰 Giá: ${new Intl.NumberFormat('vi-VN').format(room.price)}đ/tháng
📐 Diện tích: ${room.area ? room.area + ' m²' : 'N/A'}
📞 SĐT liên hệ: ${room.phone}
🗺️ Địa chỉ: ${room.address_detail}
${room.tenant_id ? `\n👤 Người thuê hiện tại: ${tenantInfo?.full_name || 'Không xác định'}\n📱 SĐT người thuê: ${tenantInfo?.phone || 'N/A'}` : '\n✅ Trạng thái: Còn trống'}

⚠️ Tôi muốn xóa hoàn toàn phòng trọ này khỏi hệ thống. Vui lòng xem xét và xác nhận xóa.`;

    await sendMessage(adminId, autoMessage);

    toast({ 
      title: 'Đã gửi yêu cầu!', 
      description: 'Yêu cầu xóa phòng đã được gửi đến Admin. Admin sẽ xem xét và xóa phòng cho bạn.' 
    });
    setChatUserId(adminId);
    setChatOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role !== 'landlord') {
    return <Navigate to="/" replace />;
  }
  const hasUnreadRequests = forwardedRequests.some(r => !r.landlord_viewed);

  const roomFormContent = (isEdit = false) => (
    <>
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleAutoFillProfile} className="gap-2">
          <UserCircle className="h-4 w-4" />
          Lấy thông tin cá nhân
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tiêu đề *</Label>
            <Input placeholder="VD: Phòng trọ giá rẻ Quận 1" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Số phòng *</Label>
            <Input placeholder="VD: P101" value={formData.room_number} onChange={(e) => setFormData(prev => ({ ...prev, room_number: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mô tả</Label>
          <Textarea placeholder="Mô tả chi tiết về phòng..." value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PriceInput value={formData.price} onChange={(value) => setFormData(prev => ({ ...prev, price: value }))} required />
          <div className="space-y-2">
            <Label>Diện tích (m²)</Label>
            <Input type="number" placeholder="VD: 20" value={formData.area} onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Địa chỉ *</Label>
          <Input placeholder="VD: 123 Đường ABC, Phường X, Quận Y, TP.HCM" value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} />
        </div>

        <div className="space-y-2">
          <Label>Số điện thoại liên hệ *</Label>
          <Input placeholder="VD: 0901234567" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} />
        </div>

        <LocationCapture onLocationCaptured={(lat, lng) => setLocation({ lat, lng })} currentLocation={location} required={!isEdit} />
        <AmenitiesSelector value={amenities} onChange={setAmenities} />

        {/* Chi phí dịch vụ */}
        <div className="space-y-4 bg-muted/50 rounded-xl border p-5">
          <h3 className="font-semibold">Chi phí dịch vụ</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PriceInput
              value={formData.electricity_cost}
              onChange={(value) => setFormData(prev => ({ ...prev, electricity_cost: value }))}
              label="Tiền điện (VNĐ/kWh)"
              placeholder="3.500"
            />
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Label>Tiền nước</Label>
                <div className="flex rounded-md border border-input overflow-hidden text-xs">
                  <button
                    type="button"
                    className={`px-2.5 py-1 transition-colors ${formData.water_cost_type === 'per_m3' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted'}`}
                    onClick={() => setFormData(prev => ({ ...prev, water_cost_type: 'per_m3' }))}
                  >
                    VNĐ/m³
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 transition-colors ${formData.water_cost_type === 'per_month' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted'}`}
                    onClick={() => setFormData(prev => ({ ...prev, water_cost_type: 'per_month' }))}
                  >
                    VNĐ/tháng
                  </button>
                </div>
              </div>
              <PriceInput
                value={formData.water_cost}
                onChange={(value) => setFormData(prev => ({ ...prev, water_cost: value }))}
                label=""
                placeholder={formData.water_cost_type === 'per_m3' ? '15.000' : '100.000'}
              />
            </div>
          </div>
          {formData.custom_services.map((service, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Tên dịch vụ</Label>
                <Input value={service.name} onChange={(e) => setFormData(prev => ({ ...prev, custom_services: prev.custom_services.map((s, i) => i === index ? { ...s, name: e.target.value } : s) }))} placeholder="VD: Internet, Gửi xe..." />
              </div>
              <div className="w-40 space-y-1">
                <PriceInput
                  value={service.cost}
                  onChange={(value) => setFormData(prev => ({ ...prev, custom_services: prev.custom_services.map((s, i) => i === index ? { ...s, cost: value } : s) }))}
                  label="Số tiền (VNĐ)"
                  placeholder="100.000"
                />
              </div>
              <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0 mb-0.5" onClick={() => setFormData(prev => ({ ...prev, custom_services: prev.custom_services.filter((_, i) => i !== index) }))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setFormData(prev => ({ ...prev, custom_services: [...prev.custom_services, { name: '', cost: '' }] }))}>
            <Plus className="w-4 h-4" /> Thêm chi phí
          </Button>
        </div>

        {/* Hợp đồng & Tiền cọc */}
        <div className="space-y-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-5">
          <h3 className="font-semibold flex items-center gap-2">
            📋 Hợp đồng trọ & Tiền cọc
          </h3>
          <PriceInput
            value={formData.deposit_amount}
            onChange={(value) => setFormData(prev => ({ ...prev, deposit_amount: value }))}
            label="Tiền cọc (VNĐ)"
            placeholder="VD: 2.000.000"
          />
          <div className="space-y-2">
            <Label>Nội dung hợp đồng (nếu có)</Label>
            <Textarea
              placeholder="Nhập nội dung hợp đồng trọ: thời hạn, quy định, điều khoản..."
              value={formData.contract_content}
              onChange={(e) => setFormData(prev => ({ ...prev, contract_content: e.target.value }))}
              rows={6}
              className="resize-y"
            />
          </div>
        </div>

        <MediaUpload label="Ảnh phòng" accept="image/*" type="image" onUploadComplete={setUploadedImages} existingUrls={uploadedImages} />
        <MediaUpload label="Video phòng" accept="video/*" type="video" onUploadComplete={setUploadedVideos} existingUrls={uploadedVideos} />
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard Chủ trọ</h1>
            <div className="overflow-hidden whitespace-nowrap w-full">
              <p className="text-muted-foreground inline-block animate-marquee sm:animate-none">
                Quản lý phòng trọ và xem yêu cầu từ Admin
              </p>
            </div>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-primary hover:opacity-90
                ml-auto
                h-8 px-2.5 text-xs
                sm:h-10 sm:px-4 sm:text-sm"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                Thêm phòng
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Thêm phòng trọ mới</DialogTitle>
                <DialogDescription>Điền thông tin chi tiết về phòng trọ của bạn</DialogDescription>
              </DialogHeader>
              {roomFormContent()}
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Hủy</Button>
                <Button onClick={handleAddRoom} disabled={submitting} className="bg-gradient-primary hover:opacity-90">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Thêm phòng
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditingRoom(null); resetForm(); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Chỉnh sửa phòng trọ</DialogTitle>
              <DialogDescription>Cập nhật thông tin phòng trọ của bạn</DialogDescription>
            </DialogHeader>
            {roomFormContent(true)}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Hủy</Button>
              <Button onClick={handleUpdateRoom} disabled={submitting} className="bg-gradient-primary hover:opacity-90">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cập nhật
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

       <Tabs defaultValue="rooms" className="space-y-6">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      
          {/* BUTTON TOP */}
          <div className="flex gap-2 order-1 sm:order-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs sm:text-sm px-3 py-1.5
              border-amber-600 text-amber-800 bg-amber-50
              hover:bg-amber-600 hover:text-white font-semibold"
              onClick={() => setTopRoomOpen(true)}
            >
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              Đưa trọ lên top
            </Button>
      
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs sm:text-sm px-3 py-1.5"
              onClick={() => setTopHistoryOpen(true)}
            >
              <Clock className="h-4 w-4" />
              Lịch sử top
            </Button>
          </div>
      
          {/* TAB BUTTONS */}
          <TabsList className="order-2 sm:order-1 flex w-full sm:w-auto gap-1.5 h-10 p-1 bg-slate-200 rounded-xl">

            {/* TAB PHÒNG */}
            <TabsTrigger
              value="rooms"
              className="flex-1 justify-center rounded-lg px-2 text-sm
              data-[state=active]:bg-blue-500
              data-[state=active]:text-white
              data-[state=active]:shadow-sm"
            >
              <Building2 className="h-4 w-4 mr-1" />
          
              {/* MOBILE */}
              <span className="sm:hidden">
                Phòng trọ <span className="font-semibold">({myRooms.length})</span>
              </span>
          
              {/* DESKTOP */}
              <span className="hidden sm:inline">
                Phòng của tôi ({myRooms.length})
              </span>
            </TabsTrigger>
          
            {/* TAB YÊU CẦU */}
          <TabsTrigger
            value="requests"
            className={`flex-1 justify-center rounded-lg px-2 text-sm
            data-[state=active]:bg-red-500
            data-[state=active]:text-white
            data-[state=active]:shadow-sm
            ${hasUnreadRequests ? "animate-pulse" : ""}`}
          >
              <Mail className="h-4 w-4 mr-1" />
          
              {/* MOBILE */}
              <span className="sm:hidden">
                Yêu cầu <span className="font-semibold">({forwardedRequests.length})</span>
              </span>
          
              {/* DESKTOP */}
              <span className="hidden sm:inline">
                Yêu cầu từ Admin ({forwardedRequests.length})
              </span>
            </TabsTrigger>
          
          </TabsList>
      
        </div>
              

          <TabsContent value="rooms">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : myRooms.length > 0 ? (
              <div className="grid gap-4">
                {myRooms.map((room) => (
                  <Card key={room.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="flex flex-wrap items-center gap-2">
                            <span className="truncate">{room.title}</span>
                            <Badge
                              className={
                                room.is_available
                                  ? "flex items-center text-xs px-2 py-1 bg-blue-600 text-white border-blue-600"
                                  : "flex items-center text-xs px-2 py-1 bg-gray-100 text-gray-600 border border-gray-200"
                              }
                            >
                              {room.is_available ? "✅ Còn phòng" : "🔒 Đã thuê"}
                            </Badge>
                          </CardTitle>
                          <CardDescription>Phòng: {room.room_number}</CardDescription>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 flex-wrap">
                          {room.is_available && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => handleEditRoom(room)}>
                                <Edit className="h-4 w-4 mr-1" />Sửa
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => toggleRoomAvailability(room.id, room.is_available)}>
                                Đánh dấu đã thuê
                              </Button>
                            </>
                          )}
                          {!room.is_available && room.tenant_id && (
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              disabled={removeTenantSubmitting}
                              onClick={() => handleRequestRemoveTenant(room)}
                            >
                              {removeTenantSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                              Gửi yêu cầu xoá người thuê
                            </Button>
                          )}
                          {!room.is_available && !room.tenant_id && (
                            <Button variant="outline" size="sm" onClick={() => toggleRoomAvailability(room.id, room.is_available)}>
                              Đánh dấu còn phòng
                            </Button>
                          )}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Xóa phòng
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Gửi yêu cầu xóa phòng?</DialogTitle>
                                <DialogDescription>
                                  Bạn không thể tự xóa phòng. Hệ thống sẽ gửi yêu cầu xóa phòng tới Admin để xem xét và xóa giúp bạn.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-2 py-4 bg-muted/50 rounded-lg p-4">
                                <p className="text-sm font-medium">Thông tin phòng sẽ xóa:</p>
                                <p className="text-sm">• Phòng: <span className="font-semibold">{room.room_number}</span></p>
                                <p className="text-sm">• Tiêu đề: <span className="font-semibold">{room.title}</span></p>
                                <p className="text-sm">• Giá: <span className="font-semibold">{new Intl.NumberFormat('vi-VN').format(room.price)}đ/tháng</span></p>
                                {room.tenant_id && (
                                  <p className="text-sm text-destructive">⚠️ Phòng này đang có người thuê</p>
                                )}
                              </div>
                              <DialogFooter className="gap-2">
                                <DialogTrigger asChild>
                                  <Button variant="outline">Hủy</Button>
                                </DialogTrigger>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="destructive" 
                                    onClick={() => handleRequestDeleteRoom(room)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Gửi yêu cầu xóa
                                  </Button>
                                </DialogTrigger>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded-md w-fit">
                          <DollarSign className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span className="font-bold text-lg text-emerald-700 dark:text-emerald-400">
                            {new Intl.NumberFormat('vi-VN').format(room.price)}đ/tháng
                          </span>
                        </div>
                        {room.area && (
                          <div className="flex items-center gap-2">
                            <Maximize className="h-4 w-4 text-primary flex-shrink-0" />
                            <span>{room.area} m²</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{room.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="truncate">{room.address_detail || `${room.district}, ${room.province}`}</span>
                        </div>
                      </div>
                      
                      {room.amenities && room.amenities.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1">
                          {room.amenities.map((amenity, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{amenity}</Badge>
                          ))}
                        </div>
                      )}
                      
                      {room.images && room.images.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground mb-2">Ảnh: {room.images.length}</p>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {room.images.slice(0, 4).map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                onError={(e) => (e.currentTarget.style.display = "none")}
                                alt={`Room ${idx + 1}`} className="h-16 w-16 object-cover rounded-md flex-shrink-0" />
                            ))}
                            {room.images.length > 4 && (
                              <div className="h-16 w-16 bg-muted rounded-md flex items-center justify-center text-sm text-muted-foreground flex-shrink-0">
                                +{room.images.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Show tenant info if room is rented */}
                      {room.tenant_id && tenantMap.has(room.tenant_id) && (
                        <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">Người thuê</span>
                          </div>
                          <p className="text-sm">{tenantMap.get(room.tenant_id)?.full_name}</p>
                          {tenantMap.get(room.tenant_id)?.phone && (
                            <p className="text-sm text-muted-foreground">{tenantMap.get(room.tenant_id)?.phone}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Bạn chưa có phòng trọ nào.</p>
                <Button onClick={() => setAddDialogOpen(true)} className="bg-gradient-primary hover:opacity-90">
                  <Plus className="h-4 w-4 mr-2" />Thêm phòng
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : forwardedRequests.length > 0 ? (
              <div className="space-y-4">
                {[...forwardedRequests].sort((a, b) => Number(a.landlord_viewed) - Number(b.landlord_viewed)).map((request) => (
                  <Card 
                    key={request.id} 
                    className={request.landlord_viewed ? 'opacity-60' : ''}
                  >
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            Yêu cầu thuê phòng
                            {request.landlord_viewed && (
                              <Badge variant="outline" className="text-xs">Đã xem</Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            Từ: {request.tenant?.full_name || 'N/A'} | Phòng: {request.room_info?.room_number}
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleViewRequest(request)}
                          className="bg-gradient-primary hover:opacity-90 text-xs sm:text-sm px-3 py-2"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {request.landlord_viewed ? 'Xem lại' : 'Xem yêu cầu'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {request.room_info && (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="font-medium">{request.room_info.title}</p>
                            <p className="text-primary font-semibold">
                              {new Intl.NumberFormat('vi-VN').format(request.room_info.price)}đ/tháng
                            </p>
                          </div>
                        )}
                        <p className="text-muted-foreground">
                          Nhận lúc: {new Date(request.created_at).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Chưa có yêu cầu nào từ Admin.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Request Detail Dialog */}
      <Dialog 
        open={detailDialogOpen} 
        onOpenChange={setDetailDialogOpen}
        modal={!previewImage}
      >
       <DialogContent
        className="max-w-lg h-[90vh] flex flex-col"
        onInteractOutside={(e) => {
          if (previewImage) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (previewImage) e.preventDefault()
        }}
      >
          <DialogHeader>
            <DialogTitle>Chi tiết yêu cầu thuê phòng</DialogTitle>
          </DialogHeader>
          
          {selectedRequestDetail && (
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scroll">
              {selectedRequestDetail.room_info && (
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Thông tin phòng trọ
                  </h4>
              
                  <p className="font-medium">{selectedRequestDetail.room_info.title}</p>
              
                  <p className="text-sm">
                    Số phòng: {selectedRequestDetail.room_info.room_number}
                  </p>
              
                  {selectedRequestDetail.room_info.room_code && (
                    <p className="text-sm">
                      Mã phòng:
                      <span className="font-mono font-semibold ml-1">
                        {selectedRequestDetail.room_info.room_code}
                      </span>
                    </p>
                  )}
              
                  <div className="inline-block bg-gradient-primary text-white px-3 py-1 rounded-md">
                    <span className="font-bold">
                      {new Intl.NumberFormat('vi-VN').format(selectedRequestDetail.room_info.price)}đ
                    </span>
                    <span className="text-sm opacity-90">/tháng</span>
                  </div>
              
                  {/* ẢNH PHÒNG */}
                  {selectedRequestDetail.room_info?.images?.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/30 hover:scrollbar-thumb-muted-foreground/50">
                      {selectedRequestDetail.room_info.images.map((img: string, i: number) => (
                        <img
                          key={i}
                          src={img}
                          onClick={() => setPreviewImage(img)}
                          className="h-16 w-16 object-cover rounded-md cursor-pointer hover:scale-105 transition flex-shrink-0"
                        />
                      ))}
                    </div>
                  )}
                                
                  {selectedRequestDetail.room_info.address_detail && (
                    <p className="text-sm flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      {selectedRequestDetail.room_info.address_detail}
                    </p>
                  )}
                </div>
              )}
            

              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-semibold">Thông tin người thuê</h4>
                <p><strong>Họ tên:</strong> {selectedRequestDetail.tenant?.full_name}</p>
                {selectedRequestDetail.tenant?.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    {selectedRequestDetail.tenant.phone}
                  </p>
                )}
                {selectedRequestDetail.message && (
                  <p className="text-sm"><strong>Lời nhắn:</strong> {selectedRequestDetail.message}</p>
                )}
              </div>

              {selectedRequestDetail.admin_note && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm text-primary"><strong>Ghi chú từ Admin:</strong> {selectedRequestDetail.admin_note}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Nhận lúc: {new Date(selectedRequestDetail.created_at).toLocaleString('vi-VN')}
              </p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 border-t bg-background flex-shrink-0">
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Đóng</Button>
            <Button onClick={handleMessageAdmin} className="bg-gradient-primary hover:opacity-90">
              <MessageCircle className="h-4 w-4 mr-2" />
              Nhắn tin Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Panel */}
      {/* Chat Panel */}
    <ChatPanel 
      open={chatOpen} 
      onOpenChange={setChatOpen}
      initialUserId={chatUserId || undefined}
    />
    <LandlordTopRoom open={topRoomOpen} onOpenChange={setTopRoomOpen} />
    <LandlordTopHistory open={topHistoryOpen} onOpenChange={setTopHistoryOpen} />
    
    {/* MODAL XEM ẢNH FULL */}
   {previewImage &&
    createPortal(
      <div
        className="fixed inset-0 bg-black/95 flex items-center justify-center z-[999999]"
        onClick={(e) => {
          e.stopPropagation();   // CHẶN sự kiện tới Dialog
          setPreviewImage(null); // chỉ đóng ảnh
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPreviewImage(null);
          }}
          className="absolute top-6 right-6 z-[1000000] bg-black/70 text-white p-3 rounded-full"
        >
          ✕
        </button>
  
        <img
          src={previewImage}
          className="max-h-[90vh] max-w-[90vw] rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>,
      document.body
    )}

</div>
);
}
