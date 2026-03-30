const API_URL = "/employees";
const ROLE_API = "/roles";
const DEPT_API = "/departments";

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    // โหลดข้อมูล User และวาด Sidebar
    if (typeof loadUser === "function") {
        await loadUser();
    }
    
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }

    // GUARD PAGE: เช็กสิทธิ์การแก้ไข
    if (typeof hasPermission === "function") {
        if (!hasPermission("edit_employee")) {
            alert("❌ คุณไม่มีสิทธิ์แก้ไขข้อมูลพนักงาน");
            window.location.href = "employee.html";
            return;
        }
    }

    // ดึง ID จาก URL
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
        alert("ไม่พบรหัสพนักงาน (Employee ID)");
        window.location.href = "employee.html";
        return;
    }

    // Setup UI Components
    setupImageUpload();
    setupPasswordToggle();
    setupButtons(id);

    // โหลดข้อมูล (เรียงลำดับ)
    await loadRoles();
    await loadDepartments();
    await loadEmployee(id);
});

/* ================= LOAD EMPLOYEE DATA ================= */
async function loadEmployee(id) {
    try {
        const res = await fetch(`${API_URL}/${id}`, { credentials: "include" });
        const data = await res.json();

        if (!res.ok) {
            alert("ไม่พบข้อมูลพนักงานในระบบ");
            window.location.href = "employee.html";
            return;
        }

        // Mapping ข้อมูลลง Form
        document.getElementById("emp_fname").value = data.emp_fname || "";
        document.getElementById("emp_lname").value = data.emp_lname || "";
        document.getElementById("role_id").value = data.role_id || "";
        document.getElementById("dept_id").value = data.dept_id || "";
        document.getElementById("emp_username").value = data.emp_username || "";
        document.getElementById("emp_password").value = ""; // เคลียร์ช่องรหัสผ่านเสมอเพื่อความปลอดภัย
        document.getElementById("emp_email").value = data.emp_email || "";
        document.getElementById("emp_tel").value = data.emp_tel || "";
        document.getElementById("status").value = data.status || "active";

        if (data.emp_img) {
            const previewImg = document.getElementById("previewImg");
            // ปรับ Path รูปภาพให้ตรงกับที่เก็บใน Server
            previewImg.src = `/uploads/employees/${data.emp_img}`; 
            previewImg.style.display = "block";
        }

    } catch (err) {
        console.error("Load employee error:", err);
        alert("เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน");
    }
}

/* ================= UPDATE ACTION ================= */
function setupButtons(id) {
    const editBtn = document.getElementById("editBtn");
    const cancelBtn = document.getElementById("cancelBtn");

    cancelBtn?.addEventListener("click", () => {
        window.location.href = "employee.html";
    });

    editBtn?.addEventListener("click", async () => {
        const fname = document.getElementById("emp_fname").value.trim();
        const lname = document.getElementById("emp_lname").value.trim();

        if (!fname || !lname) {
            alert("กรุณาระบุชื่อและนามสกุลพนักงาน");
            return;
        }

        editBtn.disabled = true;
        editBtn.textContent = "Updating...";

        const formData = new FormData();
        formData.append("emp_fname", fname);
        formData.append("emp_lname", lname);
        formData.append("role_id", document.getElementById("role_id").value);
        formData.append("dept_id", document.getElementById("dept_id").value);
        formData.append("emp_username", document.getElementById("emp_username").value);
        formData.append("emp_email", document.getElementById("emp_email").value);
        formData.append("emp_tel", document.getElementById("emp_tel").value);
        formData.append("status", document.getElementById("status").value);

        // ส่ง Password เฉพาะเมื่อมีการพิมพ์ใหม่เท่านั้น
        const password = document.getElementById("emp_password").value;
        if (password.length > 0) {
            formData.append("emp_password", password);
        }

        const fileInput = document.getElementById("emp_img");
        if (fileInput.files.length > 0) {
            formData.append("emp_img", fileInput.files[0]);
        }

        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: "PUT",
                credentials: "include",
                body: formData
            });

            const result = await res.json();

            if (res.ok) {
                alert("อัปเดตข้อมูลพนักงานสำเร็จ ✅");
                window.location.href = "employee.html";
            } else {
                alert(result.message || "แก้ไขไม่สำเร็จ");
                editBtn.disabled = false;
                editBtn.textContent = "SAVE CHANGES";
            }
        } catch (err) {
            console.error("Update error:", err);
            alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
            editBtn.disabled = false;
            editBtn.textContent = "SAVE CHANGES";
        }
    });
}

/* ================= IMAGE PREVIEW ================= */
function setupImageUpload() {
    const chooseBtn = document.getElementById("chooseImageBtn");
    const fileInput = document.getElementById("emp_img");
    const previewImg = document.getElementById("previewImg");

    if (!chooseBtn || !fileInput) return;

    chooseBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewImg.style.display = "block";
        };
        reader.readAsDataURL(file);
    });
}

/* ================= PASSWORD TOGGLE ================= */
function setupPasswordToggle() {
    const toggle = document.getElementById("toggle-password");
    const password = document.getElementById("emp_password");
    if (!toggle || !password) return;

    toggle.addEventListener("click", () => {
        const isPassword = password.type === "password";
        password.type = isPassword ? "text" : "password";
        toggle.textContent = isPassword ? "🙈" : "👁️";
    });
}

/* ================= DROPDOWNS ================= */
async function loadRoles() {
    try {
        const res = await fetch(ROLE_API, { credentials: "include" });
        const roles = await res.json();
        const roleSelect = document.getElementById("role_id");
        if (!roleSelect) return;

        roleSelect.innerHTML = '<option value="">Select Role</option>';
        roles.forEach(role => {
            const option = document.createElement("option");
            option.value = role.role_id;
            option.textContent = role.role_name;
            roleSelect.appendChild(option);
        });
    } catch (err) { console.error("Load roles error:", err); }
}

async function loadDepartments() {
    try {
        const res = await fetch(DEPT_API, { credentials: "include" });
        const depts = await res.json();
        const deptSelect = document.getElementById("dept_id");
        if (!deptSelect) return;

        deptSelect.innerHTML = '<option value="">Select Department</option>';
        depts.forEach(dept => {
            const option = document.createElement("option");
            option.value = dept.dept_id;
            option.textContent = dept.dept_name;
            deptSelect.appendChild(option);
        });
    } catch (err) { console.error("Load departments error:", err); }
}