# دستور کار برای Codex — بهبود کامل تجربه سفارش، پرداخت، رسید و فاکتور

این سند برای اجرا توسط Codex نوشته شده است. تمرکز اصلی روی **Frontend** است، اما هرجا نیاز به تغییر Backend باشد دقیق مشخص شده است.

---

## هدف‌های محصول
1. کاربر بعد از بازگشت از Stripe، وضعیت پرداخت را سریع و شفاف ببیند (بدون گیرکردن روی `Processing...`).
2. اگر پرداخت تایید شد/نشد، نتیجه بلافاصله به کاربر نمایش داده شود.
3. بعد از پرداخت موفق، کاربر بتواند **Receipt** و **Invoice** را ببیند/دانلود کند.
4. در صفحه Order UI شبیه الگوهای آمازون باشد: خلاصه سفارش، وضعیت، آیتم‌ها، جمع مبالغ، اکشن‌های واضح.
5. کد تخفیف واقعاً روی مبلغ اعمال شود و مبلغ نهایی ذخیره‌شده در دیتابیس با Stripe هم‌خوان باشد.

---

## تسک 1) هم‌ترازی Endpoint وضعیت سفارش (رفع گیر صفحه Success)

### Frontend (الزامی)
- فایل API را بررسی کن تا polling صفحه success به endpoint معتبر وصل باشد.
- اگر Backend endpoint زیر را پیاده‌سازی کرد، همان را نگه‌دار:
  - `GET /api/store/orders/by-session/{sessionId}`
- اگر Backend این endpoint را ندارد، fallback frontend را روی endpoint موجود قرار بده:
  - `GET /api/orders?sessionId={sessionId}`
- در polling:
  - `404` در ثانیه‌های ابتدایی را به عنوان `still processing` در نظر بگیر (نه خطای نهایی).
  - روی وضعیت‌های نهایی polling را قطع کن: `PAID`, `FAILED`.
  - timeout معقول بگذار (مثلاً 2 تا 3 دقیقه) و پیام دوستانه نمایش بده.

### Backend (در صورت نیاز)
- اگر route فرانت `/api/store/orders/by-session/{sessionId}` است، endpoint هم‌نام اضافه کن.
- خروجی شامل حداقل این فیلدها باشد:
  - `orderId`, `orderNumber`, `paymentStatus`
- از منطق موجود status lookup استفاده مجدد کن تا رفتار ناسازگار ایجاد نشود.

### Acceptance Criteria
- پس از پرداخت تستی Stripe، صفحه success حداکثر ظرف چند ثانیه وضعیت `PAID/FAILED` را نشان می‌دهد.
- دیگر حالت stuck روی `Processing...` به‌خاطر mismatch endpoint رخ نمی‌دهد.

---

## تسک 2) اصلاح UX صفحه Order (الگوی کاربرپسند شبیه Amazon)

### Frontend (الزامی)
Order page را به چند بخش واضح بازطراحی کن:

1. **Header Card**
   - `Order #...` (شماره کاربرپسند، نه UUID خام)
   - تاریخ ثبت سفارش
   - badge وضعیت: `Paid` / `Pending confirmation` / `Failed`
   - اکشن‌ها:
     - `View Receipt`
     - `Invoice` (View / Download PDF / Email)
     - `Printable summary`

2. **Status Timeline**
   - مراحل: `Order placed` → `Payment confirmed` → `Preparing` → `Ready/Shipped` → `Completed`
   - اگر pending بود، متن راهنما نمایش بده که تایید ممکن است کمی زمان ببرد.

3. **Items + Totals**
   - لیست آیتم‌ها با qty و unit price
   - Summary کامل:
     - `Subtotal`
     - `Discount` (با نمایش coupon code)
     - `Shipping/Pickup`
     - `Tax`
     - `Total`
   - در حالت pending هم totals را مخفی نکن؛ فقط وضعیت پرداخت را pending نشان بده.

4. **Receipt/Invoice UX**
   - اگر هنوز آماده نیستند: دکمه disabled + tooltip مناسب.
   - بعد از تایید پرداخت: لینک‌ها فعال و قابل مشاهده/دانلود باشند.

5. **حالت‌های خطا/تاخیر**
   - به جای `Status unknown` از متن مفید استفاده کن:
     - `We're finalizing your order details...`
   - دکمه `Refresh status` و پیام پشتیبانی ارائه بده.

