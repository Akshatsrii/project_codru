import axios from "axios";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const PaymentStatus = () => {

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {

    const checkStatus = async () => {

      try {

        const orderId =
  localStorage.getItem("phonepeOrderId");

console.log("ORDER ID FROM STORAGE:", orderId);
        const response =
          await axios.get(
            `http://localhost:8080/api/payment/status/${orderId}`
          );

        console.log(response.data);
        console.log(
  "PAYMENT STATE:",
  response.data.state
);

        const status =
          response.data.state;

        if (status === "COMPLETED") {

          navigate("/payment-success");

        }

        else if (status === "FAILED") {

          navigate("/payment-failed");

        }

        else {

          navigate("/payment-cancelled");

        }

      } catch (error) {

        console.log(error);

        navigate("/payment-failed");

      }

    };

    checkStatus();

  }, []);

  return <h2>Checking Payment Status...</h2>;

};

export default PaymentStatus;