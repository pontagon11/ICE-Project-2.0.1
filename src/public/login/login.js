const API_LOGIN = "/login";

/* ================== LOGIN PROCESS ===================== */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    if (!form) {
        console.error("❌ หา Form ID 'loginForm' ไม่เจอใน HTML!");
        return;
    }

    // Password toggle
    const toggleBtn = document.getElementById("togglePassword");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const pwd = document.getElementById("password");
            const icon = toggleBtn.querySelector("i");
            if (pwd.type === "password") {
                pwd.type = "text";
                icon.classList.replace("fa-eye", "fa-eye-slash");
            } else {
                pwd.type = "password";
                icon.classList.replace("fa-eye-slash", "fa-eye");
            }
        });
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault(); // ✅ ป้องกันหน้าเว็บ Refresh
        console.log("1. [FRONTEND] เริ่มกระบวนการ Login...");

        const usernameEl = document.getElementById("username");
        const passwordEl = document.getElementById("password");
        const errorBox = document.getElementById("errorMsg");

        // เช็คว่าหา Element เจอไหม
        if (!usernameEl || !passwordEl) {
            console.error("❌ หาช่องกรอก Username หรือ Password ไม่เจอ!");
            return;
        }

        const username = usernameEl.value.trim();
        const password = passwordEl.value.trim();
        console.log("2. [FRONTEND] ข้อมูลที่รับมา:", { username });

        if (errorBox) { errorBox.innerText = ""; errorBox.style.display = "none"; }

        if (!username || !password) {
            if (errorBox) { errorBox.innerText = "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"; errorBox.style.display = "block"; }
            return;
        }

        try {
            console.log("3. [FRONTEND] กำลังยิง Fetch ไปที่:", API_LOGIN);
            
            const res = await fetch(API_LOGIN, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, password })
            });

            console.log("4. [FRONTEND] สถานะการตอบกลับ (Status):", res.status);
            
            const data = await res.json();
            console.log("5. [FRONTEND] ข้อมูลจาก Server:", data);

            if (!res.ok) {
                throw new Error(data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
            }

            // ตรวจสอบ Role
            if (!data.role_id) {
                throw new Error("บัญชีนี้ยังไม่ได้กำหนดสิทธิ์ (Role ID missing)");
            }

            // ✅ บันทึกข้อมูลลง LocalStorage
            console.log("6. [FRONTEND] บันทึกข้อมูลลง LocalStorage...");
            localStorage.setItem("permissions", JSON.stringify(data.permissions || []));
            localStorage.setItem("role", data.role_id);
            localStorage.setItem("fname", data.emp_fname || "");
            localStorage.setItem("lname", data.emp_lname || "");
            localStorage.setItem("emp_id", data.emp_id || "");
            localStorage.setItem("emp_img", data.emp_img || "/img/default-users.png");

            console.log("7. [FRONTEND] กำลังย้ายไปหน้า home.html");
            window.location.href = "/home/home.html";

        } catch (err) {
            console.error("❌ [FRONTEND] Login Error:", err.message);
            localStorage.clear();
            if (errorBox) { errorBox.innerText = err.message; errorBox.style.display = "block"; }
        }
    });
});

/* ========================================== SESSION CHECK ========================================== */
// ตัวนี้จะถูกเรียกใช้ในหน้าอื่นๆ เพื่อยืนยันตัวตน
async function checkLogin() {
    try {
        const res = await fetch("/auth/me", { credentials: "include" });
        
        if (!res.ok) {
            localStorage.clear();
            if (!window.location.pathname.endsWith("/")) {
                window.location.href = "/";
            }
            return null;
        }

        const user = await res.json();
        
        if (user.permissions) {
            localStorage.setItem("permissions", JSON.stringify(user.permissions));
        }
        localStorage.setItem("fname", user.emp_fname || "");
        localStorage.setItem("lname", user.emp_lname || "");

        return user; 

    } catch (err) {
        console.error("CheckLogin Error:", err);
        return null;
    }
}

/* ========================================== LOGOUT ========================================== */
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