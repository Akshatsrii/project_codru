import React from "react";
import { Link } from "react-router-dom";

const PaymentFailed = () => {
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
          color: "red",
          fontSize: "40px",
        }}
      >
        Payment Failed ❌
      </h1>

      <p
        style={{
          fontSize: "20px",
          marginTop: "10px",
        }}
      >
        Your payment could not be completed.
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
        Try Again
      </Link>
    </div>
  );
};

export default PaymentFailed;