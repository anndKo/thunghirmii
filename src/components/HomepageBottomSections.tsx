import { Link } from 'react-router-dom';
import { Search, FileText, MessageCircle, ShieldCheck, MapPin, Eye, CalendarCheck, Building2, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const benefits = [
  { icon: Search, title: 'Tìm phòng nhanh chóng', desc: 'Tìm kiếm theo vị trí, giá cả, tiện ích chỉ trong vài giây.' },
  { icon: FileText, title: 'Thông tin minh bạch', desc: 'Hình ảnh thực tế, giá rõ ràng, không phí ẩn.' },
  { icon: MessageCircle, title: 'Kết nối trực tiếp chủ trọ', desc: 'Nhắn tin và gọi trực tiếp, không qua trung gian.' },
  { icon: ShieldCheck, title: 'Hỗ trợ an toàn giao dịch', desc: 'Hệ thống bảo vệ, báo cáo và xác minh phòng trọ.' },
];

const steps = [
  { icon: MapPin, step: '01', title: 'Tìm phòng', desc: 'Nhập vị trí hoặc địa chỉ mong muốn để khám phá phòng trọ phù hợp.' },
  { icon: Eye, step: '02', title: 'Xem chi tiết', desc: 'Xem hình ảnh, giá cả, tiện ích và liên hệ chủ trọ trực tiếp.' },
  { icon: CalendarCheck, step: '03', title: 'Đặt lịch & thuê', desc: 'Đặt lịch xem phòng, thỏa thuận và hoàn tất thuê nhanh chóng.' },
];

const stats = [
  { icon: MapPin, value: '63+', label: 'Tỉnh thành' },
  { icon: Building2, value: '1000+', label: 'Phòng trọ' },
  { icon: Users, value: '5000+', label: 'Người dùng' },
  { icon: TrendingUp, value: '99%', label: 'Hài lòng' },
];

export default function HomepageBottomSections() {
  return (
    <>
      {/* Why Choose Us */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="container px-5">
          <div className="text-center mb-8 sm:mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-primary mb-2">Lợi ích</span>
            <h2 className="text-2xl sm:text-3xl font-bold">Tại sao chọn AnndHub?</h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">Nền tảng tìm phòng trọ hiện đại, an toàn và tiện lợi nhất Việt Nam.</p>
          </div>
          <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <div key={i} className="group rounded-2xl bg-card p-6 text-center card-hover border border-transparent hover:border-primary/20 transition-all">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <b.icon className="h-7 w-7" />
                </div>
                <h3 className="font-semibold text-base mb-1.5">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16">
        <div className="container px-5">
          <div className="text-center mb-8 sm:mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-secondary mb-2">Quy trình</span>
            <h2 className="text-2xl sm:text-3xl font-bold">Cách hoạt động</h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">Chỉ 3 bước đơn giản để tìm được phòng trọ ưng ý.</p>
          </div>
          <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-3 max-w-4xl mx-auto">
            {steps.map((s, i) => (
              <div key={i} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] border-t-2 border-dashed border-primary/20" />
                )}
                <div className="relative mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20">
                  <s.icon className="h-8 w-8 text-primary" />
                  <span className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-md">{s.step}</span>
                </div>
                <h3 className="font-semibold text-lg mb-1.5">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 sm:py-14 bg-muted/30">
        <div className="container px-5">
          <div className="grid gap-6 grid-cols-2 lg:grid-cols-4 max-w-3xl mx-auto">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-6 w-6" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Landlord */}
      <section className="py-10 sm:py-16">
        <div className="container px-5">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-secondary to-primary p-8 sm:p-12 lg:p-16">
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M20%2020.5V18H0v-2h20v-2l2%203-2%203zM0%2020h2v2H0v-2z%22%20fill%3D%22%23fff%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')]"></div>
            <div className="relative mx-auto max-w-2xl text-center text-primary-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-4 opacity-80" />
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Bạn là chủ trọ?</h2>
              <p className="text-sm sm:text-lg opacity-90 mb-6 sm:mb-8 max-w-md mx-auto">
                Đăng phòng miễn phí và tiếp cận hàng nghìn người thuê trên khắp cả nước.
              </p>
              <Link
                to="/auth?mode=signup"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-primary px-8 py-3.5 font-semibold text-base shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.03] active:scale-[0.97]"
              >
                <Building2 className="h-4 w-4" />
                Đăng phòng ngay
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
