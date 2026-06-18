import React from "react";
import { Link } from "react-router-dom";

const PaymentCancelled = () => {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        background: "#f5f5f5",
      }}
    >
      <h1
        style={{
          color: "#ff9800",
          fontSize: "40px",
        }}
      >
        Payment Cancelled ⚠️
      </h1>

      <p
        style={{
          fontSize: "20px",
          marginTop: "10px",
        }}
      >
        You cancelled the payment.
      </p>

      <Link
        to="/finalBuy"
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          background: "#1976d2",
          color: "white",
          textDecoration: "none",
          borderRadius: "5px",
        }}
      >
        Retry Payment
      </Link>
    </div>
  );
};

export default PaymentCancelled;