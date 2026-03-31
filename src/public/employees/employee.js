const API = "/employees";
let allEmployees = [];

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    // โหลดข้อมูล User และวาด Sidebar
    if (typeof loadUser === "function") {
        await loadUser();
    }
    
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }

    // GUARD PAGE: เช็กสิทธิ์การดูรายชื่อพนักงาน
    if (typeof hasPermission === "function") {
        if (!hasPermission("view_employee")) {
            await swalError("คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้");
            window.location.href = "/home/home.html";
            return;
        }
    }

    // จัดการปุ่ม "เพิ่มพนักงาน" ตามสิทธิ์
    const addBtn = document.getElementById("addEmployeeBtn");
    if (addBtn) {
        if (!hasPermission("create_employee")) {
            addBtn.style.display = "none";
        } else {
            addBtn.onclick = () => window.location.href = "/employees/employee-add.html";
        }
    }

    // โหลดข้อมูลเริ่มต้น
    await loadEmployees();

    // ผูก Event ค้นหาและกรองข้อมูล
    setupFilters();
});

/* ====================== FETCH DATA ====================== */
async function loadEmployees() {
    try {
        const tbody = document.getElementById("employeeTableBody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center">⌛ Loading...</td></tr>`;

        const res = await fetch(API, {
            headers: getAuthHeaders(),
            credentials: "include" // รองรับทั้ง Token และ Session Cookie
        });

        if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");

        allEmployees = await res.json();
        renderEmployees(allEmployees);
        
        // ถ้ามีฟังก์ชันเตรียม Filter ให้เรียกใช้ (เช่น ดึงรายชื่อแผนกมาใส่ใน select)
        if (typeof populateFilters === "function") {
            populateFilters(allEmployees);
        }

    } catch (err) {
        console.error(err);
        await swalError("โหลดข้อมูลพนักงานไม่สำเร็จ");
    }
}

/* ====================== RENDER TABLE ====================== */
function renderEmployees(data) {
    const tbody = document.getElementById("employeeTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">ไม่พบข้อมูลพนักงาน</td></tr>`;
        return;
    }

    data.forEach(emp => {
        const canEdit = typeof hasPermission === "function" && hasPermission("edit_employee");
        
        // จัดการรูปโปรไฟล์ (ถ้าไม่มีให้ใช้รูป Default)
        const imgPath = emp.emp_img ? `/uploads/employees/${emp.emp_img}` : "/img/Haro.webp";
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td class="text-center">
                <img src="${imgPath}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
            </td>
            <td><strong>${emp.emp_fname} ${emp.emp_lname}</strong><br><small class="text-muted">${emp.emp_email || '-'}</small></td>
            <td>${emp.dept_name || '-'}</td>
            <td><span class="badge badge-info">${emp.role_name || '-'}</span></td>
            <td>
                <span class="status-dot ${emp.status === 'active' ? 'bg-success' : 'bg-danger'}"></span>
                ${emp.status === 'active' ? 'ทำงานอยู่' : 'พ้นสภาพ'}
            </td>
            <td class="text-center">
                ${canEdit ? `
                    <button class="btn-icon edit-btn" onclick="editEmployee(${emp.emp_id})">✏️</button>
                    <button class="btn-icon delete-btn" onclick="deleteEmployee(${emp.emp_id})">🗑️</button>
                ` : "-"}
            </td>
        `;
        tbody.appendChild(row);
    });
}

/* ====================== SEARCH & FILTER ====================== */
function setupFilters() {
    const filters = ["searchInput", "statusFilter", "roleFilter", "deptFilter"];
    filters.forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener("input", filterEmployees);
        el?.addEventListener("change", filterEmployees);
    });
}

function filterEmployees() {
    const searchQuery = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
    const statusVal = document.getElementById("statusFilter")?.value || "";
    const roleVal = document.getElementById("roleFilter")?.value || "";
    const deptVal = document.getElementById("deptFilter")?.value || "";

    const filtered = allEmployees.filter(emp => {
        const matchSearch = (emp.emp_fname + " " + emp.emp_lname).toLowerCase().includes(searchQuery) ||
                            (emp.emp_username || "").toLowerCase().includes(searchQuery);
        const matchStatus = statusVal === "" || emp.status === statusVal;
        const matchRole = roleVal === "" || String(emp.role_id) === roleVal;
        const matchDept = deptVal === "" || String(emp.dept_id) === deptVal;

        return matchSearch && matchStatus && matchRole && matchDept;
    });

    renderEmployees(filtered);
}

/* ====================== DELETE ACTION ====================== */
async function deleteEmployee(id) {
    if (!hasPermission("edit_employee")) {
        await swalError("คุณไม่มีสิทธิ์ลบข้อมูลพนักงาน");
        return;
    }

    const { isConfirmed } = await swalConfirm("การลบอาจส่งผลกระทบต่อประวัติการทำรายการต่างๆ", "ยืนยันการลบพนักงาน");
    if (!isConfirmed) return;

    try {
        const res = await fetch(`${API}/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
            credentials: "include"
        });

        if (res.ok) {
            await swalSuccess("ลบข้อมูลพนักงานสำเร็จ");
            loadEmployees();
        } else {
            const result = await res.json();
            await swalError(result.message || "ลบไม่สำเร็จ");
        }
    } catch (err) {
        console.error(err);
        await swalError("เกิดข้อผิดพลาดจากเซิร์ฟเวอร์");
    }
}

/* ====================== AUTH HELPERS ====================== */
function getAuthHeaders() {
    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

function editEmployee(id) {
    window.location.href = `/employees/employee-edit.html?id=${id}`;
}