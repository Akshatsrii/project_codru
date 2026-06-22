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
  searchParams.get("id");

console.log(
  "ORDER ID FROM URL:",
  orderId
);
        const response =
         await axios.get(
  `${import.meta.env.VITE_API}api/payment/status/${orderId}`
);
        console.log(response.data);
        navigate("/payment-success");
        console.log(
  "FULL STATUS RESPONSE:",
  JSON.stringify(response.data, null, 2)
);
        console.log(
  "PAYMENT STATE:",
  response.data.state
);

        const status =
          response.data.state;

        if (status === "COMPLETED") {

          // navigate("/payment-success");

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