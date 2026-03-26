import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguagePickerModal() {
  const { isFirstVisit, setLanguage, markVisited, t } = useLanguage();

  if (!isFirstVisit) return null;

  const handleSelect = (lang: 'vi' | 'en') => {
    setLanguage(lang);
    markVisited();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl border border-border p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Globe className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-card-foreground mb-1">Chọn ngôn ngữ / Select Language</h2>
          <p className="text-sm text-muted-foreground">Vui lòng chọn ngôn ngữ sử dụng / Please choose your language</p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-14 text-base justify-start gap-4 border-border hover:border-primary hover:bg-accent hover:text-accent-foreground transition-all"
            onClick={() => handleSelect('vi')}
          >
            <span className="text-2xl">🇻🇳</span>
            <div className="text-left">
              <div className="font-semibold text-foreground">Tiếng Việt</div>
              <div className="text-xs text-muted-foreground">Vietnamese</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full h-14 text-base justify-start gap-4 border-border hover:border-primary hover:bg-accent hover:text-accent-foreground transition-all"
            onClick={() => handleSelect('en')}
          >
            <span className="text-2xl">🇬🇧</span>
            <div className="text-left">
              <div className="font-semibold text-foreground">English</div>
              <div className="text-xs text-muted-foreground">Tiếng Anh</div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
