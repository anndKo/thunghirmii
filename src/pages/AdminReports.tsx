// @ts-nocheck
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Flag, ArrowLeft, Clock, CheckCircle, Eye,
  ChevronLeft, ChevronRight, X, Play, Image as ImageIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface RoomReport {
  id: string;
  room_id: string;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  content: string;
  media_urls: string[];
  status: string;
  admin_note: string | null;
  created_at: string;
  room?: {
    title: string;
    room_code: string;
  };
  reporter_profile?: {
    full_name: string;
  };
}

export default function AdminReports() {
  const { user, role, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<RoomReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Media viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerMedia, setViewerMedia] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    if (user && role === 'admin') fetchReports();
  }, [user, role]);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('room_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể tải báo cáo', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Enrich with room info and reporter profiles
    const roomIds = [...new Set((data || []).map((r: any) => r.room_id))] as string[];
    const reporterIds = [...new Set((data || []).filter((r: any) => r.reporter_id).map((r: any) => r.reporter_id))] as string[];

    const [{ data: rooms }, { data: profiles }] = await Promise.all([
      supabase.from('rooms').select('id, title, room_code').in('id', roomIds.length > 0 ? roomIds : ['none']),
      supabase.from('profiles').select('user_id, full_name').in('user_id', reporterIds.length > 0 ? reporterIds : ['none']),
    ]);

    const roomMap = new Map((rooms || []).map((r: any) => [r.id, r]));
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const enriched = (data || []).map((r: any) => ({
      ...r,
      media_urls: r.media_urls || [],
      room: roomMap.get(r.room_id) || null,
      reporter_profile: r.reporter_id ? profileMap.get(r.reporter_id) || null : null,
    }));

    setReports(enriched);
    setLoading(false);
  };

  const markResolved = async (id: string) => {
    const { error } = await (supabase as any)
      .from('room_reports')
      .update({ status: 'resolved' })
      .eq('id', id);
    if (error) {
      toast({ title: 'Lỗi', variant: 'destructive' });
    } else {
      toast({ title: 'Đã đánh dấu xử lý' });
      fetchReports();
    }
  };

  const openMediaViewer = (urls: string[], startIndex: number) => {
    setViewerMedia(urls);
    setViewerIndex(startIndex);
    setViewerOpen(true);
  };

  const isVideo = (url: string) => /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(url);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="ghost" size="icon">
            <Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Flag className="h-6 w-6 text-destructive" />
              Các báo cáo phòng trọ
            </h1>
            <p className="text-muted-foreground text-sm">{reports.length} báo cáo</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Flag className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Chưa có báo cáo nào.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.id} className={report.status === 'pending' ? 'border-destructive/30' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        🏠 {report.room?.title || 'Phòng không xác định'}
                        {report.room?.room_code && <span className="text-muted-foreground font-normal text-sm ml-2">Mã: {report.room.room_code}</span>}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        👤 {report.reporter_profile?.full_name || report.reporter_name || 'Ẩn danh'}
                        {report.reporter_phone && <span className="ml-2">📞 {report.reporter_phone}</span>}
                      </p>
                    </div>
                    <Badge variant={report.status === 'pending' ? 'destructive' : 'secondary'}>
                      {report.status === 'pending' ? (
                        <><Clock className="h-3 w-3 mr-1" />Chờ xử lý</>
                      ) : (
                        <><CheckCircle className="h-3 w-3 mr-1" />Đã xử lý</>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">{report.content}</p>

                  {/* Media thumbnails */}
                  {report.media_urls.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {report.media_urls.map((url, idx) => (
                        <button
                          key={idx}
                          className="w-20 h-20 rounded-xl overflow-hidden border-2 border-transparent hover:border-primary/50 bg-muted relative group transition-all hover:shadow-lg hover:scale-105"
                          onClick={() => openMediaViewer(report.media_urls, idx)}
                        >
                          {isVideo(url) ? (
                            <div className="w-full h-full flex items-center justify-center bg-black/80">
                              <Play className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
                            </div>
                          ) : (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(report.created_at).toLocaleString('vi-VN')}</span>
                    {report.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => markResolved(report.id)} className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Đã xử lý
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Media Viewer */}
      {viewerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300"
          onClick={(e) => { if (e.target === e.currentTarget) setViewerOpen(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setViewerOpen(false);
            if (e.key === 'ArrowLeft') setViewerIndex(i => i === 0 ? viewerMedia.length - 1 : i - 1);
            if (e.key === 'ArrowRight') setViewerIndex(i => i === viewerMedia.length - 1 ? 0 : i + 1);
          }}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all hover:rotate-90 duration-300"
            onClick={() => setViewerOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>

          {/* Navigation */}
          {viewerMedia.length > 1 && (
            <>
              <button
                className="absolute left-4 z-20 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all hover:scale-110 backdrop-blur-sm"
                onClick={() => setViewerIndex(i => i === 0 ? viewerMedia.length - 1 : i - 1)}
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                className="absolute right-4 z-20 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all hover:scale-110 backdrop-blur-sm"
                onClick={() => setViewerIndex(i => i === viewerMedia.length - 1 ? 0 : i + 1)}
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}

          {/* Content */}
          <div className="flex items-center justify-center w-full h-full p-8 sm:p-16">
            {viewerMedia[viewerIndex] && (
              isVideo(viewerMedia[viewerIndex]) ? (
                <video
                  key={viewerIndex}
                  src={viewerMedia[viewerIndex]}
                  controls
                  autoPlay
                  className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
                />
              ) : (
                <img
                  key={viewerIndex}
                  src={viewerMedia[viewerIndex]}
                  alt=""
                  className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain animate-in zoom-in-95 duration-300"
                />
              )
            )}
          </div>

          {/* Counter badge */}
          {viewerMedia.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/90 text-sm font-medium bg-white/10 backdrop-blur-md px-5 py-2 rounded-full border border-white/10">
              {viewerIndex + 1} / {viewerMedia.length}
            </div>
          )}

          {/* Dot indicators */}
          {viewerMedia.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full">
              {viewerMedia.map((_, idx) => (
                <button
                  key={idx}
                  className={`rounded-full transition-all duration-300 ${idx === viewerIndex ? 'w-6 h-2.5 bg-white' : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/60'}`}
                  onClick={() => setViewerIndex(idx)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
