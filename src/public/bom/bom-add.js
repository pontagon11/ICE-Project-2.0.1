/* ====================== INITIALIZATION ====================== */
document.addEventListener("DOMContentLoaded", async () => {
    // 1. โหลดข้อมูล User และวาด Sidebar
    if (typeof loadUser === "function") {
        await loadUser();
    }
    
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }

    // 2. GUARD PAGE: เช็กสิทธิ์การสร้าง BOM
    if (typeof hasPermission === "function") {
        if (!hasPermission("create_bom")) {
            await swalError("คุณไม่มีสิทธิ์สร้างสูตรการผลิต (BOM)");
            window.location.href = "/home/home.html";
            return;
        }
    }

    const bomNoInput = document.getElementById("bomNo");
    const productSelect = document.getElementById("productSelect");
    const materialSelect = document.getElementById("materialSelect");
    const usageQtyInput = document.getElementById("usageQty");
    const addMaterialBtn = document.getElementById("addMaterialBtn");
    const materialTableBody = document.getElementById("materialTableBody");
    const saveBomBtn = document.getElementById("saveBomBtn");

    let bomDetails = [];

    /* ================= GENERATE BOM NO ================= */
    async function generateBomNo() {
        try {
            const res = await fetch("/bom/next-number", { credentials: "include" });
            const data = await res.json();
            if (res.ok) bomNoInput.value = data.nextBomNo;
        } catch (err) {
            console.error("Generate BOM No error:", err);
        }
    }

    // ================= LOAD PRODUCTS =================
    async function loadProducts() {
        try {
            const res = await fetch("/products", { credentials: "include" });
            const data = await res.json();
            if (!res.ok) return;

            productSelect.innerHTML = `<option value="">-- เลือกสินค้าที่จะผลิต --</option>`;
            data.forEach(p => {
                const option = document.createElement("option");
                option.value = p.pro_id;
                option.dataset.name = p.pro_name;
                option.textContent = `${p.pro_no || ''} - ${p.pro_name}`;
                productSelect.appendChild(option);
            });
        } catch (err) {
            console.error("Load products error:", err);
        }
    }

    // ================= LOAD MATERIALS =================
    async function loadMaterials() {
        try {
            const res = await fetch("/materials", { credentials: "include" });
            const data = await res.json();
            if (!res.ok) return;

            materialSelect.innerHTML = `<option value="">-- เลือกวัตถุดิบ --</option>`;
            data.forEach(m => {
                const option = document.createElement("option");
                option.value = m.mat_id;
                option.dataset.no = m.mat_no;
                option.dataset.name = m.mat_name;
                option.textContent = `${m.mat_no || ''} - ${m.mat_name}`;
                materialSelect.appendChild(option);
            });
        } catch (err) {
            console.error("Load materials error:", err);
        }
    }

    // ================= ADD MATERIAL TO LIST =================
    addMaterialBtn.addEventListener("click", async () => {
        const matId = materialSelect.value;
        const usageQty = parseFloat(usageQtyInput.value);

        if (!matId || isNaN(usageQty) || usageQty <= 0) {
            await swalWarning("กรุณาเลือกวัตถุดิบและระบุจำนวนที่ถูกต้อง");
            return;
        }

        // กันรายการซ้ำใน List
        if (bomDetails.some(item => String(item.mat_id) === String(matId))) {
            await swalWarning("วัตถุดิบนี้มีอยู่ในรายการแล้ว");
            return;
        }

        const selected = materialSelect.options[materialSelect.selectedIndex];

        bomDetails.push({
            mat_id: matId,
            mat_no: selected.dataset.no,
            mat_name: selected.dataset.name,
            usage_qty: usageQty
        });

        renderTable();
        usageQtyInput.value = ""; // Reset input
        materialSelect.value = ""; // Reset select
    });

    // ================= RENDER TABLE =================
    function renderTable() {
        materialTableBody.innerHTML = "";

        bomDetails.forEach((item, index) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${item.mat_no}</td>
                <td><strong>${item.mat_name}</strong></td>
                <td class="text-right">${item.usage_qty.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-center">
                    <button class="btn-delete-small" data-index="${index}">🗑️</button>
                </td>
            `;
            materialTableBody.appendChild(row);
        });

        // ผูก Event ให้ปุ่มลบ (ดีกว่าใช้ onclick ใน HTML)
        document.querySelectorAll(".btn-delete-small").forEach(btn => {
            btn.onclick = () => {
                const idx = btn.dataset.index;
                bomDetails.splice(idx, 1);
                renderTable();
            };
        });
    }

    // ================= SAVE BOM TO DATABASE =================
    saveBomBtn.addEventListener("click", async () => {
        const pro_id = productSelect.value;

        if (!pro_id) {
            await swalWarning("กรุณาเลือกสินค้าที่จะผูกสูตรการผลิต");
            return;
        }

        if (bomDetails.length === 0) {
            await swalWarning("กรุณาเพิ่มวัตถุดิบอย่างน้อย 1 รายการลงในสูตร");
            return;
        }

        const { isConfirmed } = await swalConfirm("ยืนยันการบันทึกสูตรการผลิตนี้?");
        if (!isConfirmed) return;

        saveBomBtn.disabled = true;
        saveBomBtn.textContent = "Saving...";

        const payload = {
            pro_id: Number(pro_id),
            details: bomDetails.map(item => ({
                mat_id: Number(item.mat_id),
                usage_qty: Number(item.usage_qty)
            }))
        };

        try {
            const res = await fetch("/bom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (res.ok) {
                await swalSuccess("บันทึกสูตรการผลิต (BOM) เรียบร้อยแล้ว");
                window.location.href = "/bom/bom.html";
            } else {
                await swalError(result.message || "บันทึกไม่สำเร็จ");
                saveBomBtn.disabled = false;
                saveBomBtn.textContent = "SAVE BOM";
            }
        } catch (err) {
            console.error("Save BOM Error:", err);
            await swalError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
            saveBomBtn.disabled = false;
        }
    });

    // INIT PAGE DATA
    generateBomNo();
    loadProducts();
    loadMaterials();
});