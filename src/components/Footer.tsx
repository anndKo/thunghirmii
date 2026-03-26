import { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { X, Info, FileText, ShieldCheck, BookOpen, HelpCircle, Mail, Phone, MapPin, Building2, CreditCard, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

import { useAuth } from '@/hooks/useAuth';

const FeedbackDialog = lazy(() => import('@/components/FeedbackDialog').then(m => ({ default: m.FeedbackDialog })));

type FooterSection = 'about' | 'terms' | 'privacy' | 'transaction_policy' | 'guide' | 'faq' | 'contact' | null;

export function Footer() {
  const [activeSection, setActiveSection] = useState<FooterSection>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { t } = useLanguage();
  const { user } = useAuth();

  const sectionContent: Record<Exclude<FooterSection, null>, { title: string; icon: React.ReactNode; content: React.ReactNode }> = {
    about: {
      title: t('footerAbout'),
      icon: <Info className="h-5 w-5" />,
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>{t('aboutWelcome')} <strong className="text-foreground">AnndHub</strong> {t('aboutDesc')}</p>
          <p>{t('aboutConnect')} <strong className="text-foreground">{t('aboutTenants')}</strong> {t('aboutAnd')} <strong className="text-foreground">{t('aboutLandlords')}</strong> {t('aboutConnectDesc')}</p>
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
            <h4 className="font-semibold text-foreground mb-2">{t('aboutWhyTitle')}</h4>
            <ul className="space-y-1.5">
              <li>✅ {t('aboutReason1')}</li>
              <li>✅ {t('aboutReason2')}</li>
              <li>✅ {t('aboutReason3')}</li>
              <li>✅ {t('aboutReason4')}</li>
              <li>✅ {t('aboutReason5')}</li>
            </ul>
          </div>
        </div>
      ),
    },
    terms: {
      title: t('footerTerms'),
      icon: <FileText className="h-5 w-5" />,
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h4 className="font-semibold text-foreground">1. Giới thiệu</h4>
          <p>Điều khoản dịch vụ này quy định quyền và nghĩa vụ của người dùng khi sử dụng nền tảng tìm kiếm, đăng tin phòng trọ và dịch vụ giữ tiền đặt cọc trung gian.</p>
          <p>Nền tảng cung cấp các dịch vụ:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tìm kiếm và đăng tin phòng trọ</li>
            <li>Nhắn tin giữa người thuê và chủ trọ</li>
            <li>Hệ thống yêu cầu đặt cọc phòng</li>
            <li>Dịch vụ giữ tiền đặt cọc trung gian (escrow)</li>
            <li>Xác nhận thanh toán và quản lý giao dịch</li>
          </ul>
          <p>Khi sử dụng nền tảng, người dùng đồng ý tuân thủ toàn bộ điều khoản dưới đây.</p>

          <h4 className="font-semibold text-foreground">2. Định nghĩa</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Người thuê:</strong> Người tìm và thuê phòng trọ thông qua nền tảng.</li>
            <li><strong>Chủ trọ / Người đăng tin:</strong> Người đăng thông tin phòng trọ để cho thuê.</li>
            <li><strong>Nền tảng:</strong> Website hoặc ứng dụng cung cấp dịch vụ kết nối và quản lý giao dịch.</li>
            <li><strong>Tiền đặt cọc:</strong> Khoản tiền người thuê thanh toán để giữ phòng trước khi ký hợp đồng thuê.</li>
            <li><strong>Giữ tiền trung gian:</strong> Nền tảng tạm giữ tiền đặt cọc cho đến khi giao dịch hoàn tất hoặc bị hủy theo quy định.</li>
          </ul>

          <h4 className="font-semibold text-foreground">3. Điều kiện sử dụng</h4>
          <p>Người dùng phải từ 18 tuổi trở lên hoặc có sự đồng ý của người giám hộ, cung cấp thông tin chính xác khi đăng ký tài khoản, không sử dụng dịch vụ vào mục đích vi phạm pháp luật.</p>

          <h4 className="font-semibold text-foreground">4. Quy định tài khoản</h4>
          <p>Người dùng phải bảo mật thông tin đăng nhập, không chia sẻ tài khoản cho người khác, chịu trách nhiệm cho mọi hoạt động phát sinh từ tài khoản.</p>

          <h4 className="font-semibold text-foreground">5. Quy định đăng tin phòng trọ</h4>
          <p>Chủ trọ phải đảm bảo thông tin phòng trọ chính xác, hình ảnh đúng thực tế, giá thuê và các chi phí rõ ràng. Không được đăng phòng trọ không tồn tại hoặc thông tin sai lệch.</p>

          <h4 className="font-semibold text-foreground">6. Quy trình đặt cọc phòng trọ</h4>
          <p>Chủ trọ gửi yêu cầu đặt cọc → Người thuê xác nhận và thanh toán → Nền tảng giữ tiền trung gian → Xem phòng và xác nhận thuê → Giao dịch thành công: tiền chuyển cho chủ trọ; Hủy theo quy định: hoàn tiền cho người thuê.</p>

          <h4 className="font-semibold text-foreground">7. Dịch vụ giữ tiền cọc trung gian</h4>
          <p>Nền tảng đóng vai trò bên trung gian giữ tiền đặt cọc. Tiền đặt cọc không thuộc quyền sử dụng của nền tảng và chỉ được giữ cho đến khi giao dịch được xác nhận.</p>

          <h4 className="font-semibold text-foreground">8. Hoàn tiền đặt cọc</h4>
          <p>Hoàn tiền khi chủ trọ cung cấp thông tin sai, phòng không đúng mô tả, hoặc chủ trọ từ chối cho thuê sau khi nhận cọc. Không hoàn tiền nếu người thuê tự ý hủy hoặc không đến nhận phòng.</p>

          <h4 className="font-semibold text-foreground">9. Phí dịch vụ</h4>
          <p>Nền tảng có thể thu phí đăng tin, phí dịch vụ trung gian, phí xử lý thanh toán. Các khoản phí sẽ được thông báo rõ trước khi thực hiện giao dịch.</p>

          <h4 className="font-semibold text-foreground">10. Hành vi bị cấm</h4>
          <p>Nghiêm cấm lừa đảo, chiếm đoạt tiền đặt cọc, đăng tin giả, giả mạo danh tính, tấn công hệ thống, tạo nhiều tài khoản để gian lận. Vi phạm sẽ bị khóa tài khoản và thông tin có thể được cung cấp cho cơ quan chức năng.</p>

          <h4 className="font-semibold text-foreground">11. Bảo mật thông tin</h4>
          <p>Nền tảng thu thập thông tin tài khoản, thiết bị, địa chỉ IP, lịch sử giao dịch nhằm bảo mật hệ thống, ngăn chặn gian lận và cải thiện dịch vụ.</p>

          <h4 className="font-semibold text-foreground">12. Giới hạn trách nhiệm</h4>
          <p>Nền tảng kết nối người thuê và chủ trọ, trung gian giữ tiền đặt cọc. Không chịu trách nhiệm về chất lượng phòng sau khi thuê, tranh chấp hợp đồng ngoài hệ thống, hoặc các thỏa thuận riêng giữa hai bên.</p>

          <h4 className="font-semibold text-foreground">13. Chấm dứt tài khoản</h4>
          <p>Nền tảng có quyền khóa tài khoản vi phạm, hủy giao dịch nghi ngờ gian lận. Người dùng có thể ngừng sử dụng dịch vụ bất cứ lúc nào.</p>

          <h4 className="font-semibold text-foreground">14. Thay đổi điều khoản</h4>
          <p>Điều khoản có thể được cập nhật theo thời gian. Thông báo sẽ được hiển thị trên website. Tiếp tục sử dụng dịch vụ đồng nghĩa với việc chấp nhận điều khoản mới.</p>

          <h4 className="font-semibold text-foreground">15. Liên hệ hỗ trợ</h4>
          <p>Email: support@website.com | Hotline: 0000 000 000</p>

          <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground mt-2">
            <p className="font-medium text-foreground mb-1">Lưu ý pháp lý:</p>
            <p>Điều khoản dịch vụ này được soạn thảo và áp dụng theo pháp luật Việt Nam. Mọi tranh chấp phát sinh sẽ được giải quyết theo quy định của pháp luật hiện hành.</p>
          </div>
        </div>
      ),
    },
    transaction_policy: {
      title: 'Chính sách giao dịch & bảo vệ người dùng',
      icon: <ShieldCheck className="h-5 w-5" />,
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h3 className="text-base font-bold text-foreground">1. Quy trình chống lừa đảo phòng trọ</h3>
          <p>Để đảm bảo an toàn cho người dùng, nền tảng áp dụng các biện pháp chống gian lận và lừa đảo sau:</p>

          <h4 className="font-semibold text-foreground">1.1 Xác minh người đăng tin</h4>
          <p>Chủ trọ khi đăng phòng trọ có thể phải cung cấp:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Số điện thoại xác thực</li>
            <li>Thông tin tài khoản ngân hàng</li>
            <li>Giấy tờ tùy thân (CMND/CCCD)</li>
            <li>Hình ảnh hoặc video thực tế của phòng trọ</li>
          </ul>
          <p>Nền tảng có quyền:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Kiểm tra thông tin trước khi cho phép đăng tin</li>
            <li>Tạm khóa tin đăng nếu nghi ngờ gian lận</li>
          </ul>

          <h4 className="font-semibold text-foreground">1.2 Kiểm duyệt nội dung tin đăng</h4>
          <p>Hệ thống sẽ:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Kiểm tra nội dung tin đăng tự động</li>
            <li>Phát hiện hình ảnh trùng lặp hoặc giả mạo</li>
            <li>Phát hiện giá thuê bất thường</li>
          </ul>
          <p>Tin đăng vi phạm có thể bị:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tạm ẩn</li>
            <li>Xóa khỏi hệ thống</li>
            <li>Khóa tài khoản đăng tin</li>
          </ul>

          <h4 className="font-semibold text-foreground">1.3 Giám sát giao dịch</h4>
          <p>Hệ thống sẽ theo dõi:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Giao dịch đặt cọc</li>
            <li>Tần suất hủy giao dịch</li>
            <li>Hành vi bất thường</li>
          </ul>
          <p>Nếu phát hiện dấu hiệu gian lận:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Giao dịch có thể bị tạm dừng</li>
            <li>Tiền cọc sẽ được giữ lại cho đến khi xác minh</li>
          </ul>

          <h4 className="font-semibold text-foreground">1.4 Báo cáo lừa đảo</h4>
          <p>Người dùng có thể báo cáo khi phát hiện:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tin đăng giả</li>
            <li>Chủ trọ lừa đảo</li>
            <li>Người thuê có hành vi gian lận</li>
          </ul>
          <p>Sau khi nhận báo cáo:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nền tảng sẽ kiểm tra trong thời gian sớm nhất</li>
            <li>Có thể khóa tài khoản vi phạm</li>
          </ul>

          <h3 className="text-base font-bold text-foreground pt-2">2. Quy định xử lý tranh chấp tiền cọc</h3>
          <p>Trong trường hợp xảy ra tranh chấp giữa người thuê và chủ trọ, nền tảng sẽ đóng vai trò trung gian giải quyết.</p>

          <h4 className="font-semibold text-foreground">2.1 Điều kiện mở tranh chấp</h4>
          <p>Người thuê hoặc chủ trọ có thể mở tranh chấp nếu:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Phòng trọ không đúng mô tả</li>
            <li>Chủ trọ từ chối cho thuê sau khi nhận cọc</li>
            <li>Người thuê không thực hiện cam kết</li>
          </ul>

          <h4 className="font-semibold text-foreground">2.2 Quy trình giải quyết tranh chấp</h4>
          <div className="space-y-2 bg-muted/50 rounded-xl p-4 border">
            <p><strong className="text-foreground">Bước 1:</strong> Người dùng gửi yêu cầu tranh chấp thông qua hệ thống.</p>
            <p><strong className="text-foreground">Bước 2:</strong> Hai bên cung cấp bằng chứng: hình ảnh, tin nhắn, hóa đơn thanh toán, video hoặc tài liệu liên quan.</p>
            <p><strong className="text-foreground">Bước 3:</strong> Nền tảng xem xét và đưa ra quyết định trong thời gian xử lý.</p>
          </div>

          <h4 className="font-semibold text-foreground">2.3 Quyết định cuối cùng</h4>
          <p>Sau khi xem xét thông tin:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tiền cọc có thể được chuyển cho chủ trọ</li>
            <li>Hoặc hoàn trả cho người thuê</li>
          </ul>
          <p>Quyết định dựa trên: bằng chứng cung cấp, lịch sử giao dịch, quy định hệ thống.</p>

          <h4 className="font-semibold text-foreground">2.4 Thời gian xử lý tranh chấp</h4>
          <p>Thời gian xử lý thông thường từ <strong className="text-foreground">3 đến 7 ngày làm việc</strong>. Trường hợp phức tạp có thể kéo dài hơn.</p>

          <h3 className="text-base font-bold text-foreground pt-2">3. Chính sách hoàn tiền đặt cọc</h3>

          <h4 className="font-semibold text-foreground">3.1 Trường hợp được hoàn tiền</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Chủ trọ cung cấp thông tin sai lệch</li>
            <li>Phòng trọ không tồn tại</li>
            <li>Phòng trọ khác hoàn toàn so với mô tả</li>
            <li>Chủ trọ từ chối giao phòng sau khi nhận cọc</li>
          </ul>

          <h4 className="font-semibold text-foreground">3.2 Trường hợp không được hoàn tiền</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Người thuê tự ý hủy giao dịch</li>
            <li>Người thuê không đến nhận phòng theo thời gian đã thỏa thuận</li>
            <li>Người thuê vi phạm thỏa thuận đặt cọc</li>
          </ul>

          <h4 className="font-semibold text-foreground">3.3 Thời gian hoàn tiền</h4>
          <p>Nếu đủ điều kiện, tiền sẽ được hoàn về tài khoản thanh toán ban đầu trong <strong className="text-foreground">3 đến 10 ngày làm việc</strong>.</p>

          <h4 className="font-semibold text-foreground">3.4 Ngăn chặn gian lận</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Hệ thống kiểm tra lịch sử giao dịch của người dùng</li>
            <li>Tài khoản có hành vi gian lận có thể bị khóa</li>
          </ul>

          <h4 className="font-semibold text-foreground">3.5 Quyền quyết định cuối cùng</h4>
          <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground mt-2">
            <p className="font-medium text-foreground mb-1">Lưu ý:</p>
            <p>Nền tảng có quyền tạm giữ tiền đặt cọc, yêu cầu bổ sung bằng chứng và đưa ra quyết định cuối cùng dựa trên thông tin xác minh trong trường hợp có tranh chấp hoặc nghi ngờ gian lận.</p>
          </div>
        </div>
      ),
    },
    privacy: {
      title: t('footerPrivacy'),
      icon: <ShieldCheck className="h-5 w-5" />,
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>{t('privacyIntro')}</p>
          <div className="space-y-3">
            <div><h4 className="font-semibold text-foreground">{t('privacyCollect')}</h4><p>{t('privacyCollectDesc')}</p></div>
            <div><h4 className="font-semibold text-foreground">{t('privacyUse')}</h4><p>{t('privacyUseDesc')}</p></div>
            <div><h4 className="font-semibold text-foreground">{t('privacySecurity')}</h4><p>{t('privacySecurityDesc')}</p></div>
            <div><h4 className="font-semibold text-foreground">{t('privacyRights')}</h4><p>{t('privacyRightsDesc')}</p></div>
          </div>
        </div>
      ),
    },
    guide: {
      title: t('footerGuide'),
      icon: <BookOpen className="h-5 w-5" />,
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
            <h4 className="font-semibold text-foreground mb-2">{t('guideForTenants')}</h4>
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>{t('guideStep1')} <strong className="text-foreground">{t('guideStep1Role')}</strong></li>
              <li>{t('guideStep2')}</li>
              <li>{t('guideStep3')}</li>
              <li>{t('guideStep4')}</li>
              <li>{t('guideStep5')}</li>
            </ol>
          </div>
          <div className="bg-secondary/10 rounded-xl p-4 border border-secondary/20">
            <h4 className="font-semibold text-foreground mb-2">{t('guideForLandlords')}</h4>
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>{t('guideLStep1')} <strong className="text-foreground">{t('guideLStep1Role')}</strong></li>
              <li>{t('guideLStep2')}</li>
              <li>{t('guideLStep3')}</li>
              <li>{t('guideLStep4')}</li>
            </ol>
          </div>
        </div>
      ),
    },
    faq: {
      title: 'FAQ',
      icon: <HelpCircle className="h-5 w-5" />,
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          {([
            { q: t('faqQ1'), a: t('faqA1') },
            { q: t('faqQ2'), a: t('faqA2') },
            { q: t('faqQ3'), a: t('faqA3') },
            { q: t('faqQ4'), a: t('faqA4') },
            { q: t('faqQ5'), a: t('faqA5') },
            { q: t('faqQ6'), a: t('faqA6') },
          ]).map((item, i) => (
            <div key={i} className="bg-muted/50 rounded-xl p-4 border">
              <h4 className="font-semibold text-foreground mb-1">❓ {item.q}</h4>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      ),
    },
    contact: {
      title: t('footerContact'),
      icon: <Mail className="h-5 w-5" />,
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>{t('contactIntro')}</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
              <Mail className="h-5 w-5 text-primary shrink-0" />
              <div><p className="font-medium text-foreground">{t('contactEmail')}</p><p>support@anndhub.vn</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
              <Phone className="h-5 w-5 text-primary shrink-0" />
              <div><p className="font-medium text-foreground">{t('contactHotline')}</p><p>{t('contactHotlineTime')}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <div><p className="font-medium text-foreground">{t('contactAddress')}</p><p>{t('contactAddressValue')}</p></div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/70">{t('contactAlt')}</p>
        </div>
      ),
    },
  };

  const footerGroups: { title: string; links: { key: Exclude<FooterSection, null>; label: string; icon: LucideIcon }[] }[] = [
    {
      title: 'Thông tin',
      links: [
        { key: 'about', label: t('footerAbout'), icon: Info },
        { key: 'guide', label: t('footerGuide'), icon: BookOpen },
        { key: 'faq', label: 'FAQ', icon: HelpCircle },
      ],
    },
    {
      title: 'Pháp lý',
      links: [
        { key: 'terms', label: t('footerTerms'), icon: FileText },
        { key: 'privacy', label: t('footerPrivacy'), icon: ShieldCheck },
        { key: 'transaction_policy', label: 'Chính sách giao dịch', icon: CreditCard },
      ],
    },
    {
      title: 'Liên hệ',
      links: [
        { key: 'contact', label: t('footerContact'), icon: Phone },
      ],
    },
  ];

  const feedbackLink = user ? (
    <button
      onClick={() => setFeedbackOpen(true)}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-all duration-200 hover:translate-y-[-1px]"
    >
      <MessageSquare className="h-3.5 w-3.5" />
      Phản hồi
    </button>
  ) : null;

  const allLinks = footerGroups.flatMap(g => g.links);
  const current = activeSection ? sectionContent[activeSection] : null;

  return (
    <>
      <footer className="border-t bg-gradient-to-b from-muted/30 to-muted/60 backdrop-blur-sm">
        <div className="container py-8 md:py-10">
          {/* Desktop layout */}
          <div className="hidden md:flex flex-col items-center gap-5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-sm">
                <Building2 className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg text-foreground">AnndHub</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2">
              {allLinks.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-all duration-200 hover:translate-y-[-1px]"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
              {feedbackLink}
            </nav>
            <div className="h-px w-full max-w-md bg-border/50" />
            <p className="text-xs text-muted-foreground/60">© 2026 AnndHub. Tất cả quyền được bảo lưu.</p>
          </div>

          {/* Mobile layout - grouped, with icons */}
          <div className="flex md:hidden flex-col items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-sm">
                <Building2 className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg text-foreground">AnndHub</span>
            </div>

            <div className="w-full max-w-xs space-y-5">
              {footerGroups.map((group) => (
                <div key={group.title} className="space-y-1.5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 px-4">{group.title}</h4>
                  <nav className="flex flex-col">
                    {group.links.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setActiveSection(key)}
                        className="flex items-center gap-3 w-full py-2.5 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all duration-200"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </button>
                    ))}
                  </nav>
                </div>
              ))}
              {user && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 px-4">Khác</h4>
                  <nav className="flex flex-col">
                    <button
                      onClick={() => setFeedbackOpen(true)}
                      className="flex items-center gap-3 w-full py-2.5 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all duration-200"
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      Phản hồi
                    </button>
                  </nav>
                </div>
              )}
            </div>

            <div className="h-px w-3/4 bg-border/50" />
            <p className="text-xs text-muted-foreground/60 text-center">© 2026 AnndHub. Tất cả quyền được bảo lưu.</p>
          </div>
        </div>
      </footer>

      {activeSection && current && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200" onClick={() => setActiveSection(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-lg mx-4 mb-0 sm:mb-0 bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-4 duration-300 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{current.icon}</div>
                <h2 className="text-lg font-bold text-foreground">{current.title}</h2>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={() => setActiveSection(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">{current.content}</div>
            <div className="px-6 py-3 border-t shrink-0 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setActiveSection(null)}>{t('close')}</Button>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        {feedbackOpen && <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />}
      </Suspense>
    </>
  );
}