// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageCircle, Send, Image as ImageIcon } from 'lucide-react';
import { MediaPreviewDialog } from '@/components/MediaPreviewDialog';

interface Feedback {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  user_name?: string;
}

export default function AdminFeedbackTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyDialog, setReplyDialog] = useState<Feedback | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('feedbacks')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map((f: any) => f.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
      setFeedbacks(data.map((f: any) => ({ ...f, user_name: nameMap.get(f.user_id) || 'Người dùng' })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFeedbacks(); }, [fetchFeedbacks]);

  const handleReply = async () => {
    if (!replyDialog || !replyContent.trim()) return;
    setReplying(true);
    const { error } = await (supabase as any)
      .from('feedbacks')
      .update({
        admin_reply: replyContent.trim(),
        status: 'replied',
        replied_at: new Date().toISOString(),
      })
      .eq('id', replyDialog.id);

    if (error) {
      toast({ title: 'Lỗi trả lời phản hồi', variant: 'destructive' });
    } else {
      // Send notification to user
      await (supabase as any).from('notifications').insert({
        title: '💬 Admin đã trả lời phản hồi',
        content: `Phản hồi của bạn đã được Admin trả lời: "${replyContent.trim().slice(0, 100)}"`,
        target_role: 'all',
        created_by: user.id,
      });
      toast({ title: 'Đã trả lời phản hồi!' });
      setReplyDialog(null);
      setReplyContent('');
      fetchFeedbacks();
    }
    setReplying(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (feedbacks.length === 0) return <div className="text-center py-12 text-muted-foreground">Chưa có phản hồi nào từ người dùng.</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        Phản hồi người dùng ({feedbacks.length})
      </h3>
      {feedbacks.map((fb) => (
        <Card key={fb.id} className={fb.status === 'pending' ? 'border-amber-300' : ''}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-sm">{fb.user_name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {new Date(fb.created_at).toLocaleString('vi-VN')}
                </span>
              </div>
              <Badge variant={fb.status === 'replied' ? 'default' : 'secondary'}>
                {fb.status === 'replied' ? 'Đã trả lời' : 'Chờ xử lý'}
              </Badge>
            </div>
            <p className="text-sm whitespace-pre-wrap">{fb.content}</p>
            {fb.media_urls && fb.media_urls.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {fb.media_urls.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setPreviewUrls(fb.media_urls); setPreviewIdx(idx); }}
                    className="w-16 h-16 rounded-lg overflow-hidden border hover:opacity-80 transition"
                  >
                    {url.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
                      <video src={url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={url} className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {fb.admin_reply && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs font-medium text-primary mb-1">Trả lời của Admin:</p>
                <p className="text-sm whitespace-pre-wrap">{fb.admin_reply}</p>
                {fb.replied_at && (
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(fb.replied_at).toLocaleString('vi-VN')}</p>
                )}
              </div>
            )}
            <Button size="sm" variant="outline" className="gap-2" onClick={() => { setReplyDialog(fb); setReplyContent(fb.admin_reply || ''); }}>
              <Send className="h-3.5 w-3.5" />
              {fb.admin_reply ? 'Sửa trả lời' : 'Trả lời'}
            </Button>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!replyDialog} onOpenChange={(open) => { if (!open) setReplyDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trả lời phản hồi</DialogTitle>
          </DialogHeader>
          {replyDialog && (
            <div className="space-y-3">
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium text-xs text-muted-foreground mb-1">{replyDialog.user_name}:</p>
                <p className="whitespace-pre-wrap">{replyDialog.content}</p>
              </div>
              <Textarea
                placeholder="Nhập trả lời..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialog(null)}>Hủy</Button>
            <Button onClick={handleReply} disabled={!replyContent.trim() || replying} className="gap-2">
              {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi trả lời
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPreviewDialog
        open={previewUrls.length > 0}
        onOpenChange={(open) => { if (!open) { setPreviewUrls([]); setPreviewIdx(0); } }}
        urls={previewUrls}
        initialIndex={previewIdx}
        type="image"
      />
    </div>
  );
}
