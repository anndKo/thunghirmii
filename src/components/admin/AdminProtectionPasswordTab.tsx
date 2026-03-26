// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Eye, EyeOff, Search, Loader2, ShieldCheck, ShieldX, Unlock, ShieldOff, MessageSquare, CheckCircle, XCircle, Clock, ChevronRight, Mail, Phone, CalendarDays, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface ProtectionRecord {
  id: string;
  user_id: string;
  phone: string;
  is_enabled: boolean;
  is_locked: boolean;
  fail_count: number;
  created_at: string;
  email?: string;
  login_password?: string;
}

interface PinResetRequest {
  id: string;
  user_id: string;
  email: string;
  phone: string;
  message: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

export default function AdminProtectionPasswordTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [records, setRecords] = useState<ProtectionRecord[]>([]);
  const [resetRequests, setResetRequests] = useState<PinResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [disabling, setDisabling] = useState<string | null>(null);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('accounts');
  const [selectedRequest, setSelectedRequest] = useState<PinResetRequest | null>(null);

  useEffect(() => {
    fetchRecords();
    fetchResetRequests();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    const { data: protections, error } = await supabase
      .from('protection_passwords')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !protections) {
      setLoading(false);
      return;
    }

    const userIds = protections.map(p => p.user_id);
    if (userIds.length === 0) {
      setRecords([]);
      setLoading(false);
      return;
    }

    const [credRes] = await Promise.all([
      supabase.from('user_credentials').select('user_id, email, password').in('user_id', userIds),
    ]);

    const credMap = new Map((credRes.data || []).map(c => [c.user_id, { email: c.email, password: c.password }]));

    const enriched = protections.map(p => ({
      ...p,
      email: credMap.get(p.user_id)?.email || '',
      login_password: credMap.get(p.user_id)?.password || '',
    }));

    setRecords(enriched);
    setLoading(false);
  };

  const fetchResetRequests = async () => {
    setLoadingRequests(true);
    const { data, error } = await supabase
      .from('pin_reset_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setResetRequests(data);
    }
    setLoadingRequests(false);
  };

  const handleUnlock = async (record: ProtectionRecord) => {
    setUnlocking(record.id);
    const { error } = await supabase
      .from('protection_passwords')
      .update({ is_locked: false, fail_count: 0 })
      .eq('id', record.id);

    if (error) {
      toast({ title: t('error'), description: t('cannotSave'), variant: 'destructive' });
    } else {
      toast({ title: t('success'), description: t('protectionUnlocked') });
      fetchRecords();
    }
    setUnlocking(null);
  };

  const handleDisableProtection = async (record: ProtectionRecord) => {
    setDisabling(record.id);
    const { error } = await supabase
      .from('protection_passwords')
      .delete()
      .eq('id', record.id);

    if (error) {
      toast({ title: t('error'), description: t('cannotSave'), variant: 'destructive' });
    } else {
      toast({ title: t('success'), description: t('protectionDisabledByAdmin') });
      fetchRecords();
    }
    setDisabling(null);
  };

