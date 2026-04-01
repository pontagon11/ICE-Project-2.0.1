// ==========================================
// 1. SIDEBAR MENU CONFIGURATION
// ==========================================
const SIDEBAR_MENU = [
  {
    title: "Dashboard", icon: "fa-gauge-high",
    items: [
      { name: "Dashboard",    icon: "fa-gauge-high",    link: "/home/home.html",    perm: "view_dashboard" }
    ]
  },
  {
    title: "Stock", icon: "fa-boxes-stacked",
    items: [
      { name: "Stock",         icon: "fa-boxes-stacked", link: "/stock/stock.html",          perm: "view_stock" },
      { name: "Stock Summary", icon: "fa-chart-bar",     link: "/stock/stock-summary.html",  perm: "view_stock_summary" },
      { name: "Materials",     icon: "fa-cubes",         link: "/materials/materials.html",  perm: "view_materials" },
      { name: "Products",      icon: "fa-box",           link: "/products/products.html",    perm: "view_products" }
    ]
  },
  {
    title: "Purchase", icon: "fa-cart-shopping",
    items: [
      { name: "Purchase List", icon: "fa-cart-shopping", link: "/purchase/purchase.html",     perm: "view_purchase" },
      { name: "Create PO",     icon: "fa-circle-plus",   link: "/purchase/purchase-add.html", perm: "create_purchase" },
      { name: "Approve PO",    icon: "fa-circle-check",  link: "/approve/approve.html",       perm: "approve_po" }
    ]
  },
  {
    title: "QC", icon: "fa-flask",
    items: [
      { name: "QC List",   icon: "fa-flask",       link: "/qc/qc.html",     perm: "view_qc" },
      { name: "Create QC", icon: "fa-circle-plus", link: "/qc/qc-add.html", perm: "create_qc" }
    ]
  },
  {
    title: "BOM", icon: "fa-list-check",
    items: [
      { name: "BOM List",   icon: "fa-list-check",  link: "/bom/bom.html",     perm: "view_bom" },
      { name: "Create BOM", icon: "fa-circle-plus", link: "/bom/bom-add.html", perm: "create_bom" }
    ]
  },
  {
    title: "Employees", icon: "fa-users",
    items: [
      { name: "Employee List", icon: "fa-users",     link: "/employees/employee.html",     perm: "view_employee" },
      { name: "Add Employee",  icon: "fa-user-plus", link: "/employees/employee-add.html", perm: "create_employee" }
    ]
  },
  {
    title: "Transactions", icon: "fa-right-left",
    items: [
      { name: "Transactions",    icon: "fa-right-left",  link: "/transactions/transactions.html",     perm: "view_transactions" },
      { name: "Add Transaction", icon: "fa-circle-plus", link: "/transactions/transactions-add.html", perm: "create_transactions" }
    ]
  },
  {
    title: "Admin", icon: "fa-shield-halved",
    items: [
      { name: "Manage Permissions", icon: "fa-key", link: "/permissions/manage-permissions.html", perm: "manage_permissions" }
    ]
  }
];

// ==========================================
// 2. GLOBAL STATE
// ==========================================
let currentUser = null;

// ==========================================
// 3. PERMISSION CHECK
// ==========================================
function hasPermission(permName) {
  if (!currentUser) return false;
  // Admin (role_id=1) bypasses all permission checks
  if (currentUser.role_id === 1 || currentUser.emp_role === 'admin') return true;
  if (!currentUser.permissions) return false;
  return currentUser.permissions.some(p =>
    typeof p === 'string' ? p === permName : p.perm_name === permName
  );
}

// ==========================================
// 4. LOAD USER (re-use window.currentUser from layout.js)
// ==========================================
async function loadUser() {
  if (window.currentUser) {
    currentUser = window.currentUser;
    return;
  }
  try {
    const res = await fetch("/auth/me", { credentials: "include" });
    const data = await res.json();
    if (data.loggedIn) {
      currentUser = data;
      window.currentUser = data;
    } else {
      window.location.href = "/";
    }
  } catch (err) {
    console.error("Load user error:", err);
  }
}

// ==========================================
// 5. RENDER SIDEBAR
// ==========================================
function renderSidebar(groups = SIDEBAR_MENU) {
  const menuList = document.getElementById("sidebarMenu");
  if (!menuList) return;

  const menuData = Array.isArray(groups) && groups.length > 0 ? groups : SIDEBAR_MENU;
  const currentPath = window.location.pathname;
  menuList.innerHTML = "";

  menuData.forEach(group => {
    const visibleItems = group.items.filter(item => hasPermission(item.perm));
    if (visibleItems.length === 0) return;

    const groupLi = document.createElement("li");
    groupLi.className = "sidebar-group";

    const header = document.createElement("div");
    header.className = "sidebar-group-header";
    header.innerHTML = `
      <i class="fa-solid ${group.icon} icon"></i>
      <span class="group-label">${group.title}</span>
      <i class="fa-solid fa-chevron-down chevron"></i>
    `;

    const itemsUl = document.createElement("ul");
    itemsUl.className = "sidebar-group-items";

    visibleItems.forEach(item => {
      const isActive = currentPath === item.link;
      const li = document.createElement("li");
      li.className = "sidebar-item";
      li.innerHTML = `
        <a href="${item.link}" class="${isActive ? 'active' : ''}" data-tooltip="${item.name}">
          <i class="fa-solid ${item.icon} item-icon"></i>
          <span class="item-label">${item.name}</span>
        </a>`;
      itemsUl.appendChild(li);
    });

    header.addEventListener("click", () => {
      header.classList.toggle("collapsed");
      itemsUl.classList.toggle("hidden");
    });

    groupLi.appendChild(header);
    groupLi.appendChild(itemsUl);
    menuList.appendChild(groupLi);
  });

  const toggleBtn = document.getElementById("sidebarToggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const appLayout = document.getElementById("app-layout");
      if (appLayout) appLayout.classList.toggle("sidebar-collapsed");
    });
  }
}

// ==========================================
// 6. UPDATE PROFILE DOM
// ==========================================
function updateUserProfileDOM() {
  const user = window.currentUser;
  if (!user) return;
  const fullName = `${user.emp_fname || ''} ${user.emp_lname || ''}`.trim();
  const fileName = user.emp_img ? user.emp_img.split('/').pop() : null;
  const userImg  = fileName ? `/img/emp/${fileName}?t=${Date.now()}` : null;

  const sbImg  = document.getElementById("sidebarProfileImg");
  const sbIcon = sbImg?.nextElementSibling;
  const sbName = document.getElementById("sidebarUsername");
  if (sbName) sbName.innerText = fullName;
  if (sbImg && userImg) {
    sbImg.src = userImg; sbImg.style.display = '';
    if (sbIcon) sbIcon.style.display = 'none';
    sbImg.onerror = () => { sbImg.style.display = 'none'; if (sbIcon) sbIcon.style.display = 'flex'; };
  } else if (sbImg) {
    sbImg.style.display = 'none'; if (sbIcon) sbIcon.style.display = 'flex';
  }

  const navImg  = document.getElementById("navProfileImg");
  const navIcon = navImg?.nextElementSibling;
  const navName = document.getElementById("navUsername");
  if (navName) navName.innerText = fullName;
  if (navImg && userImg) {
    navImg.src = userImg; navImg.style.display = '';
    if (navIcon) navIcon.style.display = 'none';
    navImg.onerror = () => { navImg.style.display = 'none'; if (navIcon) navIcon.style.display = 'flex'; };
  } else if (navImg) {
    navImg.style.display = 'none'; if (navIcon) navIcon.style.display = 'flex';
  }
}