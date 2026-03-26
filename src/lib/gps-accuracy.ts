/**
 * GPS - Fast & accurate positioning
 * Tries getCurrentPosition first for speed, falls back to watchPosition.
 */

interface GpsPoint {
  lat: number;
  lng: number;
}

/**
 * Fast GPS: tries getCurrentPosition first (5s timeout).
 * If that fails, uses watchPosition to collect 2 samples and average them (8s total).
 */
export function getAccuratePosition(): Promise<GpsPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ định vị'));
      return;
    }

    let resolved = false;

    const done = (point: GpsPoint) => {
      if (resolved) return;
      resolved = true;
      resolve(point);
    };

    const fail = (msg: string) => {
      if (resolved) return;
      resolved = true;
      reject(new Error(msg));
    };

    // Try fast getCurrentPosition first
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        done({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        if (resolved) return;
        if (err.code === 1) {
          fail('Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt');
          return;
        }
        // Fall back to watchPosition
        fallbackWatch(done, fail);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
    );
  });
}

function fallbackWatch(
  done: (p: GpsPoint) => void,
  fail: (msg: string) => void
) {
  const points: GpsPoint[] = [];
  let watchId: number | null = null;

  const cleanup = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };

  const timer = setTimeout(() => {
    cleanup();
    if (points.length > 0) {
      const avg = {
        lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
        lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
      };
      done(avg);
    } else {
      fail('Hết thời gian chờ. Vui lòng kiểm tra GPS đã bật chưa.');
    }
  }, 8000);

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      points.push({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (points.length >= 2) {
        clearTimeout(timer);
        cleanup();
        const avg = {
          lat: (points[0].lat + points[1].lat) / 2,
          lng: (points[0].lng + points[1].lng) / 2,
        };
        done(avg);
      }
    },
    (err) => {
      clearTimeout(timer);
      cleanup();
      if (points.length > 0) {
        done(points[0]);
      } else {
        let message = 'Không thể lấy vị trí';
        if (err.code === 1) message = 'Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt';
        else if (err.code === 2) message = 'Không thể xác định vị trí';
        else if (err.code === 3) message = 'Hết thời gian chờ. Vui lòng kiểm tra GPS đã bật chưa.';
        fail(message);
      }
    },
    { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
  );
}
