// @ts-nocheck
import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Mail, Filter, Clock, ArrowRight, CheckCircle, XCircle, Building2, Loader2, Trash2 } from 'lucide-react';

interface RoomRequest {
  id: string;
  room_id: string;
  tenant_id: string;
  message: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  rooms: { title: string; room_number: string; landlord_id: string };
  tenant: { full_name: string; phone: string | null };
}

interface Props {
  requests: RoomRequest[];
  loading: boolean;
  tenantFilter: string;
  roomFilter: string;
  highlightRequestId: string;
  onOpenAction: (request: RoomRequest, type: 'forward' | 'reject' | 'accept') => void;
  onDeleteRequest: (request: RoomRequest) => void;
}

export default function AdminRequestsTab({ requests, loading, tenantFilter, roomFilter, highlightRequestId, onOpenAction, onDeleteRequest }: Props) {
  const navigate = useNavigate();
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [highlightedId, setHighlightedId] = useState(highlightRequestId);
  const requestRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesStatus = requestStatusFilter === 'all' || r.status === requestStatusFilter;
      const matchesTenant = !tenantFilter || r.tenant_id === tenantFilter;
      const matchesRoom = !roomFilter || r.room_id === roomFilter;
      return matchesStatus && matchesTenant && matchesRoom;
    });
  }, [requests, requestStatusFilter, tenantFilter, roomFilter]);

  useEffect(() => {
    if (highlightedId && !loading && requests.length > 0) {
      setTimeout(() => {
        const el = requestRefs.current.get(highlightedId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedId(''), 3000);
      }, 300);
    }
  }, [highlightedId, loading, requests]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Đang chờ</Badge>;
      case 'forwarded': return <Badge className="bg-primary text-primary-foreground"><ArrowRight className="h-3 w-3 mr-1" />Đã chuyển</Badge>;
      case 'accepted': return <Badge className="bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Đã chấp nhận</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Từ chối</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <>
      <Card className="mb-4">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 text-muted-foreground"><Filter className="h-4 w-4" /><span className="text-sm font-medium">Lọc:</span></div>
            <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="pending">Đang chờ</SelectItem>
                <SelectItem value="forwarded">Đã chuyển</SelectItem>
                <SelectItem value="accepted">Đã chấp nhận</SelectItem>
                <SelectItem value="rejected">Từ chối</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filteredRequests.length > 0 ? (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card
              key={request.id}
              ref={(el) => { if (el) requestRefs.current.set(request.id, el); }}
              className={`transition-all duration-700 ${highlightedId === request.id ? 'ring-2 ring-primary bg-primary/5 shadow-lg border-primary/40 animate-pulse' : ''}`}
              style={highlightedId === request.id ? { boxShadow: '0 0 20px hsl(var(--primary) / 0.2)' } : undefined}
            >
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg truncate">{request.rooms.title}</CardTitle>
                    <CardDescription className="truncate">
                      Phòng: {request.rooms.room_number} | Người yêu cầu: {request.tenant?.full_name}
                    </CardDescription>
                  </div>
                  <div className="flex-shrink-0">{getStatusBadge(request.status)}</div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm mb-4">
                  {request.tenant?.phone && (<p><strong>SĐT:</strong> {request.tenant.phone}</p>)}
                  {request.message && (<p className="break-words"><strong>Tin nhắn:</strong> {request.message}</p>)}
                  {request.admin_note && (<p className="text-primary break-words"><strong>Ghi chú Admin:</strong> {request.admin_note}</p>)}
                  <p className="text-muted-foreground">{new Date(request.created_at).toLocaleString('vi-VN')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/rooms/${request.room_id}?from=admin&requestId=${request.id}`)}>
                    <Building2 className="h-4 w-4 mr-1" />Xem phòng
                  </Button>
                  {request.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => onOpenAction(request, 'forward')} className="bg-gradient-primary hover:opacity-90">
                        <ArrowRight className="h-4 w-4 mr-1" />Chuyển cho chủ trọ
                      </Button>
                      <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => onOpenAction(request, 'accept')}>
                        <CheckCircle className="h-4 w-4 mr-1" />Chấp nhận
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onOpenAction(request, 'reject')}>
                        <XCircle className="h-4 w-4 mr-1" />Từ chối
                      </Button>
                    </>
                  )}
                  {request.status === 'forwarded' && (
                    <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => onOpenAction(request, 'accept')}>
                      <CheckCircle className="h-4 w-4 mr-1" />Chấp nhận
                    </Button>
                  )}
                </div>
                <div className="flex justify-end mt-2">
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDeleteRequest(request)}>
                    <Trash2 className="h-4 w-4 mr-1" />Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Không có yêu cầu nào.</p>
        </div>
      )}
    </>
  );
}
