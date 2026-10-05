-- منح صلاحية القراءة للأعمدة المضافة حديثاً في جدول store_settings لزوار المتجر والمستخدمين المسجلين
GRANT SELECT (ios_badge_image, android_badge_image)
ON public.store_settings TO anon, authenticated;
