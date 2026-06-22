import React, { useState } from 'react';
import "../styles/Buy.css";

// Buy Animation Temporarily Removed
// import BuyAnim from './BuyAnim';

import {
  TextField,
  Button,
  InputAdornment
} from '@mui/material';

import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';

import axios from "axios";

const FinalBuy = () => {

  // Mobile Number State
  const [formValues, setFormValues] = useState({
    mobile: '',
  });

  // Loading State
  const [loading, setLoading] = useState(false);

  // Handle Input Change
  const handleInputChange = (e) => {

    const { name, value } = e.target;

    setFormValues({
      ...formValues,
      [name]: value,
    });

  };

  // Handle Payment
  const handleSubmit = async (e) => {

    e.preventDefault();

    // Start Loading
    setLoading(true);

    try {

      // Send Mobile Number to Backend
      const response = await axios.post(
        "http://localhost:8080/api/payment/pay",
        {
          mobile: formValues.mobile,
        }
      );

      console.log(response.data);

      // Payment Success
    if (response.data.success) {

  console.log("Redirect URL:", response.data.redirectUrl);
localStorage.setItem(
  "phonepeOrderId",
  response.data.merchantOrderId
);
  window.location.href =
    response.data.redirectUrl;

}
    } catch (error) {

      console.log(error);

      // Stop Loading if Error
      setLoading(false);

    }

  };

  return (

    <div className="buy-page">

      <div className="overlay-bg">

        <div className="login-wrapper">

          {/* LEFT SECTION */}
          <div className="left-section">

            {/* Animation Removed Temporarily */}

          </div>

          {/* RIGHT SECTION */}
          <div className="right-section">

            <div className='buy-text-content'>

              {/* MOBILE INPUT */}
              <TextField
                label="Mobile"
                name="mobile"
                value={formValues.mobile}
                onChange={handleInputChange}
                type='tel'
                variant="outlined"
                fullWidth
                margin="normal"
                sx={{
                  width: '80%',
                  marginLeft: '35px',
                  marginTop: '45px'
                }}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIphoneIcon />
                    </InputAdornment>
                  ),
                }}
              />

              {/* PAYMENT BUTTON */}
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading}
                sx={{
                  width: '50%',
                  marginLeft: '90px'
                }}
                className="proceed-to-buy"
                onClick={handleSubmit}
              >

                {loading
                  ? "Processing..."
                  : "Proceed to Buy"}

              </Button>

            </div>

          </div>

        </div>

      </div>

    </div>

  );

};

export default FinalBuy;
