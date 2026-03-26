import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, FileText, AlertTriangle } from 'lucide-react';

interface Props {
  userId: string;
}

const TOS_KEY_PREFIX = 'tos_accepted_';

export function TermsOfServiceDialog({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const key = TOS_KEY_PREFIX + userId;
    if (!localStorage.getItem(key)) {
      setOpen(true);
    }
  }, [userId]);

  const handleAccept = () => {
    localStorage.setItem(TOS_KEY_PREFIX + userId, new Date().toISOString());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg max-h-[90vh] flex flex-col [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Điều khoản dịch vụ AnndHub
          </DialogTitle>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Cập nhật lần cuối: 01/03/2026
          </p>
        </DialogHeader>

        <div className="flex-1 max-h-[55vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Vui lòng đọc kỹ toàn bộ điều khoản trước khi sử dụng dịch vụ.
              </p>
            </div>

            <h3 className="font-semibold text-foreground">1. Giới thiệu</h3>
            <p>
              Điều khoản dịch vụ này quy định quyền và nghĩa vụ của người dùng khi sử dụng nền tảng tìm kiếm, đăng tin phòng trọ và dịch vụ giữ tiền đặt cọc trung gian.
            </p>
            <p>Nền tảng cung cấp các dịch vụ:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Tìm kiếm và đăng tin phòng trọ</li>
              <li>Nhắn tin giữa người thuê và chủ trọ</li>
              <li>Hệ thống yêu cầu đặt cọc phòng</li>
              <li>Dịch vụ giữ tiền đặt cọc trung gian (escrow)</li>
              <li>Xác nhận thanh toán và quản lý giao dịch</li>
            </ul>
            <p>Khi sử dụng nền tảng, người dùng đồng ý tuân thủ toàn bộ điều khoản dưới đây.</p>

            <h3 className="font-semibold text-foreground">2. Định nghĩa</h3>
            <p>Trong điều khoản này:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Người thuê:</strong> Người tìm và thuê phòng trọ thông qua nền tảng.</li>
              <li><strong>Chủ trọ / Người đăng tin:</strong> Người đăng thông tin phòng trọ để cho thuê.</li>
              <li><strong>Nền tảng:</strong> Website hoặc ứng dụng cung cấp dịch vụ kết nối và quản lý giao dịch.</li>
              <li><strong>Tiền đặt cọc:</strong> Khoản tiền người thuê thanh toán để giữ phòng trước khi ký hợp đồng thuê.</li>
              <li><strong>Giữ tiền trung gian:</strong> Nền tảng tạm giữ tiền đặt cọc cho đến khi giao dịch hoàn tất hoặc bị hủy theo quy định.</li>
            </ul>

            <h3 className="font-semibold text-foreground">3. Điều kiện sử dụng</h3>
            <p>Người dùng phải:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Từ 18 tuổi trở lên hoặc có sự đồng ý của người giám hộ.</li>
              <li>Cung cấp thông tin chính xác khi đăng ký tài khoản.</li>
              <li>Không sử dụng dịch vụ vào mục đích vi phạm pháp luật.</li>
            </ul>
            <p>Nền tảng có quyền từ chối cung cấp dịch vụ nếu phát hiện hành vi gian lận, tạm khóa hoặc xóa tài khoản vi phạm.</p>

            <h3 className="font-semibold text-foreground">4. Quy định tài khoản</h3>
            <p>Người dùng phải:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Bảo mật thông tin đăng nhập.</li>
              <li>Không chia sẻ tài khoản cho người khác.</li>
              <li>Chịu trách nhiệm cho mọi hoạt động phát sinh từ tài khoản.</li>
            </ul>
            <p>Nền tảng có thể ghi nhận thông tin thiết bị đăng nhập và áp dụng biện pháp bảo mật, chống gian lận.</p>

            <h3 className="font-semibold text-foreground">5. Quy định đăng tin phòng trọ</h3>
            <p>Chủ trọ phải đảm bảo:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Thông tin phòng trọ chính xác.</li>
              <li>Hình ảnh đúng thực tế.</li>
              <li>Giá thuê và các chi phí rõ ràng.</li>
            </ul>
            <p>Không được đăng phòng trọ không tồn tại, thông tin sai lệch hoặc gây hiểu nhầm, nội dung lừa đảo. Nền tảng có quyền xóa tin vi phạm và khóa tài khoản đăng tin sai sự thật.</p>

            <h3 className="font-semibold text-foreground">6. Quy trình đặt cọc phòng trọ</h3>
            <p>Quy trình đặt cọc được thực hiện như sau:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Chủ trọ gửi yêu cầu đặt cọc cho người thuê thông qua hệ thống.</li>
              <li>Người thuê xác nhận và thanh toán tiền đặt cọc.</li>
              <li>Tiền đặt cọc sẽ được nền tảng giữ trung gian.</li>
              <li>Người thuê và chủ trọ tiến hành xem phòng và xác nhận thuê.</li>
            </ul>
            <p>Sau khi hoàn tất: Nếu giao dịch thành công → tiền cọc được chuyển cho chủ trọ. Nếu giao dịch bị hủy theo quy định → tiền sẽ được hoàn trả cho người thuê.</p>

            <h3 className="font-semibold text-foreground">7. Dịch vụ giữ tiền cọc trung gian</h3>
            <p>
              Nền tảng đóng vai trò bên trung gian giữ tiền đặt cọc để đảm bảo giao dịch minh bạch. Trong thời gian giữ tiền, tiền đặt cọc không thuộc quyền sử dụng của nền tảng. Nền tảng chỉ giữ tiền cho đến khi giao dịch được xác nhận.
            </p>
            <p>Nền tảng có thể kiểm tra chứng từ thanh toán và xác minh thông tin giao dịch khi cần thiết.</p>

            <h3 className="font-semibold text-foreground">8. Hoàn tiền đặt cọc</h3>
            <p>Hoàn tiền cho người thuê nếu:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Chủ trọ cung cấp thông tin sai.</li>
              <li>Phòng trọ không đúng mô tả.</li>
              <li>Chủ trọ từ chối cho thuê sau khi nhận cọc.</li>
            </ul>
            <p>Không hoàn tiền nếu người thuê tự ý hủy giao dịch hoặc không đến nhận phòng theo thời gian đã thỏa thuận. Trong trường hợp tranh chấp, nền tảng sẽ xem xét chứng cứ từ hai bên trước khi quyết định.</p>

            <h3 className="font-semibold text-foreground">9. Phí dịch vụ</h3>
            <p>Nền tảng có thể thu các loại phí: phí đăng tin phòng trọ, phí dịch vụ trung gian, phí xử lý thanh toán. Các khoản phí sẽ được thông báo rõ trước khi người dùng thực hiện giao dịch.</p>

            <h3 className="font-semibold text-foreground">10. Hành vi bị cấm</h3>
            <p>Người dùng không được:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Lừa đảo hoặc chiếm đoạt tiền đặt cọc.</li>
              <li>Đăng tin giả.</li>
              <li>Giả mạo danh tính.</li>
              <li>Tấn công hệ thống website.</li>
              <li>Tạo nhiều tài khoản để gian lận.</li>
            </ul>
            <p>Nếu vi phạm: tài khoản sẽ bị khóa, giao dịch có thể bị hủy, thông tin có thể được cung cấp cho cơ quan chức năng.</p>

            <h3 className="font-semibold text-foreground">11. Bảo mật thông tin</h3>
            <p>Nền tảng có thể thu thập: thông tin tài khoản, thông tin thiết bị, địa chỉ IP, lịch sử giao dịch. Mục đích: bảo mật hệ thống, ngăn chặn gian lận, cải thiện dịch vụ.</p>

            <h3 className="font-semibold text-foreground">12. Giới hạn trách nhiệm</h3>
            <p>Nền tảng đóng vai trò kết nối người thuê và chủ trọ, trung gian giữ tiền đặt cọc. Nền tảng không chịu trách nhiệm đối với:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Chất lượng phòng trọ sau khi thuê.</li>
              <li>Tranh chấp hợp đồng ngoài hệ thống.</li>
              <li>Các thỏa thuận riêng giữa hai bên.</li>
            </ul>

            <h3 className="font-semibold text-foreground">13. Chấm dứt tài khoản</h3>
            <p>Nền tảng có quyền khóa tài khoản vi phạm, hủy giao dịch nghi ngờ gian lận. Người dùng có thể ngừng sử dụng dịch vụ bất cứ lúc nào.</p>

            <h3 className="font-semibold text-foreground">14. Thay đổi điều khoản</h3>
            <p>
              Điều khoản dịch vụ có thể được cập nhật theo thời gian. Khi thay đổi, thông báo sẽ được hiển thị trên website. Việc tiếp tục sử dụng dịch vụ đồng nghĩa với việc chấp nhận điều khoản mới.
            </p>

            <h3 className="font-semibold text-foreground">15. Liên hệ hỗ trợ</h3>
            <p>Nếu có vấn đề hoặc tranh chấp, người dùng có thể liên hệ:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email: support@website.com</li>
              <li>Hotline: 0000 000 000</li>
            </ul>

            <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground mt-2">
              <p className="font-medium text-foreground mb-1">Lưu ý pháp lý:</p>
              <p>
                Điều khoản dịch vụ này được soạn thảo và áp dụng theo pháp luật Việt Nam. Mọi tranh
                chấp phát sinh sẽ được giải quyết theo quy định của pháp luật hiện hành.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm font-medium leading-snug">
              Tôi đã đọc và đồng ý với điều khoản dịch vụ
            </span>
          </label>

          <DialogFooter>
            <Button
              onClick={handleAccept}
              disabled={!accepted}
              className="w-full bg-gradient-primary"
            >
              Đồng ý và tiếp tục
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
