import React from "react";

function StepCheckout({ nextStep, prevStep }) {
  return (
    <div>
      <h2>Checkout</h2>
      <p>Price per category: €10.00</p>
      <p>Total: €10.00</p>
      <p>(⚠️ Betaalfunctie is nog niet geïmplementeerd)</p>

      <div style={{ marginTop: "20px" }}>
        <button onClick={prevStep}>Back</button>
        <button onClick={nextStep}>Pay & Continue</button>
      </div>
    </div>
  );
}

export default StepCheckout;
