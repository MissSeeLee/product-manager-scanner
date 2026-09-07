import { useState } from "react";

function createInitialForm(editingProduct) {
  if (!editingProduct) {
    return {
      productName: "",
      brand: "",
      partNumber: "",
      description: "",
      category: "ทั่วไป",
    };
  }

  return {
    productName: editingProduct.product_name ?? "",
    brand: editingProduct.brand ?? "",
    partNumber: editingProduct.part_number ?? "",
    description: editingProduct.description ?? "",
    category: editingProduct.category ?? "ทั่วไป",
  };
}

function ProductForm({ editingProduct = null, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(() =>
    createInitialForm(editingProduct),
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  const isEditing = Boolean(editingProduct);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      productName: formData.productName.trim(),
      brand: formData.brand.trim(),
      partNumber: formData.partNumber.trim(),
      description: formData.description.trim(),
      category: formData.category.trim() || "ทั่วไป",
    };

    if (!payload.productName || !payload.brand || !payload.partNumber) {
      setValidationError("กรุณากรอกชื่อสินค้า ยี่ห้อ และ Part Number ให้ครบ");
      return;
    }

    setValidationError("");
    setIsSubmitting(true);

    try {
      const success = await onSubmit(payload);

      if (success && !isEditing) {
        setFormData(createInitialForm(null));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    onCancel?.();
  }

  return (
    <section className="card">
      <h2 className="card-title">
        {isEditing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
      </h2>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="productName">
            ชื่อสินค้า
          </label>

          <input
            className="form-control"
            id="productName"
            name="productName"
            type="text"
            value={formData.productName}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="brand">
            ยี่ห้อ
          </label>

          <input
            className="form-control"
            id="brand"
            name="brand"
            type="text"
            value={formData.brand}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="partNumber">
            Part Number
          </label>

          <input
            className="form-control"
            id="partNumber"
            name="partNumber"
            type="text"
            value={formData.partNumber}
            onChange={handleChange}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="category">
            หมวดหมู่
          </label>

          <input
            className="form-control"
            id="category"
            name="category"
            type="text"
            value={formData.category}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group form-group-full">
          <label className="form-label" htmlFor="description">
            รายละเอียด
          </label>

          <textarea
            className="form-control"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            disabled={isSubmitting}
            rows="4"
          />
        </div>

        {validationError && (
          <div className="message message-error form-group-full" role="alert">
            {validationError}
          </div>
        )}

        <div className="form-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "กำลังบันทึก..."
              : isEditing
                ? "บันทึกการแก้ไข"
                : "เพิ่มสินค้า"}
          </button>

          {isEditing && (
            <button
              className="button button-secondary"
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              ยกเลิก
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default ProductForm;
