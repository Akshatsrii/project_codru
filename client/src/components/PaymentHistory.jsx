import React, {
  useEffect,
  useState
} from "react";

import axios from "axios";

const PaymentHistory = () => {

  const [payments, setPayments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {

    fetchPayments();

  }, []);

  const fetchPayments =
    async () => {

      try {

        const response =
          await axios.get(
            "http://localhost:8080/api/payment/all-payments"
          );

        if (
          response.data.success
        ) {

          setPayments(
            response.data.payments
          );

        }

      } catch (error) {

        console.log(error);

      } finally {

        setLoading(false);

      }

    };

  return (

    <div
      style={{
        minHeight: "100vh",
        background:
          "#f4f7fc",
        padding: "40px"
      }}
    >

      {/* PAGE TITLE */}

      <h1
        style={{
          textAlign: "center",
          color: "#1976d2",
          marginBottom: "40px",
          fontSize: "40px",
          fontWeight: "bold"
        }}
      >

        Payment History

      </h1>

      {/* LOADING */}

      {loading ? (

        <h2
          style={{
            textAlign: "center",
            color: "#555"
          }}
        >

          Loading...

        </h2>

      ) : payments.length === 0 ? (

        <h2
          style={{
            textAlign: "center",
            color: "#555"
          }}
        >

          No Payments Found

        </h2>

      ) : (

        <div
          style={{
            overflowX: "auto"
          }}
        >

          <table
            style={{
              width: "100%",
              borderCollapse:
                "collapse",
              background:
                "#ffffff",
              borderRadius: "15px",
              overflow: "hidden",
              boxShadow:
                "0px 4px 20px rgba(0,0,0,0.1)"
            }}
          >

            {/* TABLE HEAD */}

            <thead>

              <tr
                style={{
                  background:
                    "#1976d2",
                  color: "white",
                  height: "60px"
                }}
              >

                <th>Mobile</th>

                <th>Amount</th>

                <th>Status</th>

                <th>Transaction ID</th>

                <th>Created At</th>

              </tr>

            </thead>

            {/* TABLE BODY */}

            <tbody>

              {payments.map(
                (payment, index) => (

                  <tr
                    key={index}
                    style={{
                      textAlign:
                        "center",
                      borderBottom:
                        "1px solid #eee",
                      height: "70px",
                      transition:
                        "0.3s"
                    }}
                  >

                    <td
                      style={{
                        fontWeight:
                          "500"
                      }}
                    >

                      {payment.mobile}

                    </td>

                    <td
                      style={{
                        color:
                          "#1976d2",
                        fontWeight:
                          "bold"
                      }}
                    >

                      ₹{payment.amount}

                    </td>

                    <td>

                      <span
                        style={{
                          background:
                            "#d4edda",
                          color:
                            "#155724",
                          padding:
                            "8px 15px",
                          borderRadius:
                            "20px",
                          fontWeight:
                            "bold"
                        }}
                      >

                        {payment.status}

                      </span>

                    </td>

                    <td
                      style={{
                        fontSize:
                          "14px"
                      }}
                    >

                      {
                        payment.transactionId
                      }

                    </td>

                    <td>

                      {new Date(
                        payment.createdAt
                      ).toLocaleString()}

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      )}

    </div>

  );

};

export default PaymentHistory;