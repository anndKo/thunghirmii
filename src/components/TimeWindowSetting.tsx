// @ts-nocheck
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Clock, Save } from "lucide-react";

interface TimeWindow {
  enabled: boolean;
  start: string | null;
  end: string | null;
}

const TimeWindowSetting = () => {
  const [tw, setTw] = useState<TimeWindow>({ enabled: false, start: null, end: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "time_window")
        .single();
      if (data) setTw(data.value as unknown as TimeWindow);
    };
    fetch();
  }, []);

  const toLocalDatetime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .update({ value: tw as any, updated_at: new Date().toISOString() })
      .eq("key", "time_window");

    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã lưu cài đặt thời gian ✓" });
    }
    setSaving(false);
  };

  return (
    <div className="bg-[#0f1117] rounded-xl p-5 mb-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-gray-100">Giới hạn thời gian tham gia</h3>
        </div>
        <Switch
          checked={tw.enabled}
          onCheckedChange={async (checked) => {
            const newTw = { ...tw, enabled: checked };
            setTw(newTw);
            // Auto-save when toggling off
            if (!checked) {
              const { error } = await supabase
                .from("settings")
                .update({ value: newTw as any, updated_at: new Date().toISOString() })
                .eq("key", "time_window");
              if (!error) toast({ title: "Đã tắt giới hạn thời gian ✓" });
            }
          }}
        />
      </div>

      {tw.enabled && (
        <div className="space-y-3 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-300">Bắt đầu</Label>
              <Input
                type="datetime-local"
                value={toLocalDatetime(tw.start)}
                onChange={(e) =>
                  setTw((prev) => ({
                    ...prev,
                    start: e.target.value ? new Date(e.target.value).toISOString() : null,
                  }))
                }
                className="bg-[#1a1d2e] border border-white/10 text-white 
                focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 
                hover:border-indigo-400/40
                appearance-none
                [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-300">Kết thúc</Label>
              <Input
                type="datetime-local"
                value={toLocalDatetime(tw.end)}
                onChange={(e) =>
                  setTw((prev) => ({
                    ...prev,
                    end: e.target.value ? new Date(e.target.value).toISOString() : null,
                  }))
                }
                className="bg-[#1a1d2e] border border-white/10 text-white 
                  focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 
                  hover:border-indigo-400/40
                  appearance-none
                  [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-white">
            <Save className="w-4 h-4 mr-1" />
            {saving ? "Đang lưu..." : "Lưu thời gian"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TimeWindowSetting;
