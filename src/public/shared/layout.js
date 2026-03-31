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
    const fullName = `${user.emp_fname || ''} ${user.emp_lname || user.emp_username || 'User'}`.trim();
    const fileName = user.emp_img ? user.emp_img.split('/').pop() : null;
    const userImg = `${fileName ? `/img/emp/${fileName}` : "/img/Haro.webp"}?t=${Date.now()}`;

    // Navbar elements
    const navName = document.getElementById("navUsername");
    const navImg  = document.getElementById("navProfileImg");
    if (navName) navName.innerText = fullName;
    if (navImg)  { navImg.src = userImg; navImg.onerror = () => { navImg.src = "/img/Haro.webp"; }; }

    // Sidebar elements (injected later — updateUserProfileDOM() also covers these)
    const sbName = document.getElementById("sidebarUsername");
    const sbImg  = document.getElementById("sidebarProfileImg");
    if (sbName) sbName.innerText = fullName;
    if (sbImg)  { sbImg.src = userImg; sbImg.onerror = () => { sbImg.src = "/img/Haro.webp"; }; }
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

/* ========================== FLEX LAYOUT BUILDER ========================= */
function setupFlexLayout() {
    const body = document.body;
    const navEl = document.getElementById('navbar-placeholder');
    const sidebarEl = document.getElementById('sidebarContainer');
    if (!sidebarEl) return;

    const appLayout = document.createElement('div');
    appLayout.id = 'app-layout';

    const mainArea = document.createElement('main');
    mainArea.id = 'main-content';

    // Snapshot of direct body children — skip navbar-placeholder and <header>
    // (they stay in body as full-width elements above the flex row)
    const directChildren = Array.from(body.children).filter(
        el => el !== navEl && el.tagName !== 'HEADER'
    );

    directChildren.forEach(child => {
        if (child === sidebarEl) {
            // sidebar is a direct body child
            appLayout.appendChild(sidebarEl);
        } else if (child.contains(sidebarEl)) {
            // sidebar is nested inside a wrapper — extract it
            child.removeChild(sidebarEl);
            appLayout.appendChild(sidebarEl);
            if (child.children.length > 0 || child.textContent.trim()) {
                mainArea.appendChild(child);
            } else {
                child.remove(); // Remove empty wrapper section
            }
        } else {
            mainArea.appendChild(child);
        }
    });

    appLayout.appendChild(mainArea);
    body.appendChild(appLayout);
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
            window.location.href = "/";
            return;
        }

        const user = await meRes.json();

        // เก็บข้อมูลลง Global และ LocalStorage
        window.currentUser = user;
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("permissions", JSON.stringify(user.permissions || []));

        /* 2. NAVBAR LOADING */
        if (navPlaceholder) {
            const res = await fetch("/shared/navbar.html");
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
            const res = await fetch("/shared/sidebar.html");
            if (res.ok) {
                container.innerHTML = await res.text();
                if (typeof loadUser === "function") {
                    await loadUser();
                    renderSidebar();
                }
                // Build vertical flex layout (sidebar left, content right)
                setupFlexLayout();
                // Update profile picture/name inside sidebar
                if (typeof updateUserProfileDOM === "function") {
                    updateUserProfileDOM();
                }
            }
        }

    } catch (err) {
        console.error("Layout Initialization Error:", err);
    }
});