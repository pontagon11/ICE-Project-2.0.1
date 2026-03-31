const API_PURCHASE = "/purchase";
let allPurchases = []; // เก็บข้อมูลดิบทั้งหมดเพื่อใช้ Search

/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. ตรวจสอบ Login
        const user = await checkLogin();
        if (!user) return;

        // 2. เช็คสิทธิ์
        const permissions = localStorage.getItem("permissions") || "";
        if (!hasPermission("view_purchase") && !permissions.includes("view_purchase")) {
            await swalError("คุณไม่มีสิทธิ์เข้าถึงรายการใบสั่งซื้อ");
            window.location.href = "/home/home.html";
            return;
        }

        // 3. แสดงชื่อผู้ใช้ และ รูปภาพโปรไฟล์ (เพิ่มส่วนนี้เข้าไป)
        const profileName = document.getElementById("navUsername");
        const profileImg = document.getElementById("navProfileImg"); // ดึง Element รูปมา

        if (profileName) {
            profileName.innerText = `${user.emp_fname || user.fname} ${user.emp_lname || user.lname}`.trim();
        }

        // --- ส่วนที่เพิ่มใหม่เพื่อจัดการรูปภาพ ---
        if (profileImg) {
            const imgSrc = user.emp_img || localStorage.getItem("emp_img");
            profileImg.src = imgSrc ? `/img/emp/${imgSrc}?t=${new Date().getTime()}` : "/img/Haro.webp";

            profileImg.onerror = function () {
                this.src = "/img/Haro.webp";
            };
        }
        // ------------------------------------

        // 4. วาดเมนูและ Sidebar
        if (typeof updateHeaderMenu === "function") updateHeaderMenu();
        if (typeof renderSidebar === "function") renderSidebar();

        await loadPurchase();
        initSearch();

    } catch (err) {
        console.error("Initialization Error:", err);
    }
});

/* ====================== SEARCH SYSTEM ====================== */
function initSearch() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    const performSearch = () => {
        const term = searchInput.value.toLowerCase().trim();

        // กรองข้อมูลจากตัวแปร allPurchases
        const filtered = allPurchases.filter(p => {
            return (
                (p.po_no && p.po_no.toLowerCase().includes(term)) ||
                (p.mat_name && p.mat_name.toLowerCase().includes(term)) ||
                (p.emp_name && p.emp_name.toLowerCase().includes(term)) ||
                (p.status && p.status.toLowerCase().includes(term))
            );
        });

        renderTable(filtered); // วาดตารางใหม่ตามข้อมูลที่กรอง
    };

    // ค้นหาเมื่อพิมพ์ (Real-time)
    searchInput?.addEventListener("input", performSearch);
    // ค้นหาเมื่อกดปุ่ม
    searchBtn?.addEventListener("click", performSearch);
}

/* ====================== CHECK LOGIN ====================== */
async function checkLogin() {
    try {
        const res = await fetch("/me", { credentials: "include" });
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
        localStorage.setItem("fname", user.emp_fname || user.fname || "");
        localStorage.setItem("lname", user.emp_lname || user.lname || "");

        if (user.emp_img) {
            localStorage.setItem("emp_img", user.emp_img);
        }

        return user;
    } catch (err) {
        console.error("CheckLogin Error:", err);
        return null;
    }
}

/* ====================== LOAD & RENDER TABLE ====================== */
async function loadPurchase() {
    try {
        const res = await fetch(API_PURCHASE, { credentials: "include" });
        const data = await res.json();

        if (!Array.isArray(data)) {
            const tableBody = document.getElementById("purchaseTable");
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">⚠️ Error: ${data.message}</td></tr>`;
            return;
        }

        allPurchases = data; // เก็บเข้าตัวแปร Global
        renderTable(allPurchases); // วาดตาราง

    } catch (err) {
        console.error("Load purchase error:", err);
    }
}

function renderTable(dataToRender) {
    const tableBody = document.getElementById("purchaseTable");
    if (!tableBody) return;

    let html = "";
    let lastPO = null;

    dataToRender.forEach(p => {
        const isNewPO = p.po_id !== lastPO;
        const statusClean = (p.status || "pending").toLowerCase();

        // เช็กสิทธิ์การรับของ
        const canReceive = typeof hasPermission === "function"
            && (hasPermission("receive_purchase") || (localStorage.getItem("permissions") || "").includes("receive_purchase"))
            && statusClean !== "received";

        html += `
            <tr class="${isNewPO ? 'po-group-start' : ''}">
                <td class="po-no-cell">${isNewPO ? `<strong>${p.po_no}</strong>` : ""}</td>
                <td>${p.mat_name}</td>
                <td class="text-center">${(p.qty || 0).toLocaleString()}</td>
                <td>${isNewPO ? (p.emp_name || "-") : ""}</td>
                <td>
                    ${isNewPO ? `
                        <span class="status-badge status-${statusClean}">
                            ${statusClean.toUpperCase()}
                        </span>
                    ` : ""}
                </td>
                <td class="text-center">
                    ${(isNewPO && canReceive) ? `
                        <button class="btn-receive" onclick="receivePO(${p.po_id}, this)">Receive</button>
                    ` : ""}
                </td>
            </tr>
        `;
        lastPO = p.po_id;
    });

    tableBody.innerHTML = html || '<tr><td colspan="6" class="text-center">ไม่พบรายการสั่งซื้อ</td></tr>';
}

/* ====================== RECEIVE ACTION ====================== */
async function receivePO(id, btn) {
    const { isConfirmed } = await swalConfirm("ยืนยันการรับวัตถุดิบเข้าคลัง?");
    if (!isConfirmed) return;

    try {
        btn.disabled = true;
        btn.innerText = "Saving...";

        const res = await fetch(`${API_PURCHASE}/receive/${id}`, {
            method: "PUT",
            credentials: "include"
        });

        if (res.ok) {
            await swalSuccess("รับวัตถุดิบเข้าคลังสำเร็จ");
            loadPurchase();
        } else {
            const result = await res.json();
            await swalError(result.message || "Receive failed");
            btn.disabled = false;
            btn.innerText = "Receive";
        }
    } catch (err) {
        await swalError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        btn.disabled = false;
        btn.innerText = "Receive";
    }
}

// ปุ่มไปหน้า Add
document.getElementById("addBtn")?.addEventListener("click", () => {
    window.location.href = "/purchase/purchase-add.html";
});