/* ========================== LOGOUT LOGIC ========================== */
// Called by layout.js after navbar is injected and logout button exists
async function logout() {
    const { isConfirmed } = await swalConfirm("คุณต้องการออกจากระบบใช่หรือไม่?", "ออกจากระบบ");
    if (!isConfirmed) return;

    try {
        await fetch("/logout", {
            method: "POST",
            credentials: "include"
        });
    } catch (err) {
        console.error("Logout error:", err);
    } finally {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/";
    }
}

/* ========================== CHECK LOGIN & SYNC DATA ========================== */
async function checkLogin() {
    try {
        const res = await fetch("/auth/me", { credentials: "include" });

        if (!res.ok) {
            throw new Error("Unauthorized");
        }

        const user = await res.json();

        // จัดการข้อมูล Permissions
        const permStrings = Array.isArray(user.permissions) ? user.permissions : [];

        localStorage.setItem("permissions", JSON.stringify(permStrings));
        localStorage.setItem("role", user.role_id || "");
        localStorage.setItem("username", user.emp_fname || "User");
        localStorage.setItem("emp_id", user.emp_id || "");

        return user;

    } catch (err) {
        console.warn("Session expired or invalid:", err.message);
        localStorage.clear();

        // ถ้าไม่ได้อยู่ที่หน้า login.html ให้ดีดกลับไปหน้า login
        if (!window.location.pathname.endsWith("/")) {
            window.location.href = "/";
        }
        return null;
    }
}

/* ========================== PERMISSION HELPER ========================== */
// ใช้สำหรับเช็คสิทธิ์ในหน้าเว็บ
function hasPermission(permissionName) {
    try {
        //  ดึงข้อมูลจาก LocalStorage
        const permsRaw = localStorage.getItem("permissions");
        if (!permsRaw) return false;

        // 2. แปลงจาก JSON String เป็น Array
        const permissions = JSON.parse(permsRaw);

        //  เช็คว่ามีสิทธิ์นั้นอยู่ใน Array หรือไม่
        if (Array.isArray(permissions)) {
            return permissions.includes(permissionName);
        }

        //  กรณีฉุกเฉิน: ถ้าเก็บเป็น String ดิบ
        return permsRaw.includes(permissionName);
        
    } catch (err) {
        console.error("Permission check error:", err);
        return false;
    }
}

if (!window.location.pathname.endsWith("/")) {
    window.authReady = checkLogin();
}