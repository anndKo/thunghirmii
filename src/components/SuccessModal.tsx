import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, PartyPopper } from "lucide-react";

interface SuccessModalProps {
  open: boolean;
  onClose: () => void;
}

const SuccessModal = ({ open, onClose }: SuccessModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-strong sm:max-w-sm text-center">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center glow-primary animate-scale-in">
              <CheckCircle className="w-10 h-10 text-primary-foreground" />
            </div>
            <PartyPopper className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-bounce" />
          </div>

          <h2 className="text-xl font-bold text-foreground">
            🎉 Bạn đã gửi yêu cầu thành công!
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Số điểm của bạn sẽ sớm được cập nhật trong danh sách trong vòng{" "}
            <span className="text-primary font-semibold">24 giờ</span> để đảm bảo tính minh bạch.
          </p>

          <Button
            onClick={onClose}
            className="w-full gradient-primary text-primary-foreground font-semibold h-12 text-base glow-primary hover:opacity-90 transition-opacity mt-2"
          >
            Xác nhận
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SuccessModal;