### Backend (در صورت نیاز)
- اگر داده‌های لازم برای UI کامل نیست، در API سفارش این فیلدها اضافه شود:
  - `orderNumber`, `placedAt`, `paymentStatus`
  - `subtotal`, `discount`, `shipping`, `tax`, `total`, `currency`
  - `paymentMethodMasked`, `paymentReference`
  - `receiptAvailable`, `invoiceAvailable`, `receiptUrl`, `invoiceUrl`

### Acceptance Criteria
- کاربر در صفحه Order همیشه مجموع مبالغ را می‌بیند.
- وضعیت سفارش معنی‌دار است (unknown حذف شود مگر خطای واقعی).
- اکشن Receipt/Invoice در جای مشخص و قابل فهم قرار دارد.

---

## تسک 3) اعمال واقعی کد تخفیف (UI + منطق نهایی پرداخت)

### Frontend (الزامی)
- دکمه Apply coupon باید API واقعی backend را صدا بزند (فقط state محلی نباشد).
- بعد از apply موفق:
  - totals را از پاسخ backend بروزرسانی کن **یا** cart summary را refetch کن.
- هنگام apply:
  - loading state روی دکمه
  - دکمه Pay موقتاً disable تا اعداد sync شوند.
- خطاهای coupon (invalid/expired/limit) با پیام واضح نمایش داده شود.

### Backend (الزامی اگر هنوز وجود ندارد)
- endpoint معتبر برای apply coupon روی cart داشته باشد.
- coupon را server-side اعتبارسنجی کند (فعال/انقضا/سقف استفاده...).
- totals را server-side محاسبه و ذخیره کند.
- هنگام ساخت Stripe Checkout Session تخفیف اعمال شود.
- هنگام webhook finalization، مبلغ نهایی از Stripe (source of truth) ذخیره شود.

### Acceptance Criteria
- بعد از Apply، مبلغ در Order Summary فوراً تغییر می‌کند.
- مبلغ ذخیره‌شده سفارش/پرداخت در DB، مبلغ **با تخفیف** است.
- اختلاف بین UI و DB در مبلغ پرداختی از بین می‌رود.

---

## تسک 4) Receipt + Invoice بعد از پرداخت موفق

### Frontend
- در success page بعد از `PAID` پیام واضح:
  - `Payment confirmed. A receipt has been sent to your email.`
- در order page اکشن‌های receipt/invoice قابل دسترسی باشند.

### Backend (الزامی)
- بعد از `PAID` در webhook:
  - receipt number تولید شود.
  - receipt به ایمیل مشتری ارسال شود.
- برای جلوگیری از ارسال تکراری (Stripe webhook retry):
  - وضعیت ارسال receipt idempotent نگه داشته شود (مثلاً با `receipt_sent_at`, `receipt_number`).
- در صورت نیاز migration برای فیلدهای بالا اضافه شود.

### Acceptance Criteria
- مشتری بعد از پرداخت موفق ایمیل receipt دریافت می‌کند.
- webhook تکراری باعث ارسال چندباره receipt نمی‌شود.

---

## تسک 5) QA / Test Plan

### Frontend تست‌ها
1. سناریوی پرداخت موفق:
   - success page → از pending به paid برود.
2. سناریوی پرداخت ناموفق:
   - success page → failed message با CTA مناسب.
3. سناریوی coupon معتبر:
   - Apply → totals تغییر کند.
4. coupon نامعتبر/منقضی:
   - پیام خطا + عدم تغییر totals.
5. order page:
   - totals، status badge، receipt/invoice actions نمایش صحیح.

### Backend تست‌ها
1. endpoint status by session پاسخ درست می‌دهد.
2. webhook paid، order/payment را نهایی می‌کند.
3. receipt idempotency روی retry webhook حفظ می‌شود.
4. discount amount در persistence درست ذخیره می‌شود.

---

## Definition of Done
- mismatch endpoint بین frontend/backend حل شده.
- UX صفحه Order بازطراحی شده و وضعیت/مبالغ شفاف است.
- coupon واقعاً روی مبلغ نهایی اعمال می‌شود (UI + DB + Stripe هم‌راستا).
- receipt/invoice flow برای کاربر قابل استفاده است.
- تست‌های اصلی پاس هستند.
