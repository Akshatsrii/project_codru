import React from "react";

const PaymentSuccess = () => {

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
          color: "green",
          fontSize: "40px",
        }}
      >
        Payment Successful 🎉
      </h1>

      <p
        style={{
          fontSize: "20px",
          marginTop: "10px",
        }}
      >
        Your course has been purchased successfully.
      </p>

    </div>

  );

};

export default PaymentSuccess;