// middleware/auth.js
function isAuthenticated(req, res, next) {
    // 1. เช็กว่ามีข้อมูล User ใน Session ไหม
    if (req.session && req.session.user) {
        return next(); // ✅ มี Session ให้ผ่านไปทำขั้นตอนต่อไปได้เลย
    } 
    
    // 2. ถ้าไม่มี Session (ไม่ได้ล็อกอิน หรือเซสชันหมดอายุ)
    // เช็กว่าเป็นการเรียกจาก Fetch/AJAX หรือเป็นการเปิดหน้าจอปกติ
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        // ถ้าเป็น API ให้ส่ง JSON กลับไปบอกหน้าบ้าน
        return res.status(401).json({ 
            message: "กรุณาเข้าสู่ระบบก่อนใช้งาน",
            redirect: "/login.html" 
        });
    } else {
        // ถ้าเป็นคนพิมพ์ URL เข้ามาตรงๆ ให้เด้งไปหน้า Login ทันที
        return res.redirect('/login.html');
    }
}

module.exports = { isAuthenticated };