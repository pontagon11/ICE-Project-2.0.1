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

    // GUARD PAGE: เช็กสิทธิ์การจัดการพนักงาน
    if (typeof hasPermission === "function") {
        if (!hasPermission("create_employee")) {
            await swalError("คุณไม่มีสิทธิ์เพิ่มข้อมูลพนักงาน");
            window.location.href = "/employees/employee.html";
            return;
        }
    }

    // ตั้งค่า UI Components
    setupImageUpload();
    setupPasswordToggle();
    setupButtons();

    // โหลดข้อมูล Dropdown
    loadRoles();
    loadDepartments();
});

/* ================= IMAGE UPLOAD PREVIEW ================= */
function setupImageUpload() {
    const chooseBtn = document.getElementById("chooseImageBtn");
    const fileInput = document.getElementById("emp_img");
    const previewImg = document.getElementById("previewImg");

    if (!chooseBtn || !fileInput) return;

    chooseBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;

        // เช็คขนาดไฟล์ (ไม่ควรเกิน 2MB)
        if (file.size > 2 * 1024 * 1024) {
            await swalWarning("ไฟล์รูปภาพใหญ่เกินไป (จำกัด 2MB)");
            fileInput.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewImg.style.display = "block";
            const placeholder = document.getElementById("previewPlaceholder");
            if (placeholder) placeholder.style.display = "none";
        };
        reader.readAsDataURL(file);
    });
}

/* ================= PASSWORD TOGGLE ================= */
function setupPasswordToggle() {
    const toggleBtn = document.getElementById("toggle-password");
    const passwordInput = document.getElementById("emp_password");

    if (!toggleBtn || !passwordInput) return;

    toggleBtn.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        toggleBtn.textContent = isPassword ? "🙈" : "👁️"; // เปลี่ยนไอคอนตามสถานะ
    });
}

/* ================= SAVE LOGIC ================= */
function setupButtons() {
    const saveBtn = document.getElementById("saveBtn");
    const cancelBtn = document.getElementById("cancelBtn");

    cancelBtn?.addEventListener("click", () => {
        window.location.href = "/employees/employee.html";
    });

    saveBtn?.addEventListener("click", async (e) => {
        e.preventDefault();
        await saveEmployee();
    });
}

async function saveEmployee() {
    const saveBtn = document.getElementById("saveBtn");
    const fileInput = document.getElementById("emp_img");
    const fname = document.getElementById("emp_fname").value.trim();
    const lname = document.getElementById("emp_lname").value.trim();
    const email = document.getElementById("emp_email").value.trim();
    const tel = document.getElementById("emp_tel").value.trim();
    const dept = document.getElementById("emp_department").value;
    const role = document.getElementById("emp_role").value;
    const username = document.getElementById("emp_username").value.trim();
    const password = document.getElementById("emp_password").value;

    // Validation
    if (!fname || !lname || !email || !username || !password || !dept || !role) {
        await swalWarning("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
        return;
    }

    const formData = new FormData();
    if (fileInput.files.length > 0) {
        formData.append("emp_img", fileInput.files[0]);
    }

    formData.append("emp_fname", fname);
    formData.append("emp_lname", lname);
    formData.append("emp_email", email);
    formData.append("emp_tel", tel);
    formData.append("dept_id", dept);
    formData.append("role_id", role);
    formData.append("emp_username", username);
    formData.append("emp_password", password);

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = "Processing...";

        const res = await fetch(API_URL, {
            method: "POST",
            credentials: "include", // สำคัญ: เพื่อส่ง Session ไปด้วย
            body: formData
        });

        const data = await res.json();

        if (res.ok) {
            await swalSuccess("เพิ่มพนักงานสำเร็จ");
            window.location.href = "/employees/employee.html";
        } else {
            await swalError(data.message || "เพิ่มพนักงานไม่สำเร็จ");
            saveBtn.disabled = false;
            saveBtn.textContent = "SAVE";
        }
    } catch (error) {
        console.error(error);
        await swalError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
        saveBtn.disabled = false;
        saveBtn.textContent = "SAVE";
    }
}

/* ================= LOAD DATA HELPERS ================= */
async function loadRoles() {
    try {
        const res = await fetch(ROLE_API, { credentials: "include" });
        const roles = await res.json();
        const roleSelect = document.getElementById("emp_role");
        
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
        const deptSelect = document.getElementById("emp_department");

        depts.forEach(dept => {
            const option = document.createElement("option");
            option.value = dept.dept_id;
            option.textContent = dept.dept_name;
            deptSelect.appendChild(option);
        });
    } catch (err) { console.error("Load departments error:", err); }
}