import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

const PRESET_AMENITIES = [
  { id: 'wifi', label: 'WiFi' },
  { id: 'dieu_hoa', label: 'Điều hòa' },
  { id: 'may_giat', label: 'Máy giặt' },
  { id: 'tu_lanh', label: 'Tủ lạnh' },
  { id: 'nong_lanh', label: 'Nóng lạnh' },
  { id: 'ban_cong', label: 'Ban công' },
  { id: 'giu_xe', label: 'Giữ xe' },
  { id: 'bao_ve', label: 'Bảo vệ' },
  { id: 'thang_may', label: 'Thang máy' },
  { id: 'giuong', label: 'Giường' },
  { id: 'tu_quan_ao', label: 'Tủ quần áo' },
  { id: 'bep', label: 'Bếp' },
];

interface AmenitiesSelectorProps {
  value: string[];
  onChange: (amenities: string[]) => void;
}

export function AmenitiesSelector({ value, onChange }: AmenitiesSelectorProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAmenity, setCustomAmenity] = useState('');

  // Separate preset and custom amenities
  const presetLabels = PRESET_AMENITIES.map(a => a.label);
  const customAmenities = value.filter(a => !presetLabels.includes(a));

  const handleToggle = (amenityLabel: string, checked: boolean) => {
    if (checked) {
      onChange([...value, amenityLabel]);
    } else {
      onChange(value.filter(a => a !== amenityLabel));
    }
  };

  const addCustomAmenity = () => {
    const trimmed = customAmenity.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setCustomAmenity('');
      setShowCustomInput(false);
    }
  };

  const removeCustom = (amenity: string) => {
    onChange(value.filter(a => a !== amenity));
  };

  return (
    <div className="space-y-4">
      <Label>Tiện ích</Label>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PRESET_AMENITIES.map((amenity) => (
          <div key={amenity.id} className="flex items-center space-x-2">
            <Checkbox
              id={amenity.id}
              checked={value.includes(amenity.label)}
              onCheckedChange={(checked) => handleToggle(amenity.label, checked === true)}
            />
            <label
              htmlFor={amenity.id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {amenity.label}
            </label>
          </div>
        ))}
      </div>

      {/* Custom amenities */}
      {customAmenities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customAmenities.map((amenity) => (
            <Badge key={amenity} variant="secondary" className="gap-1">
              {amenity}
              <button
                type="button"
                onClick={() => removeCustom(amenity)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add custom amenity */}
      {showCustomInput ? (
        <div className="flex gap-2">
          <Input
            placeholder="Nhập tiện ích khác..."
            value={customAmenity}
            onChange={(e) => setCustomAmenity(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAmenity())}
            className="flex-1"
          />
          <Button type="button" size="sm" onClick={addCustomAmenity}>
            Thêm
          </Button>
          <Button 
            type="button" 
            size="sm" 
            variant="ghost" 
            onClick={() => {
              setShowCustomInput(false);
              setCustomAmenity('');
            }}
          >
            Hủy
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowCustomInput(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Thêm tiện ích khác
        </Button>
      )}
    </div>
  );
}
