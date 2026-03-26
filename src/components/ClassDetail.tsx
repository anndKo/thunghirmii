// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Upload,
  Users,
  ClipboardCheck,
  Eye,
  X,
  Download,
  Image as ImageIcon,
  Timer,
  Check,
  XCircle,
} from "lucide-react";

interface ClassDetailProps {
  classInfo: {
    id: string;
    name: string;
    attendance_code: string;
    weeks_count: number;
    attendance_duration_minutes: number | null;
    attendance_start_time: string | null;
  };
  onBack: () => void;
}

interface Student {
  id: string;
  name: string;
  student_code: string;
  group_number: string | null;
}

interface AttendanceRecord {
  id: string;
  student_name: string;
  student_code: string;
  group_number: string | null;
  photo_url: string;
  created_at: string;
  week_number: number | null;
}

const ClassDetail = ({ classInfo, onBack }: ClassDetailProps) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"students" | "attendance" | "photos">("attendance");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("10");
  const [currentWeek, setCurrentWeek] = useState("1");
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
    fetchAttendanceRecords();
    checkTimerStatus();
  }, [classInfo.id]);

  useEffect(() => {
    if (timerEnabled && classInfo.attendance_start_time && classInfo.attendance_duration_minutes) {
      const interval = setInterval(() => {
        const startTime = new Date(classInfo.attendance_start_time!).getTime();
        const duration = classInfo.attendance_duration_minutes! * 60 * 1000;
        const endTime = startTime + duration;
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setRemainingTime(remaining);

        if (remaining <= 0) {
          setTimerEnabled(false);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [timerEnabled, classInfo.attendance_start_time, classInfo.attendance_duration_minutes]);

  const checkTimerStatus = () => {
    if (classInfo.attendance_start_time && classInfo.attendance_duration_minutes) {
      const startTime = new Date(classInfo.attendance_start_time).getTime();
      const duration = classInfo.attendance_duration_minutes * 60 * 1000;
      const endTime = startTime + duration;
      const now = Date.now();

      if (now < endTime) {
        setTimerEnabled(true);
        setDurationMinutes(classInfo.attendance_duration_minutes.toString());
      }
    }
  };

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("*")
      .eq("class_id", classInfo.id)
      .order("name");

    if (data) setStudents(data);
  };

  const fetchAttendanceRecords = async () => {
    const { data } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("class_id", classInfo.id)
      .order("created_at", { ascending: false });

    if (data) setAttendanceRecords(data as AttendanceRecord[]);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const studentsToInsert = jsonData.map((row: any) => ({
        class_id: classInfo.id,
        name: row["Tên sinh viên"] || row["name"] || row["Name"] || "",
        student_code: String(row["Mã sinh viên"] || row["student_code"] || row["MSSV"] || ""),
        group_number: row["Số nhóm"] || row["group_number"] || row["Nhóm"] || null,
      })).filter((s) => s.name && s.student_code);

      if (studentsToInsert.length === 0) {
        toast({
          title: "File không hợp lệ",
          description: "Không tìm thấy dữ liệu sinh viên trong file",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("students").insert(studentsToInsert);

      if (error) throw error;

      toast({
        title: "Import thành công",
        description: `Đã thêm ${studentsToInsert.length} sinh viên`,
      });

      fetchStudents();
    } catch (err) {
      toast({
        title: "Lỗi import",
        description: "Không thể đọc file Excel",
        variant: "destructive",
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleTimer = async () => {
    if (!timerEnabled) {
      // Enable timer
      const minutes = parseInt(durationMinutes) || 10;
      const { error } = await supabase
        .from("classes")
        .update({
          attendance_duration_minutes: minutes,
          attendance_start_time: new Date().toISOString(),
        })
        .eq("id", classInfo.id);

      if (error) {
        toast({
          title: "Lỗi",
          description: "Không thể bật thời gian điểm danh",
          variant: "destructive",
        });
        return;
      }

      classInfo.attendance_duration_minutes = minutes;
      classInfo.attendance_start_time = new Date().toISOString();
      setTimerEnabled(true);
      setRemainingTime(minutes * 60);

      toast({
        title: "Đã bật thời gian điểm danh",
        description: `Mã có hiệu lực trong ${minutes} phút`,
      });
    } else {
      // Disable timer
      const { error } = await supabase
        .from("classes")
        .update({
          attendance_duration_minutes: null,
          attendance_start_time: null,
        })
        .eq("id", classInfo.id);

      if (error) {
        toast({
          title: "Lỗi",
          description: "Không thể tắt thời gian điểm danh",
          variant: "destructive",
        });
        return;
      }

      classInfo.attendance_duration_minutes = null;
      classInfo.attendance_start_time = null;
      setTimerEnabled(false);
      setRemainingTime(null);

      toast({
        title: "Đã tắt thời gian điểm danh",
      });
    }
  };

  const formatRemainingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Check if student attended in a specific week
  const hasAttendedInWeek = (studentCode: string, week: number): boolean => {
    return attendanceRecords.some(
      (record) => record.student_code === studentCode && record.week_number === week
    );
  };

  const exportStudentList = () => {
    // Export basic student list with 3 columns: Tên sinh viên, Mã sinh viên, Số nhóm
    const exportData = students.map((student) => ({
      "Tên sinh viên": student.name,
      "Mã sinh viên": student.student_code,
      "Số nhóm": student.group_number || "",
    }));

    if (exportData.length === 0) {
      toast({
        title: "Không có dữ liệu",
        description: "Lớp này chưa có sinh viên",
        variant: "destructive",
      });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [
      { wch: 30 }, // Tên sinh viên
      { wch: 15 }, // Mã sinh viên
      { wch: 12 }, // Số nhóm
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sinh viên");
    
    const date = new Date().toLocaleDateString("vi-VN").replace(/\//g, "-");
    XLSX.writeFile(workbook, `danh-sach-${classInfo.name}-${date}.xlsx`);

    toast({
      title: "Xuất thành công",
      description: `Đã xuất danh sách ${exportData.length} sinh viên`,
    });
  };

  const exportAttendance = () => {
    // Create header row with weeks
    const weeks = Array.from({ length: classInfo.weeks_count }, (_, i) => `Tuần ${i + 1}`);
    
    const exportData = students.map((student) => {
      const row: any = {
        "Tên sinh viên": student.name,
        "Mã sinh viên": student.student_code,
        "Số nhóm": student.group_number || "",
      };

      // Add attendance for each week
      for (let i = 1; i <= classInfo.weeks_count; i++) {
        row[`Tuần ${i}`] = hasAttendedInWeek(student.student_code, i) ? "✓" : "✗";
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Điểm danh");
    XLSX.writeFile(workbook, `diem-danh-${classInfo.name}-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="fullscreen-overlay">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-foreground">{classInfo.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">Mã điểm danh:</span>
                  <code className="bg-primary/10 text-primary px-2 py-0.5 rounded font-mono text-sm font-bold">
                    {classInfo.attendance_code}
                  </code>
                </div>
              </div>
            </div>

            {/* Timer Section */}
            <div className="flex items-center gap-4 bg-secondary/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Thời gian điểm danh:</span>
              </div>
              {!timerEnabled && (
                <Input
                  type="number"
                  placeholder="10"
                  min={1}
                  max={180}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-20 h-8"
                />
              )}
              {timerEnabled && remainingTime !== null && (
                <span className="font-mono text-lg font-bold text-primary">
                  {formatRemainingTime(remainingTime)}
                </span>
              )}
              <span className="text-sm text-muted-foreground">phút</span>
              <Switch checked={timerEnabled} onCheckedChange={toggleTimer} />
            </div>

            {/* Week selector and Export */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Tuần:</Label>
                <Input
                  type="number"
                  min={1}
                  max={classInfo.weeks_count}
                  value={currentWeek}
                  onChange={(e) => setCurrentWeek(e.target.value)}
                  className="w-16 h-8"
                />
              </div>
              <Button variant="outline" onClick={exportAttendance}>
                <Download className="w-4 h-4 mr-2" />
                Xuất Excel
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab("students")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === "students"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              <Users className="w-4 h-4" />
              Danh sách SV ({students.length})
            </button>
            <button
              onClick={() => setActiveTab("attendance")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === "attendance"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              Điểm danh ({attendanceRecords.length})
            </button>
            <button
              onClick={() => setActiveTab("photos")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === "photos"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Kho ảnh
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {activeTab === "students" && (
          <div className="content-card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground">Danh sách sinh viên</h2>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelImport}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => exportStudentList()}>
                  <Download className="w-4 h-4 mr-2" />
                  Xuất Excel
                </Button>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Excel
                </Button>
              </div>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Chưa có sinh viên nào.</p>
                <p className="text-sm mt-2">Import file Excel với cột: Tên sinh viên, Mã sinh viên, Số nhóm</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên sinh viên</th>
                      <th>Mã sinh viên</th>
                      <th>Số nhóm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <tr key={student.id}>
                        <td>{index + 1}</td>
                        <td className="font-medium">{student.name}</td>
                        <td className="font-mono">{student.student_code}</td>
                        <td>{student.group_number || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "attendance" && (
          <div className="content-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Thông tin điểm danh - Tuần {currentWeek}
            </h2>

            {students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Chưa có sinh viên nào. Vui lòng import danh sách sinh viên trước.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên sinh viên</th>
                      <th>Mã sinh viên</th>
                      <th>Số nhóm</th>
                      {Array.from({ length: classInfo.weeks_count }, (_, i) => (
                        <th key={i} className="text-center">
                          T{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => (
                      <tr key={student.id}>
                        <td>{index + 1}</td>
                        <td className="font-medium">{student.name}</td>
                        <td className="font-mono">{student.student_code}</td>
                        <td>{student.group_number || "-"}</td>
                        {Array.from({ length: classInfo.weeks_count }, (_, i) => {
                          const attended = hasAttendedInWeek(student.student_code, i + 1);
                          return (
                            <td key={i} className="text-center">
                              {attended ? (
                                <Check className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <XCircle className="w-5 h-5 text-destructive/50 mx-auto" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "photos" && (
          <div className="content-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Kho ảnh điểm danh</h2>

            {attendanceRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Chưa có ảnh điểm danh nào.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {attendanceRecords.map((record) => (
                  <div
                    key={record.id}
                    className="relative group cursor-pointer"
                    onClick={() => setSelectedPhoto(record.photo_url)}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={record.photo_url}
                        alt={record.student_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 rounded-lg transition-colors flex items-center justify-center">
                      <Eye className="w-6 h-6 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{record.student_name}</p>
                    {record.week_number && (
                      <span className="text-xs text-primary">Tuần {record.week_number}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="modal-content max-w-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <img
              src={selectedPhoto}
              alt="Attendance photo"
              className="w-full rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassDetail;
