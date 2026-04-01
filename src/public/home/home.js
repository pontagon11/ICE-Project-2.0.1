/* ====================== 1. INITIALIZATION (ส่วนเริ่มทำงาน) ====================== */
document.addEventListener("DOMContentLoaded", async () => {

    //  ดึงข้อมูล User และ Permissions (ฟังก์ชันจาก sidebar.js)
    await loadUser();

    //  ถ้าโหลดเสร็จแล้ว currentUser ยังเป็น null แสดงว่าไม่ได้ Login
    if (!currentUser || currentUser.loggedIn === false) {
        window.location.href = "/";
        return;
    }

    // GUARD PAGE: เช็กสิทธิ์การดู Dashboard
    if (typeof hasPermission === "function") {
        if (!hasPermission("view_dashboard")) {
            await swalError("คุณไม่มีสิทธิ์เข้าถึงหน้า Dashboard");
            window.location.href = "/";
            return;
        }
    }

    // ---  ส่วนแสดงชื่อและรูปภาพโปรไฟล์ (ดึงจาก currentUser โดยตรง) ---
    const profileName = document.getElementById("navUsername");
    const profileImg = document.getElementById("navProfileImg");

    if (currentUser) {
        if (profileName) {
            // ดึงชื่อและนามสกุลมาต่อกัน (ดักกรณีนามสกุลเป็น null ให้แสดงแค่ชื่อ)
            const fname = currentUser.emp_fname || "";
            const lname = currentUser.emp_lname || "";
            const fullName = `${fname} ${lname}`.trim();

            profileName.innerText = fullName || "Unknown User";
        }

        if (profileImg) {
            // ใช้ Path ที่ถูกต้องตามโครงสร้างไฟล์ของคุณ (/img/emp/)
            const imgSrc = currentUser.emp_img || localStorage.getItem("emp_img");
            if (imgSrc && imgSrc !== 'null') {
                profileImg.src = `/img/emp/${imgSrc}`;
                profileImg.onerror = function () {
                    this.style.display = 'none';
                };
            } else {
                profileImg.style.display = 'none';
            }
        }
    }

    // 5. โหลดข้อมูล Dashboard
    loadSummary();
    loadLowStock();
    loadChart();
    // 6. ตั้งค่าปุ่ม Logout
    setupLogout();
});

/* ====================== 2. API HELPER (ตัวช่วยเรียก API) ====================== */
async function apiFetch(url, options = {}) {
    try {
        const res = await fetch(url, {
            credentials: "include", // สำคัญมาก: เพื่อให้ Browser ส่ง Session Cookie ไปที่ Backend
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            },
            ...options
        });

        // ถ้า Session หมดอายุ หรือไม่มีสิทธิ์ (401)
        if (res.status === 401) {
            localStorage.clear();
            window.location.href = "/";
            return null;
        }

        return res;
    } catch (err) {
        console.error(`Fetch Error [${url}]:`, err);
        return null;
    }
}

/* ====================== 3. LOAD DATA FUNCTIONS ====================== */

// โหลดตัวเลขสรุป (Total Products, Materials, etc.)
async function loadSummary() {
    try {
        const res = await apiFetch("/home/summary");
        if (!res || !res.ok) return;

        const data = await res.json();

        // อัปเดต UI (ใส่ 0 เป็นค่าเริ่มต้นถ้าไม่มีข้อมูล)
        const updateText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = (val || 0).toLocaleString();
        };

        updateText("totalProducts", data.totalProducts);
        updateText("totalMaterials", data.totalMaterials);
        updateText("totalIn", data.totalIn);
        updateText("totalOut", data.totalOut);

    } catch (err) {
        console.error("loadSummary error:", err);
    }
}

// โหลดรายการสินค้าสต็อกต่ำ
async function loadLowStock() {
    try {
        const res = await apiFetch("/home/low-stock");
        if (!res || !res.ok) return;

        const items = await res.json();
        const tableBody = document.getElementById("lowStockTable");
        if (!tableBody) return;

        tableBody.innerHTML = "";

        if (!items || items.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="2" class="text-center text-muted">สต็อกปกติทุกรายการ</td></tr>`;
            return;
        }

        items.forEach(item => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${item.item_name}</td>
                <td class="text-right">
                    <span class="badge" style="background-color: #ffebee; color: #c62828; font-weight: bold; padding: 4px 8px; border-radius: 4px;">
                        ${(item.balance || 0).toLocaleString()}
                    </span>
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (err) {
        console.error("loadLowStock error:", err);
    }
}

// โหลดกราฟสถิติรายเดือน
async function loadChart() {
    try {
        const res = await apiFetch("/home/monthly");
        if (!res || !res.ok) return;

        const data = await res.json();
        const ctx = document.getElementById("stockChart");
        if (!ctx) return;

        // ลบกราฟเก่าทิ้งก่อนวาดใหม่ (เพื่อไม่ให้กราฟซ้อนกันเวลาเอาเมาส์ไปชี้)
        if (window.myDashboardChart) {
            window.myDashboardChart.destroy();
        }

        window.myDashboardChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: data.labels || [],
                datasets: [
                    {
                        label: "นำเข้า (IN)",
                        data: data.totalIn || [],
                        backgroundColor: "#007bff",
                        borderRadius: 4
                    },
                    {
                        label: "เบิกออก (OUT)",
                        data: data.totalOut || [],
                        backgroundColor: "#dc3545",
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
                    x: { grid: { display: false } }
                }
            }
        });

    } catch (err) {
        console.error("loadChart error:", err);
    }
}

/* ====================== 4. LOGOUT SETUP ====================== */
function setupLogout() {
    // รองรับทั้ง ID 'logout' หรือ 'logoutBtn'
    const btn = document.getElementById("logout") || document.getElementById("logoutBtn");
    if (!btn) return;

    btn.onclick = async (e) => {
        e.preventDefault();
        const { isConfirmed } = await swalConfirm("ยืนยันการออกจากระบบ?", "ออกจากระบบ");
        if (!isConfirmed) return;

        try {
            await apiFetch("/logout", { method: "POST" });
        } catch (err) {
            console.error("Logout error:", err);
        } finally {
            // เคลียร์ข้อมูลทุกอย่างและกลับไปหน้า Login
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "/";
        }
    };
}