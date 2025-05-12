import React from "react";

function StepCategory({ nextStep, handleChange, formData }) {
  return (
    <div>
      <h2>Submit Your Listing</h2>
      <p>Select a category to get started.</p>
      <select name="category" onChange={handleChange} value={formData.category}>
        <option value="">Select one</option>
        <option value="Baby Stuff">Baby Stuff</option>
        <option value="Cars">Cars</option>
        <option value="Real Estate">Real Estate</option>
      </select>
      <button onClick={nextStep} disabled={!formData.category}>Next</button>
    </div>
  );
}

export default StepCategory;
