/* ========================== PERMISSION HELPER ========================== */
function hasPermission(name) {
    const user = window.currentUser || JSON.parse(localStorage.getItem("user"));
    
    // ถ้าเป็น admin ให้ผ่านทุกด่าน
    if (user?.emp_role === 'admin') return true;

    const perms = user?.permissions || [];
    return perms.some(p => (typeof p === 'string' ? p === name : p.perm_name === name)) ||
           perms.includes(name);
}

/* ========================== PROFILE SETUP ========================== */
function setupProfile(user) {
    const nameEl = document.getElementById("username");
    if (nameEl) {
        nameEl.innerText = `${user.emp_fname || ''} ${user.emp_lname || user.emp_username || 'User'}`;
    }

    const imgEl = document.getElementById("profileImg");
    if (imgEl) {
        const fileName = user.emp_img ? user.emp_img.split('/').pop() : null;
        const userImg = fileName ? `/img/emp/${fileName}` : "/img/Haro.webp";

        imgEl.src = `${userImg}?t=${new Date().getTime()}`;

        imgEl.onerror = () => {
            imgEl.src = "/img/Haro.webp";
        };
    }
}

/* ========================== NAVIGATION CONTROL ========================== */
function setupNavbar() {
    // 🎯 นี่คือ menuConfig ที่รวมทุกหน้าตามที่คุณต้องการ
    const menuConfig = {
        "menuHome": "view_dashboard",
        "menuEmployees": "view_employee",
        "menuPermissions": "manage_permissions"
    };

    for (const [id, perm] of Object.entries(menuConfig)) {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = hasPermission(perm) ? "inline-block" : "none";
        }
    }
}

/* ========================== MAIN INITIALIZATION ========================= */
document.addEventListener("DOMContentLoaded", async () => {
    const navPlaceholder = document.getElementById("navbar-placeholder");
    const container = document.getElementById("sidebarContainer");

    try {
        /* 1. AUTH CHECK - ยืนยันตัวตนกับ Backend */
        const meRes = await fetch("/auth/me", { credentials: "include" });

        if (meRes.status !== 200) {
            console.warn("Unauthorized access, redirecting to login...");
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        const user = await meRes.json();

        // เก็บข้อมูลลง Global และ LocalStorage
        window.currentUser = user;
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("permissions", JSON.stringify(user.permissions || []));

        /* 2. NAVBAR LOADING */
        if (navPlaceholder) {
            const res = await fetch("navbar.html");
            if (res.ok) {
                navPlaceholder.innerHTML = await res.text();
                console.log("⚓ Navbar Injected");
                
                // ผูกปุ่ม Logout หลังจากฉีด HTML เสร็จ
                document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (typeof logout === "function") logout();
                });
            }
        }

        /* 3. UI SETUP (Profile & Navbar Permissions) */
        setupProfile(user);
        setupNavbar();

        /* 4. SIDEBAR LOADING */
        if (container) {
            const res = await fetch("sidebar.html");
            if (res.ok) {
                container.innerHTML = await res.text();
                // สั่งให้ sidebar.js ทำงานต่อ
                if (typeof loadUser === "function") {
                    await loadUser();
                    renderSidebar();
                }
            }
        }

    } catch (err) {
        console.error("Layout Initialization Error:", err);
    }
});