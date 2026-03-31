document.addEventListener("DOMContentLoaded", async () => {

    /* ================= INITIALIZATION ================= */
    // ตรวจสอบ Login และสิทธิ์ (ดึงจาก localStorage ที่เก็บไว้ตอน Login)
    const user = JSON.parse(localStorage.getItem("user"));
    const perms = JSON.parse(localStorage.getItem("permissions")) || [];

    if (!user) {
        window.location.href = "/";
        return;
    }

    // ฟังก์ชันเช็กสิทธิ์ภายในหน้า
    const canCreate = perms.some(p => p.perm_name === "create_materials");
    if (!canCreate) {
        await swalError("คุณไม่มีสิทธิ์เพิ่มข้อมูลวัตถุดิบ");
        window.location.href = "/materials/materials.html";
        return;
    }

    // วาด Sidebar
    if (typeof renderSidebar === "function") {
        renderSidebar();
    }

    /* ================= ELEMENTS ================= */
    const saveBtn = document.getElementById("saveBtn");
    const cancelBtn = document.getElementById("cancelBtn");

    const matNameEl = document.getElementById("mat_name");
    const weightEl = document.getElementById("mat_weight");
    const priceEl = document.getElementById("mat_price");
    const sizeEl = document.getElementById("mat_size");
    const qtyEl = document.getElementById("mat_qty");
    const statusEl = document.getElementById("mat_status");

    const imageInput = document.getElementById("mat_img");
    const previewImg = document.getElementById("previewImg");
    const chooseImageBtn = document.getElementById("chooseImageBtn");

    // SAFETY CHECK: เช็กว่ามี Element ครบไหมก่อนเริ่มงาน
    if (!saveBtn || !matNameEl) {
        console.error("Critical: Required HTML elements not found!");
        return;
    }

    /* ================= IMAGE PREVIEW ================= */
    let currentPreviewUrl = null;

    chooseImageBtn?.addEventListener("click", () => imageInput.click());

    imageInput?.addEventListener("change", () => {
        const file = imageInput.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            swalWarning("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
            imageInput.value = "";
            return;
        }

        // คืนค่า Memory ของ URL เก่าก่อนสร้างใหม่
        if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
        
        currentPreviewUrl = URL.createObjectURL(file);
        previewImg.src = currentPreviewUrl;
        previewImg.style.display = "block";
    });

    /* ================= SAVE ACTION ================= */
    saveBtn.addEventListener("click", async () => {
        const matName = matNameEl.value.trim();
        const matPrice = parseFloat(priceEl.value);
        const matStatus = statusEl.value;

        // Validation พื้นฐานที่จำเป็น
        if (!matName || isNaN(matPrice) || !matStatus) {
            await swalWarning("กรุณากรอกข้อมูลที่จำเป็น: ชื่อ, ราคา และสถานะ");
            return;
        }

        const formData = new FormData();
        formData.append("mat_name", matName);
        formData.append("mat_weight", parseFloat(weightEl.value) || 0);
        formData.append("mat_price", matPrice);
        formData.append("mat_size", sizeEl.value || "");
        formData.append("mat_qty", parseInt(qtyEl.value) || 0);
        formData.append("mat_status", matStatus);

        if (imageInput.files.length > 0) {
            formData.append("mat_img", imageInput.files[0]);
        }

        try {
            // UI Feedback: ป้องกันการกดซ้ำ
            saveBtn.disabled = true;
            const originalText = saveBtn.textContent;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Saving...`;

            const res = await fetch("/materials", {
                method: "POST",
                body: formData,
                credentials: "include" // สำคัญมากสำหรับระบบ Session
            });

            const result = await res.json();

            if (res.ok) {
                await swalSuccess("เพิ่มวัตถุดิบสำเร็จ");
                window.location.href = "/materials/materials.html";
            } else {
                await swalError(result.message || "เกิดข้อผิดพลาดในการบันทึก");
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }

        } catch (err) {
            console.error("Add material error:", err);
            await swalError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
            saveBtn.disabled = false;
            saveBtn.textContent = "SAVE";
        }
    });

    /* ================= CANCEL ================= */
    cancelBtn?.addEventListener("click", async () => {
        const { isConfirmed } = await swalConfirm("ข้อมูลที่กรอกไว้จะหายไป ยืนยันการยกเลิกหรือไม่?", "ยกเลิก");
        if (isConfirmed) {
            window.location.href = "/materials/materials.html";
        }
    });

});