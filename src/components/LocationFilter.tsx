import { useState, useEffect, useCallback, useRef } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { provinces, getDistrictsByProvince, getWardsByDistrict } from '@/lib/vietnam-locations';

interface LocationFilterProps {
  onLocationChange: (location: {
    province: string;
    district: string;
    ward: string;
    addressDetail: string;
  }) => void;
  initialValues?: {
    province?: string;
    district?: string;
    ward?: string;
    addressDetail?: string;
  };
}

export function LocationFilter({ onLocationChange, initialValues }: LocationFilterProps) {
  const [selectedProvince, setSelectedProvince] = useState(initialValues?.province || '');
  const [selectedDistrict, setSelectedDistrict] = useState(initialValues?.district || '');
  const [selectedWard, setSelectedWard] = useState(initialValues?.ward || '');
  const [addressDetail, setAddressDetail] = useState(initialValues?.addressDetail || '');

  const [availableDistricts, setAvailableDistricts] = useState<{ code: string; name: string }[]>([]);
  const [availableWards, setAvailableWards] = useState<{ code: string; name: string }[]>([]);

  // Use ref to store onLocationChange to avoid stale closures
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;

  // Track if this is the initial mount
  const isInitialMount = useRef(true);

  // Load districts when province changes
  useEffect(() => {
    if (selectedProvince) {
      const provinceCode = provinces.find(p => p.name === selectedProvince)?.code;
      if (provinceCode) {
        setAvailableDistricts(getDistrictsByProvince(provinceCode));
      }
    } else {
      setAvailableDistricts([]);
    }
    
    // Only reset district/ward if this is not initial mount
    if (!isInitialMount.current) {
      setSelectedDistrict('');
      setSelectedWard('');
      setAvailableWards([]);
    }
  }, [selectedProvince]);

  // Load wards when district changes
  useEffect(() => {
    if (selectedDistrict && availableDistricts.length > 0) {
      const districtCode = availableDistricts.find(d => d.name === selectedDistrict)?.code;
      if (districtCode) {
        setAvailableWards(getWardsByDistrict(districtCode));
      }
    } else {
      setAvailableWards([]);
    }
    
    // Only reset ward if this is not initial mount
    if (!isInitialMount.current) {
      setSelectedWard('');
    }
  }, [selectedDistrict, availableDistricts]);

  // Notify parent of location changes - debounced to avoid excessive updates
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    onLocationChangeRef.current({
      province: selectedProvince,
      district: selectedDistrict,
      ward: selectedWard,
      addressDetail: addressDetail,
    });
  }, [selectedProvince, selectedDistrict, selectedWard, addressDetail]);

  const handleProvinceChange = useCallback((value: string) => {
    setSelectedProvince(value);
  }, []);

  const handleDistrictChange = useCallback((value: string) => {
    setSelectedDistrict(value);
  }, []);

  const handleWardChange = useCallback((value: string) => {
    setSelectedWard(value);
  }, []);

  const handleAddressDetailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAddressDetail(e.target.value);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="space-y-2">
        <Label>Tỉnh/Thành phố</Label>
        <Select value={selectedProvince} onValueChange={handleProvinceChange}>
          <SelectTrigger>
            <SelectValue placeholder="Chọn tỉnh/thành phố" />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((province) => (
              <SelectItem key={province.code} value={province.name}>
                {province.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Quận/Huyện</Label>
        <Select 
          value={selectedDistrict} 
          onValueChange={handleDistrictChange}
          disabled={!selectedProvince || availableDistricts.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn quận/huyện" />
          </SelectTrigger>
          <SelectContent>
            {availableDistricts.map((district) => (
              <SelectItem key={district.code} value={district.name}>
                {district.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Phường/Xã</Label>
        <Select 
          value={selectedWard} 
          onValueChange={handleWardChange}
          disabled={!selectedDistrict || availableWards.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn phường/xã" />
          </SelectTrigger>
          <SelectContent>
            {availableWards.map((ward) => (
              <SelectItem key={ward.code} value={ward.name}>
                {ward.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Địa chỉ chi tiết</Label>
        <Input
          placeholder="Số nhà, tên đường..."
          value={addressDetail}
          onChange={handleAddressDetailChange}
        />
      </div>
    </div>
  );
}
