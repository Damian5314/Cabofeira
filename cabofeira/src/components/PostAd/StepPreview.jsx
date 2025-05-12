import React from "react";

function StepPreview({ nextStep, prevStep, formData }) {
  return (
    <div>
      <h2>Review Your Listing</h2>
      <ul>
        <li><strong>Category:</strong> {formData.category}</li>
        <li><strong>Title:</strong> {formData.title}</li>
        <li><strong>Price:</strong> €{formData.price}</li>
        <li><strong>Location:</strong> {formData.location}</li>
        <li><strong>Description:</strong> {formData.description}</li>
        <li><strong>Featured:</strong> {formData.isFeatured ? "Yes" : "No"}</li>
        {formData.image && (
          <li>
            <strong>Image:</strong><br />
            <img
              src={URL.createObjectURL(formData.image)}
              alt="Uploaded"
              style={{ width: "200px", marginTop: "10px" }}
            />
          </li>
        )}
      </ul>

      <div style={{ marginTop: "20px" }}>
        <button onClick={prevStep}>Back</button>
        <button onClick={nextStep}>Confirm</button>
      </div>
    </div>
  );
}

export default StepPreview;
