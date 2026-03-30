// ==========================================
// 1. SIDEBAR CONFIGURATION
// ==========================================
const SIDEBAR_MENU = [
  {
    title: "📊 Dashboard",
    items: [{ name: "Dashboard", link: "home.html", perm: "view_dashboard" }]
  },
  {
    title: "📦 Stock",
    items: [
      { name: "Stock", link: "stock.html", perm: "view_stock" },
      { name: "Stock Summary", link: "stock-summary.html", perm: "view_stock_summary" },
      { name: "Materials", link: "materials.html", perm: "view_materials" },
      { name: "Products", link: "products.html", perm: "view_products" }
    ]
  },
  {
    title: "🛒 Purchase",
    items: [
      { name: "Purchase List", link: "purchase.html", perm: "view_purchase" },
      { name: "Create PO", link: "purchase-add.html", perm: "create_purchase" },
      { name: "Approve PO", link: "approve.html", perm: "approve_po" }
    ]
  },
  {
    title: "🧪 QC",
    items: [
      { name: "QC List", link: "qc.html", perm: "view_qc" },
      { name: "Create QC", link: "qc-add.html", perm: "create_qc" }
    ]
  },
  {
    title: "📑 BOM",
    items: [
      { name: "BOM List", link: "bom.html", perm: "view_bom" },
      { name: "Create BOM", link: "bom-add.html", perm: "create_bom" }
    ]
  },
  {
    title: "👨‍💼 Employees",
    items: [
      { name: "Employee List", link: "employees.html", perm: "view_employee" },
      { name: "Add Employee", link: "employee-add.html", perm: "create_employee" }
    ]
  },
  {
    title: "📊 Transactions",
    items: [
      { name: "Transactions", link: "transactions.html", perm: "view_transactions" },
      { name: "Add Transaction", link: "transaction-add.html", perm: "create_transactions" }
    ]
  },
  {
    title: "⚙️ Admin",
    items: [
      { name: "Manage Permissions", link: "manage-permissions.html", perm: "manage_permissions" }
    ]
  }
];

// ==========================================
// 2. GLOBAL STATE
// ==========================================
let currentUser = null;

// ==========================================
// 3. CORE FUNCTIONS
// ==========================================

// เช็คสิทธิ์จากข้อมูล User ที่ได้จาก Backend
function hasPermission(permName) {
  if (!currentUser || !currentUser.permissions) return false;

  return currentUser.permissions.some(p => 
    (typeof p === 'string' ? p === permName : p.perm_name === permName)
  );
}

// โหลดข้อมูลผู้ใช้จาก Session
async function loadUser() {
  try {
    const res = await fetch("/auth/me", { credentials: "include" });
    const data = await res.json();

    if (data.loggedIn) {
      currentUser = data;
      window.currentUser = data;
      console.log("✅ User Logged In:", currentUser.emp_username);

    } else {
      window.location.href = "login.html";
    }
  } catch (err) {
    console.error("❌ Load user error:", err);
  }
}

// วาด Sidebar ลงหน้าจอ
function renderSidebar(groups = SIDEBAR_MENU) {
  const menuList = document.getElementById("sidebarMenu");
  if (!menuList) {
    console.error("❌ หา <ul id='sidebarMenu'> ไม่เจอ! (เช็คว่า layout.js ฉีด HTML หรือยัง)");
    return;
  }

  // ใช้ menuData เสมอเพื่อให้มั่นใจว่ามีข้อมูลวาด
  const menuData = (Array.isArray(groups) && groups.length > 0) ? groups : SIDEBAR_MENU;

  menuList.innerHTML = "";

  menuData.forEach(group => {
    const visibleItems = group.items.filter(item => hasPermission(item.perm));

    if (visibleItems.length > 0) {
      // 1. หัวข้อกลุ่ม
      const headerLi = document.createElement("li");
      headerLi.className = "menu-header-item";
      headerLi.innerHTML = `<span class="menu-title" style="display:block; padding: 10px 15px; font-weight: bold; color: #888;">${group.title}</span>`;
      menuList.appendChild(headerLi);

      // 2. รายการเมนู
      visibleItems.forEach(item => {
        const li = document.createElement("li");
        const currentPath = window.location.pathname;
        const isActive = currentPath.includes(item.link) ? "active" : "";

        li.innerHTML = `
          <a href="${item.link}" class="${isActive}" style="display: flex; align-items: center; padding: 8px 20px; text-decoration: none; color: inherit;">
            <span class="menu-name">${item.name}</span>
          </a>`;
        menuList.appendChild(li);
      });
    }
  });

}

// อัปเดตชื่อและรูปโปรไฟล์
function updateUserProfileDOM() {
  const user = window.currentUser;
  const imgEl = document.getElementById("profileImg");
  const nameEl = document.getElementById("username");

  if (nameEl) nameEl.innerText = `${user.emp_fname} ${user.emp_lname}`;

  if (imgEl) {
    // ใช้ Path ที่เราพิสูจน์แล้วว่าเจอรูปจริง (public/img/emp/)
    const fileName = user.emp_img ? user.emp_img.split('/').pop() : null;
    imgEl.src = fileName ? `/img/emp/${fileName}?t=${Date.now()}` : "/img/Haro.webp";

    imgEl.onerror = () => { imgEl.src = "/img/Haro.webp"; };
  }
}
