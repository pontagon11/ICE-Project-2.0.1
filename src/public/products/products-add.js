document.addEventListener("DOMContentLoaded", async () => {

  /* ================= INITIALIZATION ================= */
  // รอโหลดข้อมูล User ล่าสุด
  if (typeof loadUser === "function") {
    await loadUser();
  }

  // สั่งให้ Sidebar และ Navbar แสดงผล
  if (typeof renderSidebar === "function") {
    renderSidebar();
  }

  // เช็กสิทธิ์การสร้างสินค้า
  if (typeof hasPermission === "function") {
    if (!hasPermission("create_products")) {
      await swalError("คุณไม่มีสิทธิ์เพิ่มสินค้า");
      window.location.href = "/products/products.html";
      return;
    }
  }

  /* ================= ELEMENTS ================= */
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  const nameEl   = document.getElementById("pro_name");
  const weightEl = document.getElementById("pro_weight");
  const priceEl  = document.getElementById("pro_price");
  const qtyEl    = document.getElementById("pro_qty");
  const statusEl = document.getElementById("pro_status");

  const imageInput   = document.getElementById("pro_img");
  const previewImg   = document.getElementById("previewImg");
  const chooseImageBtn = document.getElementById("chooseImageBtn");

  // SAFETY CHECK
  if (!saveBtn || !cancelBtn || !nameEl || !priceEl || !statusEl) {
    console.error("Required HTML elements not found!");
    return;
  }

  /* ================= IMAGE HANDLING ================= */
  chooseImageBtn?.addEventListener("click", () => {
    imageInput.click();
  });

  imageInput?.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      swalWarning("กรุณาเลือกไฟล์รูปภาพ");
      imageInput.value = "";
      return;
    }

    // ใช้ URL.createObjectURL เพื่อความรวดเร็วในการ Preview
    previewImg.src = URL.createObjectURL(file);
    previewImg.style.display = "block";
  });

  /* ================= SAVE PRODUCT ================= */
  saveBtn.addEventListener("click", async () => {
    const name   = nameEl.value.trim();
    const weight = parseFloat(weightEl.value) || 0;
    const price  = parseFloat(priceEl.value);
    const qty    = parseInt(qtyEl.value) || 0;
    const status = statusEl.value;

    // Validate
    if (!name || isNaN(price) || !status) {
      await swalWarning("กรุณากรอกข้อมูลให้ครบและถูกต้อง (ชื่อ, ราคา, และสถานะ)");
      return;
    }

    // ป้องกันการกดซ้ำ (Double Click)
    saveBtn.disabled = true;
    saveBtn.textContent = "Processing...";

    const formData = new FormData();
    formData.append("pro_name", name);
    formData.append("pro_weight", weight);
    formData.append("pro_price", price);
    formData.append("pro_qty", qty);
    formData.append("pro_status", status);

    if (imageInput.files.length > 0) {
      formData.append("pro_img", imageInput.files[0]);
    }

    try {
      const res = await fetch("/products", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      const result = await res.json();

      if (res.ok) {
        await swalSuccess("เพิ่มสินค้าสำเร็จ");
        window.location.href = "/products/products.html";
      } else {
        await swalError(result.message || "เพิ่มสินค้าไม่สำเร็จ");
        saveBtn.disabled = false;
        saveBtn.textContent = "SAVE";
      }

    } catch (err) {
      console.error("Add product error:", err);
      await swalError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
      saveBtn.disabled = false;
      saveBtn.textContent = "SAVE";
    }
  });

  /* ================= CANCEL ================= */
  cancelBtn.addEventListener("click", () => {
    window.location.href = "/products/products.html";
  });

});