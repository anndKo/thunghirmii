// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, ArrowLeft, Check, RefreshCw, Timer } from "lucide-react";

interface AttendanceFormProps {
  classInfo: {
    id: string;
    name: string;
    attendance_code: string;
    weeks_count: number;
    attendance_duration_minutes: number | null;
    attendance_start_time: string | null;
  };
  onSuccess: () => void;
  onBack: () => void;
}

const AttendanceForm = ({ classInfo, onSuccess, onBack }: AttendanceFormProps) => {
  const [studentName, setStudentName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [groupNumber, setGroupNumber] = useState("");
  const [weekNumber, setWeekNumber] = useState("1");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (classInfo.attendance_duration_minutes && classInfo.attendance_start_time) {
      const interval = setInterval(() => {
        const startTime = new Date(classInfo.attendance_start_time!).getTime();
        const duration = classInfo.attendance_duration_minutes! * 60 * 1000;
        const endTime = startTime + duration;
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setRemainingTime(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
          toast({
            title: "Hết thời gian điểm danh",
            description: "Phiên điểm danh đã kết thúc",
            variant: "destructive",
          });
          onBack();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [classInfo.attendance_duration_minutes, classInfo.attendance_start_time, onBack, toast]);

  const formatRemainingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      toast({
        title: "Không thể truy cập camera",
        description: "Vui lòng cho phép truy cập camera",
        variant: "destructive",
      });
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsCameraActive(false);
    }
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current) return;

    setIsCapturing(true);
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const photoData = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedPhoto(photoData);
      stopCamera();
    }
    setIsCapturing(false);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const uploadPhoto = async (photoData: string): Promise<string | null> => {
    try {
      // Convert base64 to blob
      const res = await fetch(photoData);
      const blob = await res.blob();
      
      const fileName = `${classInfo.id}/${Date.now()}_${studentCode}.jpg`;
      
      const { data, error } = await supabase.storage
        .from("attendance-photos")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("attendance-photos")
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!capturedPhoto) {
      toast({
        title: "Chưa chụp ảnh",
        description: "Vui lòng chụp ảnh điểm danh",
        variant: "destructive",
      });
      return;
    }

    if (!studentName.trim() || !studentCode.trim()) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng điền đầy đủ thông tin sinh viên",
        variant: "destructive",
      });
      return;
    }

    const week = parseInt(weekNumber) || 1;
    if (week < 1 || week > classInfo.weeks_count) {
      toast({
        title: "Số tuần không hợp lệ",
        description: `Số tuần phải từ 1 đến ${classInfo.weeks_count}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const photoUrl = await uploadPhoto(capturedPhoto);

      if (!photoUrl) {
        throw new Error("Không thể upload ảnh");
      }

      const { error } = await supabase.from("attendance_records").insert({
        class_id: classInfo.id,
        student_name: studentName.trim(),
        student_code: studentCode.trim(),
        group_number: groupNumber.trim() || null,
        photo_url: photoUrl,
        attendance_code: classInfo.attendance_code,
        week_number: week,
      });

      if (error) throw error;

      toast({
        title: "Điểm danh thành công!",
        description: `${studentName} đã điểm danh lớp ${classInfo.name} - Tuần ${week}`,
      });

      onSuccess();
    } catch (err) {
      toast({
        title: "Lỗi điểm danh",
        description: "Không thể lưu thông tin điểm danh",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="content-card">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => {
              stopCamera();
              onBack();
            }}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground">Điểm danh</h2>
            <p className="text-sm text-muted-foreground">Lớp: {classInfo.name}</p>
          </div>
          {remainingTime !== null && (
            <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-lg">
              <Timer className="w-4 h-4" />
              <span className="font-mono font-bold">{formatRemainingTime(remainingTime)}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Camera Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Ảnh điểm danh <span className="text-destructive">*</span>
            </Label>

            {!capturedPhoto ? (
              <div className="space-y-3">
                <div className="camera-preview">
                  {isCameraActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Camera className="w-12 h-12" />
                    </div>
                  )}
                </div>

                {!isCameraActive ? (
                  <Button type="button" onClick={startCamera} className="w-full">
                    <Camera className="w-4 h-4 mr-2" />
                    Mở Camera
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={capturePhoto}
                    disabled={isCapturing}
                    className="w-full"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Chụp ảnh
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="camera-preview">
                  <img
                    src={capturedPhoto}
                    alt="Captured"
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button type="button" variant="outline" onClick={retakePhoto} className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Chụp lại
                </Button>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentName">
                Tên sinh viên <span className="text-destructive">*</span>
              </Label>
              <Input
                id="studentName"
                placeholder="Nguyễn Văn A"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentCode">
                Mã sinh viên <span className="text-destructive">*</span>
              </Label>
              <Input
                id="studentCode"
                placeholder="20210001"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="groupNumber">Số nhóm</Label>
                <Input
                  id="groupNumber"
                  placeholder="Nhóm 1"
                  value={groupNumber}
                  onChange={(e) => setGroupNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weekNumber">
                  Tuần <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="weekNumber"
                  type="number"
                  min={1}
                  max={classInfo.weeks_count}
                  placeholder="1"
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 text-lg"
            disabled={isSubmitting || !capturedPhoto}
          >
            {isSubmitting ? (
              "Đang lưu..."
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Điểm danh
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AttendanceForm;