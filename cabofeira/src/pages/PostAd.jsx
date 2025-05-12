import React, { useState } from "react";
import StepCategory from "../components/PostAd/StepCategory";
import StepDetails from "../components/PostAd/StepDetails";
import StepPreview from "../components/PostAd/StepPreview";
import StepCheckout from "../components/PostAd/StepCheckout";
import StepThankYou from "../components/PostAd/StepThankYou";

function PostAd() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    category: "",
    title: "",
    price: "",
    location: "",
    description: "",
    image: null,
    isFeatured: false,
  });

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : type === "file" ? files[0] : value,
    });
  };

  const steps = {
    1: <StepCategory nextStep={nextStep} handleChange={handleChange} formData={formData} />,
    2: <StepDetails nextStep={nextStep} prevStep={prevStep} handleChange={handleChange} formData={formData} />,
    3: <StepPreview nextStep={nextStep} prevStep={prevStep} formData={formData} />,
    4: formData.isFeatured ? <StepCheckout nextStep={nextStep} prevStep={prevStep} /> : <StepThankYou />,
    5: <StepThankYou />,
  };

  return (
    <div className="post-ad-container">
      <div className="progress-bar">Step {step} of 5</div>
      {steps[step]}
    </div>
  );
}

export default PostAd;
