// @ts-nocheck
import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Search, Loader2, UserMinus, Trash2, ChevronDown, ChevronUp, User, History, Upload, X, Image as ImageIcon, Eye, Calendar, FileText, Filter, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Room {
  id: string;
  title: string;
  room_number: string;
  room_code: string;
  price: number;
  province: string;
  district: string;
  is_available: boolean;
  landlord: { full_name: string; display_id: string | null } | null;
  tenant_id: string | null;
}

interface TenantProfile {
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  display_id?: string | null;
}

interface RemovalRecord {
  id: string;
  room_id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  reason: string;
  evidence_urls: string[];
  created_at: string;
  room_title?: string;
  room_number?: string;
  room_code?: string;
  tenant_display_id?: string | null;
}

interface Props {
  rooms: Room[];
  loading: boolean;
  onRefresh: () => void;
}

export default function AdminRoomsTab({ rooms, loading, onRefresh }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [roomSearch, setRoomSearch] = useState('');
  const [roomStatusFilter, setRoomStatusFilter] = useState('all');
  const [deleteRoomDialogOpen, setDeleteRoomDialogOpen] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [deletingRoomLoading, setDeletingRoomLoading] = useState(false);

  // Expanded row
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [tenantProfile, setTenantProfile] = useState<TenantProfile | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(false);

  // Remove tenant with reason
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [removeEvidenceFiles, setRemoveEvidenceFiles] = useState<File[]>([]);
  const [removingTenant, setRemovingTenant] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History (per-room)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<RemovalRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyRoomTitle, setHistoryRoomTitle] = useState('');

  // Global history
  const [globalHistoryOpen, setGlobalHistoryOpen] = useState(false);
  const [globalHistoryRecords, setGlobalHistoryRecords] = useState<RemovalRecord[]>([]);
  const [loadingGlobalHistory, setLoadingGlobalHistory] = useState(false);
  const [globalHistorySearch, setGlobalHistorySearch] = useState('');
  const [globalHistoryTab, setGlobalHistoryTab] = useState('removal');
  const [tenantDisplayIds, setTenantDisplayIds] = useState<Map<string, string>>(new Map());

  // Fetch tenant display_ids for all rooms on load
  useEffect(() => {
    const tenantIds = rooms.map(r => r.tenant_id).filter(Boolean) as string[];
    if (tenantIds.length > 0) {
      supabase.from('user_settings').select('user_id, display_id').in('user_id', tenantIds).then(({ data }) => {
        const m = new Map<string, string>();
        (data || []).forEach((s: any) => { if (s.display_id) m.set(s.user_id, s.display_id); });
        setTenantDisplayIds(m);
      });
    }
  }, [rooms]);

  // Fullscreen image viewer
  const [fullscreenImages, setFullscreenImages] = useState<string[]>([]);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      const search = roomSearch.toLowerCase();
      const tenantDispId = r.tenant_id ? (tenantDisplayIds.get(r.tenant_id) || '') : '';
      const matchesSearch = !roomSearch || r.title.toLowerCase().includes(search) || r.room_number.toLowerCase().includes(search) || r.room_code?.toLowerCase().includes(search) || r.district?.toLowerCase().includes(search) || r.landlord?.full_name?.toLowerCase().includes(search) || r.landlord?.display_id?.toLowerCase().includes(search) || r.tenant_id?.toLowerCase().includes(search) || tenantDispId.toLowerCase().includes(search);
      const matchesStatus = roomStatusFilter === 'all' || (roomStatusFilter === 'available' && r.is_available) || (roomStatusFilter === 'rented' && !r.is_available);
      return matchesSearch && matchesStatus;
    });
  }, [rooms, roomSearch, roomStatusFilter]);

  const handleRowClick = async (room: Room) => {
    if (expandedRoomId === room.id) {
      setExpandedRoomId(null);
      setTenantProfile(null);
      return;
    }
    setExpandedRoomId(room.id);
    setTenantProfile(null);

    if (room.tenant_id) {
      setLoadingTenant(true);
      const [profileRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('full_name, phone, avatar_url').eq('user_id', room.tenant_id).maybeSingle(),
        supabase.from('user_settings').select('display_id').eq('user_id', room.tenant_id).maybeSingle(),
      ]);
      const profile = profileRes.data;
      setTenantProfile(profile ? { ...profile, display_id: settingsRes.data?.display_id || null } : { full_name: 'Không rõ', phone: null, avatar_url: null, display_id: null });
      setLoadingTenant(false);
    }
  };

  const handleOpenRemoveDialog = (room: Room) => {
    setRemoveReason('');
    setRemoveEvidenceFiles([]);
    setRemoveDialogOpen(true);
  };

  const handleEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setRemoveEvidenceFiles(prev => [...prev, ...files].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveEvidence = (idx: number) => {
    setRemoveEvidenceFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveTenant = async () => {
    const room = rooms.find(r => r.id === expandedRoomId);
    if (!room || !room.tenant_id || !removeReason.trim()) return;
    setRemovingTenant(true);

    // Upload evidence files
    const evidenceUrls: string[] = [];
    for (const file of removeEvidenceFiles) {
      const ext = file.name.split('.').pop();
      const path = `${room.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('removal-evidence')
        .upload(path, file);
      if (uploadData && !uploadError) {
        const { data: urlData } = supabase.storage.from('removal-evidence').getPublicUrl(path);
        evidenceUrls.push(urlData.publicUrl);
      }
    }

    // Save removal history
    await supabase.from('tenant_removal_history').insert({
      room_id: room.id,
      tenant_id: room.tenant_id,
      tenant_name: tenantProfile?.full_name || null,
      tenant_phone: tenantProfile?.phone || null,
      reason: removeReason.trim(),
      evidence_urls: evidenceUrls,
      removed_by: user?.id,
    });

    // Remove tenant from room
    const { error } = await supabase.from('rooms').update({ tenant_id: null, is_available: true }).eq('id', room.id);
    setRemovingTenant(false);

    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể xoá người thuê', variant: 'destructive' });
    } else {
      toast({ title: 'Thành công!', description: 'Đã xoá người thuê khỏi phòng.' });
      setRemoveDialogOpen(false);
      setExpandedRoomId(null);
      setTenantProfile(null);
      onRefresh();
    }
  };

  const handleViewHistory = async (room: Room) => {
    setHistoryRoomTitle(`${room.room_number} - ${room.title}`);
    setHistoryDialogOpen(true);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('tenant_removal_history')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false });
    setHistoryRecords((data as RemovalRecord[]) || []);
    setLoadingHistory(false);
  };

  const handleOpenGlobalHistory = async () => {
    setGlobalHistoryOpen(true);
    setGlobalHistorySearch('');
    setGlobalHistoryTab('removal');
    setLoadingGlobalHistory(true);
    
    const { data } = await supabase
      .from('tenant_removal_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    // Enrich with room info
    const roomIds = [...new Set((data || []).map((r: any) => r.room_id))];
    let roomMap = new Map();
    if (roomIds.length > 0) {
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('id, title, room_number, room_code')
        .in('id', roomIds);
      if (roomsData) {
        roomsData.forEach((r: any) => roomMap.set(r.id, r));
      }
    }

    // Fetch display_ids for tenants
    const tenantIds = [...new Set((data || []).map((r: any) => r.tenant_id))];
    let displayIdMap = new Map<string, string>();
    if (tenantIds.length > 0) {
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('user_id, display_id')
        .in('user_id', tenantIds);
      (settingsData || []).forEach((s: any) => {
        if (s.display_id) displayIdMap.set(s.user_id, s.display_id);
      });
    }

    const enriched = (data || []).map((r: any) => {
      const room = roomMap.get(r.room_id);
      return {
        ...r,
        room_title: room?.title || 'Phòng đã xoá',
        room_number: room?.room_number || 'N/A',
        room_code: room?.room_code || 'N/A',
        tenant_display_id: displayIdMap.get(r.tenant_id) || null,
      };
    });

    setGlobalHistoryRecords(enriched as RemovalRecord[]);
    setLoadingGlobalHistory(false);
  };

  // Get user settings for display_id lookup
  const getDisplayIds = async (tenantIds: string[]) => {
    if (tenantIds.length === 0) return new Map();
    const { data } = await supabase
      .from('user_settings')
      .select('user_id, display_id')
      .in('user_id', tenantIds);
    return new Map((data || []).map((d: any) => [d.user_id, d.display_id]));
  };

  const filteredGlobalHistory = useMemo(() => {
    if (!globalHistorySearch.trim()) return globalHistoryRecords;
    const q = globalHistorySearch.toLowerCase();
    return globalHistoryRecords.filter(r =>
      r.tenant_name?.toLowerCase().includes(q) ||
      r.tenant_phone?.toLowerCase().includes(q) ||
      r.tenant_display_id?.toLowerCase().includes(q) ||
      r.tenant_id?.toLowerCase().includes(q) ||
      r.room_number?.toLowerCase().includes(q) ||
      r.room_code?.toLowerCase().includes(q) ||
      r.room_title?.toLowerCase().includes(q)
    );
  }, [globalHistoryRecords, globalHistorySearch]);

  // Rental history (rooms with tenant_id) 
  const rentedRooms = useMemo(() => {
    return rooms.filter(r => r.tenant_id);
  }, [rooms]);

  // Fetch display_ids for rented rooms' tenants when global history opens
  useEffect(() => {
    if (globalHistoryOpen && rentedRooms.length > 0) {
      const ids = rentedRooms.map(r => r.tenant_id!).filter(Boolean);
      if (ids.length > 0) {
        supabase.from('user_settings').select('user_id, display_id').in('user_id', ids).then(({ data }) => {
          const m = new Map<string, string>();
          (data || []).forEach((s: any) => { if (s.display_id) m.set(s.user_id, s.display_id); });
          setTenantDisplayIds(m);
        });
      }
    }
  }, [globalHistoryOpen, rentedRooms]);

  const filteredRentedRooms = useMemo(() => {
    if (!globalHistorySearch.trim()) return rentedRooms;
    const q = globalHistorySearch.toLowerCase();
    return rentedRooms.filter(r => {
      const dispId = tenantDisplayIds.get(r.tenant_id!) || '';
      return r.title.toLowerCase().includes(q) ||
        r.room_number.toLowerCase().includes(q) ||
        r.room_code?.toLowerCase().includes(q) ||
        r.landlord?.full_name?.toLowerCase().includes(q) ||
        r.landlord?.display_id?.toLowerCase().includes(q) ||
        dispId.toLowerCase().includes(q) ||
        r.tenant_id?.toLowerCase().includes(q);
    });
  }, [rentedRooms, globalHistorySearch, tenantDisplayIds]);

  const openFullscreen = (urls: string[], idx: number) => {
    setFullscreenImages(urls);
    setFullscreenIndex(idx);
    setFullscreenOpen(true);
  };

  const handleDeleteRoom = async () => {
    if (!deletingRoom) return;
    setDeletingRoomLoading(true);
    const { error } = await supabase.from('rooms').delete().eq('id', deletingRoom.id);
    setDeletingRoomLoading(false);
    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể xoá phòng trọ', variant: 'destructive' });
    } else {
      toast({ title: 'Thành công!', description: `Đã xoá phòng "${deletingRoom.title}".` });
      setDeleteRoomDialogOpen(false);
      setDeletingRoom(null);
      onRefresh();
    }
  };

  return (
    <>
      <Card className="mb-4">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Tìm theo tiêu đề, mã phòng, tên/mã chủ trọ, ID người thuê..." value={roomSearch} onChange={(e) => setRoomSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={roomStatusFilter} onValueChange={setRoomStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="available">Còn phòng</SelectItem>
                <SelectItem value="rented">Đã thuê</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2 rounded-xl shrink-0" onClick={handleOpenGlobalHistory}>
              <History className="h-4 w-4" />
              Lịch sử thuê
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Tiêu đề</TableHead>
                  <TableHead className="min-w-[100px]">ID người thuê</TableHead>
                  <TableHead className="min-w-[90px]">Mã phòng</TableHead>
                  <TableHead className="min-w-[100px]">Giá</TableHead>
                  <TableHead className="min-w-[150px]">Khu vực</TableHead>
                  <TableHead className="min-w-[120px]">Chủ trọ</TableHead>
                  <TableHead className="min-w-[120px]">Mã TK chủ trọ</TableHead>
                  <TableHead className="min-w-[100px]">Trạng thái</TableHead>
                  <TableHead className="min-w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => (
                  <>
                    <TableRow
                      key={room.id}
                      className={`cursor-pointer transition-colors ${!room.is_available ? "bg-orange-50/50 dark:bg-orange-950/10 border-l-4 border-l-orange-500" : "hover:bg-muted/50"} ${expandedRoomId === room.id ? "bg-primary/5" : ""}`}
                      onClick={() => handleRowClick(room)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${room.is_available ? 'bg-green-500' : 'bg-orange-500'}`} />
                          <span className="font-medium max-w-[180px] truncate">{room.title}</span>
                          {expandedRoomId === room.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {room.tenant_id ? (
                          <Badge variant="outline" className="font-mono text-xs">{tenantDisplayIds.get(room.tenant_id) || 'N/A'}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="font-mono">{room.room_code}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{new Intl.NumberFormat('vi-VN').format(room.price)}đ</TableCell>
                      <TableCell className="max-w-[150px] truncate">{room.district}, {room.province}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{room.landlord?.full_name || 'N/A'}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{room.landlord?.display_id || 'N/A'}</Badge></TableCell>
                      <TableCell>
                        <Badge
                          variant={room.is_available ? "default" : "destructive"}
                          className={room.is_available ? "bg-green-500 hover:bg-green-600" : ""}
                        >
                          {room.is_available ? 'Còn phòng' : 'Đã thuê'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeletingRoom(room); setDeleteRoomDialogOpen(true); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Expanded panel */}
                    {expandedRoomId === room.id && (
                      <TableRow key={`${room.id}-detail`} className="hover:bg-transparent">
                        <TableCell colSpan={9} className="p-0">
                          <div className="bg-muted/20 border-t border-b border-border/50 px-6 py-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            {/* Tenant info section */}
                            {room.tenant_id ? (
                              <div className="space-y-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                                  <User className="h-4 w-4 text-primary" />
                                  Thông tin người thuê
                                </h4>
                                {loadingTenant ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
                                  </div>
                                ) : tenantProfile && (
                                  <div className="flex items-center gap-4 bg-background rounded-xl p-4 border border-border/50 shadow-sm">
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                                      {tenantProfile.avatar_url ? (
                                        <img src={tenantProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                                      ) : (
                                        <User className="h-6 w-6 text-primary" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <p className="font-semibold text-foreground">{tenantProfile.full_name}</p>
                                      <p className="text-sm text-muted-foreground">{tenantProfile.phone || 'Chưa có SĐT'}</p>
                                      {tenantProfile.display_id && (
                                        <Badge variant="outline" className="font-mono text-xs">ID: {tenantProfile.display_id}</Badge>
                                      )}
                                      <p className="text-xs text-muted-foreground">Tenant UUID: {room.tenant_id?.slice(0, 8)}...</p>
                                    </div>
                                    <div className="flex gap-2 flex-wrap shrink-0">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="gap-1.5 rounded-xl"
                                        onClick={(e) => { e.stopPropagation(); handleOpenRemoveDialog(room); }}
                                      >
                                        <UserMinus className="h-3.5 w-3.5" />
                                        Xoá khỏi trọ
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1.5 rounded-xl"
                                        onClick={(e) => { e.stopPropagation(); handleViewHistory(room); }}
                                      >
                                        <History className="h-3.5 w-3.5" />
                                        Lịch sử thuê
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 bg-background rounded-xl p-4 border border-border/50">
                                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                    <User className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                  <p className="text-sm text-muted-foreground">Phòng này hiện chưa có người thuê</p>
                                  <div className="ml-auto">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1.5 rounded-xl"
                                      onClick={(e) => { e.stopPropagation(); handleViewHistory(room); }}
                                    >
                                      <History className="h-3.5 w-3.5" />
                                      Lịch sử thuê
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Remove tenant dialog with reason & evidence */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col rounded-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <UserMinus className="h-5 w-5" />
              Xoá người thuê khỏi phòng
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">

          {tenantProfile && (
            <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                {tenantProfile.avatar_url ? (
                  <img src={tenantProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{tenantProfile.full_name}</p>
                <p className="text-xs text-muted-foreground">{tenantProfile.phone || 'Chưa có SĐT'}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Lý do xoá <span className="text-destructive">*</span></label>
              <Textarea
                value={removeReason}
                onChange={e => setRemoveReason(e.target.value)}
                placeholder="Nhập lý do xoá người thuê khỏi phòng..."
                rows={3}
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Ảnh bằng chứng (tối đa 5)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleEvidenceUpload}
              />
              <div className="flex flex-wrap gap-2">
                {removeEvidenceFiles.map((file, idx) => (
                  <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border shadow-sm">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemoveEvidence(idx)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {removeEvidenceFiles.length < 5 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px]">Tải ảnh</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 px-6 pb-6 pt-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)} className="rounded-xl">Huỷ</Button>
            <Button
              variant="destructive"
              onClick={handleRemoveTenant}
              disabled={removingTenant || !removeReason.trim()}
              className="rounded-xl gap-1.5"
            >
              {removingTenant ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
              Xác nhận xoá
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Per-room history dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col rounded-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Lịch sử xoá người thuê - {historyRoomTitle}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : historyRecords.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">Chưa có lịch sử</p>
              </div>
            ) : (
              <div className="space-y-4">
                {historyRecords.map((record, idx) => (
                  <HistoryCard key={record.id} record={record} idx={idx} total={historyRecords.length} openFullscreen={openFullscreen} />
                ))}
              </div>
            )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Global history dialog */}
      <Dialog open={globalHistoryOpen} onOpenChange={setGlobalHistoryOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col rounded-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 space-y-4">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Lịch sử thuê & xoá người thuê
            </DialogTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo ID tài khoản, tên, SĐT, mã phòng..."
                  value={globalHistorySearch}
                  onChange={e => setGlobalHistorySearch(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>
            </div>
            <Tabs value={globalHistoryTab} onValueChange={setGlobalHistoryTab}>
              <TabsList className="w-full">
                <TabsTrigger value="rental" className="flex-1 gap-1.5">
                  <Home className="h-3.5 w-3.5" />
                  Đang thuê ({filteredRentedRooms.length})
                </TabsTrigger>
                <TabsTrigger value="removal" className="flex-1 gap-1.5">
                  <UserMinus className="h-3.5 w-3.5" />
                  Lịch sử xoá ({filteredGlobalHistory.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-4">
              {globalHistoryTab === 'rental' && (
                <>
                  {filteredRentedRooms.length === 0 ? (
                    <div className="text-center py-12">
                      <Home className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground text-sm">Không có phòng nào đang thuê</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredRentedRooms.map(room => (
                        <div key={room.id} className="bg-background rounded-xl border border-orange-200/60 dark:border-orange-800/30 p-4 shadow-sm space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">{room.title}</p>
                              <p className="text-xs text-muted-foreground">Phòng: {room.room_number} | Mã: <span className="font-mono">{room.room_code}</span></p>
                            </div>
                            <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0 text-xs shrink-0">
                              Đã thuê
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{room.district}, {room.province}</span>
                            <span>Chủ trọ: {room.landlord?.full_name || 'N/A'}</span>
                          </div>
                          <div className="text-xs font-mono text-muted-foreground/70">
                            Tenant ID: {tenantDisplayIds.get(room.tenant_id!) || room.tenant_id?.slice(0, 8) + '...'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {globalHistoryTab === 'removal' && (
                <>
                  {loadingGlobalHistory ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : filteredGlobalHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <UserMinus className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground text-sm">Không có lịch sử xoá người thuê</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredGlobalHistory.map((record, idx) => (
                        <div key={record.id} className="relative">
                          {idx < filteredGlobalHistory.length - 1 && (
                            <div className="absolute left-5 top-12 bottom-0 w-px bg-border" />
                          )}
                          <div className="flex gap-4">
                            <div className="shrink-0 mt-1">
                              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                                <UserMinus className="h-4 w-4 text-destructive" />
                              </div>
                            </div>
                            <div className="flex-1 bg-background rounded-xl border border-border/60 p-4 shadow-sm space-y-3">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                  <p className="font-semibold text-sm">{record.tenant_name || 'Người thuê'}</p>
                                  {record.tenant_phone && <p className="text-xs text-muted-foreground">{record.tenant_phone}</p>}
                                  <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">ID: {record.tenant_display_id || record.tenant_id?.slice(0, 8) + '...'}</p>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(record.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    <span className="font-mono">{record.room_number}</span> - {record.room_title}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                <p className="text-sm text-foreground whitespace-pre-wrap">{record.reason}</p>
                              </div>

                              {record.evidence_urls && record.evidence_urls.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <ImageIcon className="h-3 w-3" />
                                    Bằng chứng ({record.evidence_urls.length})
                                  </p>
                                  <div className="flex gap-2 flex-wrap">
                                    {record.evidence_urls.map((url, imgIdx) => (
                                      <button
                                        key={imgIdx}
                                        onClick={() => openFullscreen(record.evidence_urls, imgIdx)}
                                        className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border shadow-sm hover:ring-2 hover:ring-primary/50 transition-all"
                                      >
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                          <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Fullscreen image viewer */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0 rounded-2xl overflow-hidden">
          <div className="relative flex items-center justify-center min-h-[60vh]">
            <button
              onClick={() => setFullscreenOpen(false)}
              className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {fullscreenImages.length > 1 && (
              <>
                <button
                  onClick={() => setFullscreenIndex(i => Math.max(0, i - 1))}
                  disabled={fullscreenIndex === 0}
                  className="absolute left-4 z-20 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30 transition-colors"
                >
                  ‹
                </button>
                <button
                  onClick={() => setFullscreenIndex(i => Math.min(fullscreenImages.length - 1, i + 1))}
                  disabled={fullscreenIndex === fullscreenImages.length - 1}
                  className="absolute right-4 z-20 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30 transition-colors"
                >
                  ›
                </button>
              </>
            )}

            <img
              src={fullscreenImages[fullscreenIndex]}
              alt=""
              className="max-w-full max-h-[85vh] object-contain"
            />

            {fullscreenImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {fullscreenImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setFullscreenIndex(i)}
                    className={`h-2 rounded-full transition-all ${i === fullscreenIndex ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete room dialog */}
      <AlertDialog open={deleteRoomDialogOpen} onOpenChange={setDeleteRoomDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xoá phòng trọ</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xoá phòng <strong>{deletingRoom?.room_number}</strong> - "{deletingRoom?.title}"?
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRoom} disabled={deletingRoomLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingRoomLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Xoá phòng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Reusable history card component
function HistoryCard({ record, idx, total, openFullscreen }: { record: RemovalRecord; idx: number; total: number; openFullscreen: (urls: string[], idx: number) => void }) {
  return (
    <div className="relative">
      {idx < total - 1 && <div className="absolute left-5 top-12 bottom-0 w-px bg-border" />}
      <div className="flex gap-4">
        <div className="shrink-0 mt-1">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <UserMinus className="h-4 w-4 text-destructive" />
          </div>
        </div>
        <div className="flex-1 bg-background rounded-xl border border-border/60 p-4 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-semibold text-sm">{record.tenant_name || 'Người thuê'}</p>
              {record.tenant_phone && <p className="text-xs text-muted-foreground">{record.tenant_phone}</p>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(record.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-foreground whitespace-pre-wrap">{record.reason}</p>
          </div>
          {record.evidence_urls && record.evidence_urls.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                Bằng chứng ({record.evidence_urls.length})
              </p>
              <div className="flex gap-2 flex-wrap">
                {record.evidence_urls.map((url, imgIdx) => (
                  <button
                    key={imgIdx}
                    onClick={() => openFullscreen(record.evidence_urls, imgIdx)}
                    className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border shadow-sm hover:ring-2 hover:ring-primary/50 transition-all"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
