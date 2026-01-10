# Frontend Integration – HLS Streams

این فایل مهم‌ترین نکتهٔ فرانت‌اند را روشن می‌کند: درخواست باید دقیقاً به همان endpoint منتشرشده برسد.

## Golden Rule
The frontend MUST request the HLS stream from the exact exposed endpoint.

### Correct URL
```
https://cam.hydroleaf.se:8443/{CAMERA_ID}/index.m3u8
```

### Common Mistake
Requesting the stream without the port:
```
https://cam.hydroleaf.se/{CAMERA_ID}/index.m3u8 ❌
```

This will always fail unless Caddy is explicitly listening on port 443 for cam.

## نکات اجرایی

- اگر URL روی 8443 است، **حتماً** پورت را در فرانت‌اند لحاظ کنید.
- اگر می‌خواهید URL ساده‌تر باشد، باید Caddy روی 443 تنظیم شود.
- از HLS.js یا playerهای سازگار با HLS استفاده کنید.

## چک‌لیست نهایی

- [ ] دامنه درست است
- [ ] پورت درست است
- [ ] مسیر دوربین درست است
- [ ] TLS معتبر است
- [ ] CORS اجازه می‌دهد