  const handleResetRequest = async (request: PinResetRequest, action: 'approved' | 'rejected') => {
    setProcessingRequest(request.id);

    if (action === 'approved') {
      await supabase
        .from('protection_passwords')
        .delete()
        .eq('user_id', request.user_id);
    }

    const { error } = await supabase
      .from('pin_reset_requests')
      .update({
        status: action,
        admin_note: adminNotes[request.id] || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (error) {
      toast({ title: t('error'), description: t('cannotSave'), variant: 'destructive' });
    } else {
      toast({
        title: t('success'),
        description: action === 'approved' ? t('pinResetApproved') : t('pinResetRejected'),
      });
      fetchResetRequests();
      if (action === 'approved') fetchRecords();
      setSelectedRequest(null);
    }
    setProcessingRequest(null);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = searchEmail
    ? records.filter(r => r.email?.toLowerCase().includes(searchEmail.toLowerCase()))
    : records;

  const pendingRequests = resetRequests.filter(r => r.status === 'pending');

  const getStatusBadge = (status: string) => {
    if (status === 'pending') return <Badge variant="default" className="gap-1"><Clock className="h-3 w-3" />{t('pending')}</Badge>;
    if (status === 'approved') return <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3" />{t('approved')}</Badge>;
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{t('rejected')}</Badge>;
  };

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="accounts" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t('protectionAccounts')}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2 relative">
            <MessageSquare className="h-4 w-4" />
            {t('pinResetRequests')}
            {pendingRequests.length > 0 && (
              <span className="ml-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchByEmail')}
                  value={searchEmail}
                  onChange={e => setSearchEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                {filtered.length} {t('protectionAccounts')}
              </Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t('noProtectionAccounts')}</p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>{t('loginPasswordCol')}</TableHead>
                        <TableHead>{t('phoneNumber')}</TableHead>
                        <TableHead>{t('statusCol')}</TableHead>
                        <TableHead>{t('protectionCreatedAt')}</TableHead>
                        <TableHead>{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(record => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium text-sm">{record.email}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">
                                {visiblePasswords[record.id] ? record.login_password : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(record.id)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {visiblePasswords[record.id]
                                  ? <EyeOff className="h-4 w-4" />
                                  : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{record.phone}</TableCell>
                          <TableCell>
                            {record.is_locked ? (
                              <Badge variant="destructive" className="gap-1">
                                <ShieldX className="h-3 w-3" />
                                {t('statusLocked')}
                              </Badge>
                            ) : record.is_enabled ? (
                              <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                <ShieldCheck className="h-3 w-3" />
                                {t('statusActive')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <ShieldOff className="h-3 w-3" />
                                {t('statusDisabled')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(record.created_at).toLocaleDateString('vi-VN')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              {record.is_locked && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => handleUnlock(record)}
                                  disabled={unlocking === record.id}
                                >
                                  {unlocking === record.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Unlock className="h-3 w-3" />
                                  )}
                                  {t('unlock')}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1"
                                onClick={() => handleDisableProtection(record)}
                                disabled={disabling === record.id}
                              >
                                {disabling === record.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ShieldOff className="h-3 w-3" />
                                )}
                                {t('disableProtection')}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests">
          <div className="space-y-4">
            {loadingRequests ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : resetRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t('noPinResetRequests')}</p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-2 pr-2">
                  {resetRequests.map(request => (
                    <button
                      key={request.id}
                      type="button"
                      className="w-full text-left border rounded-xl p-4 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">{request.email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {request.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(request.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getStatusBadge(request.status)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Request Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) setSelectedRequest(null); }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('pinResetRequestDetail') || 'Chi tiết yêu cầu'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.email}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 pb-2">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('statusCol')}</span>
                  {getStatusBadge(selectedRequest.status)}
                </div>

                {/* Info fields */}
                <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{selectedRequest.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('phoneNumber')}</p>
                      <p className="text-sm font-medium">{selectedRequest.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t('protectionCreatedAt')}</p>
                      <p className="text-sm font-medium">{new Date(selectedRequest.created_at).toLocaleString('vi-VN')}</p>
                    </div>
                  </div>
                </div>

                {/* User message */}
                {selectedRequest.message && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t('userMessage')}:</p>
                    <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {selectedRequest.message}
                    </div>
                  </div>
                )}

                {/* Admin note (for completed requests) */}
                {selectedRequest.admin_note && selectedRequest.status !== 'pending' && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t('adminNote')}:</p>
                    <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {selectedRequest.admin_note}
                    </div>
                  </div>
                )}

                {/* Action area for pending requests */}
                {selectedRequest.status === 'pending' && (
                  <div className="space-y-3 border-t pt-4">
                    <Textarea
                      placeholder={t('adminNotePlaceholder')}
                      value={adminNotes[selectedRequest.id] || ''}
                      onChange={e => setAdminNotes(prev => ({ ...prev, [selectedRequest.id]: e.target.value }))}
                      className="text-sm"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-1 flex-1"
                        onClick={() => handleResetRequest(selectedRequest, 'approved')}
                        disabled={processingRequest === selectedRequest.id}
                      >
                        {processingRequest === selectedRequest.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3 w-3" />
                        )}
                        {t('approveAndReset')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1 flex-1"
                        onClick={() => handleResetRequest(selectedRequest, 'rejected')}
                        disabled={processingRequest === selectedRequest.id}
                      >
                        {processingRequest === selectedRequest.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {t('reject')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}