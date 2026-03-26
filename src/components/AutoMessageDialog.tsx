// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Send, Trash2, Pencil, X, Save, MessageSquareText } from 'lucide-react';

interface AutoMessage {
  id: string;
  title: string;
  content: string;
}

interface AutoMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (content: string) => void;
  userId: string;
}

export function AutoMessageDialog({ open, onOpenChange, onSend, userId }: AutoMessageDialogProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<AutoMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('auto_messages')
      .select('id, title, content')
      .order('created_at', { ascending: false });
    setMessages(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchMessages();
  }, [open, fetchMessages]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    if (editingId) {
      const { error } = await supabase
        .from('auto_messages')
        .update({ title: title.trim(), content: content.trim(), updated_at: new Date().toISOString() })
        .eq('id', editingId);
      if (!error) toast({ title: 'Đã cập nhật tin nhắn mẫu' });
    } else {
      const { error } = await supabase
        .from('auto_messages')
        .insert({ title: title.trim(), content: content.trim(), created_by: userId });
      if (!error) toast({ title: 'Đã tạo tin nhắn mẫu' });
    }
    setTitle('');
    setContent('');
    setEditingId(null);
    setShowForm(false);
    fetchMessages();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('auto_messages').delete().eq('id', id);
    toast({ title: 'Đã xoá tin nhắn mẫu' });
    fetchMessages();
  };

  const handleEdit = (msg: AutoMessage) => {
    setEditingId(msg.id);
    setTitle(msg.title);
    setContent(msg.content);
    setShowForm(true);
  };

  const handleSendMessage = (msg: AutoMessage) => {
    onSend(msg.content);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-primary" />
            Tin nhắn tự động
          </DialogTitle>
        </DialogHeader>

        {showForm ? (
          <div className="space-y-3">
            <Input
              placeholder="Tiêu đề mẫu..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Nội dung tin nhắn..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingId(null); setTitle(''); setContent(''); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Huỷ
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!title.trim() || !content.trim()}>
                <Save className="h-3.5 w-3.5 mr-1" /> {editingId ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button variant="outline" size="sm" className="gap-2 self-start" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Thêm mẫu mới
            </Button>
            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="space-y-2 pr-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Đang tải...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Chưa có tin nhắn mẫu nào</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{msg.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSendMessage(msg)} title="Gửi">
                            <Send className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(msg)} title="Sửa">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(msg.id)} title="Xoá">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
