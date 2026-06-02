@echo off
title Nursing Portal Admin Launcher
chcp 65001 > nul
cls

echo ============================================================
echo 🩺 منصة التمريض المكثف - تشغيل لوحة التحكم للأدمن 🩺
echo ============================================================
echo.
echo [1/3] جاري التحقق من وجود بايثون (Python)...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ❌ خطأ: لم يتم العثور على لغة بايثون (Python) في هذا الجهاز!
    echo يرجى تحميل وتثبيت بايثون أولاً من: https://www.python.org/downloads/
    echo وتأكد من تفعيل خيار "Add Python to PATH" أثناء التثبيت.
    echo.
    pause
    exit /b
)
echo ✅ تم العثور على بايثون بنجاح.

echo.
echo [2/3] جاري بدء تشغيل خادم لوحة التحكم المحلي...
start "" http://localhost:8000/admin.html
echo.
echo ============================================================
echo 🚀 الخادم يعمل الآن بنجاح على: http://localhost:8000
echo.
echo 💡 لمشاركة التحديثات مع الطلاب:
echo 1. أضف أو عدل المحاضرات من صفحة الأدمن في المتصفح.
echo 2. بعد الانتهاء، اسحب مجلد "Nursing_Portal" بالكامل وارميه في Netlify Drop
echo    أو ارفعه على GitHub Pages لتحديث اللينك العام أونلاين مجاناً!
echo.
echo ⚠️ الرجاء عدم إغلاق هذه النافذة طالما أنك تستخدم لوحة التحكم.
echo لإيقاف الخادم، أغلق هذه النافذة أو اضغط Ctrl + C.
echo ============================================================
echo.

python server.py

pause
