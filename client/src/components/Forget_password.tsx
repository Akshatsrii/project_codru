import { useState, useEffect } from "react";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import { TextField, InputAdornment, CircularProgress } from "@mui/material";
import { Lock, LockReset } from "@mui/icons-material";
import ErrorOutline from '@mui/icons-material/ErrorOutlined';
// Components
import Muialert from "./Muialert";

const ForgetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState("");
  const [cpassword, setCpassword] = useState("");
  
  // 🚨 NEW: Token Verification States
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  
  // Alert State
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"success" | "error">("error");

  // 🚨 NEW: Verify token the moment the page loads
  useEffect(() => {
    const verifyToken = async () => {
      try {
        // Calls the new GET route we just made
        const res = await fetch(`${import.meta.env.VITE_API}reset-password/${token}`);
        if (res.ok) {
          setIsValid(true);
        } else {
          setIsValid(false);
        }
      } catch (err) {
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    verifyToken();
  }, [token]);

  const PostData = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== cpassword) {
      setAlertSeverity("error");
      setAlertMessage("Passwords do not match!");
      setShowAlert(true);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API}reset-password/${token}`, {
        method: "POST", // Still uses your original POST route to do the actual reset
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });

      const data = await res.json();

      if (res.ok) {
        setAlertSeverity("success");
        setAlertMessage("Password has been reset successfully! Redirecting...");
        setShowAlert(true);
        
        setTimeout(() => navigate("/signin"), 2000);
      } else {
        setAlertSeverity("error");
        setAlertMessage(data.error || "Failed to reset password.");
        setShowAlert(true);
      }
    } catch (err) {
      setAlertSeverity("error");
      setAlertMessage("Network error. Failed to reset password.");
      setShowAlert(true);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-12 flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8 min-h-100 flex flex-col justify-center">
        
        {/* SCENARIO 1: Still Checking Token */}
        {isValidating ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <CircularProgress size={48} sx={{ color: '#1765a4' }} />
            <p className="text-gray-500 font-bold animate-pulse">Verifying secure link...</p>
          </div>
        ) : 

        /* SCENARIO 2: Token is Expired / Invalid */
        !isValid ? (
          <div className="flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <ErrorOutline className="text-red-500" sx={{ fontSize: 48 }} />
            </div>
            <h2 className="text-2xl font-display font-black text-slate-800 mb-3">Link Expired</h2>
            <p className="text-gray-500 font-body mb-8 leading-relaxed">
              For your security, password reset links expire after 1 hour. This link is no longer valid.
            </p>
            <button
              onClick={() => navigate("/signin")}
              className="w-full bg-brand-blue text-white py-3.5 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg active:scale-95"
            >
              Back to Sign In
            </button>
          </div>
        ) : 

        /* SCENARIO 3: Token is Good! Show the Form */
        (
          <div className="animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <LockReset className="text-brand-blue" sx={{ fontSize: 36 }} />
              </div>
              <h2 className="text-2xl font-display font-bold text-brand-blue">Reset Password</h2>
              <p className="text-gray-500 text-center font-body mt-2">
                Please enter your new password below.
              </p>
            </div>

            {/* Form Section */}
            <form className="flex flex-col gap-5" onSubmit={PostData}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock className="text-brand-blue" />
                      </InputAdornment>
                    ),
                  }
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />

              <TextField
                fullWidth
                variant="outlined"
                placeholder="Confirm New Password"
                type="password"
                value={cpassword}
                onChange={(e) => setCpassword(e.target.value)}
                required
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock className="text-brand-blue" />
                      </InputAdornment>
                    ),
                  }
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />

              <button
                type="submit"
                className="w-full bg-brand-orange text-white py-3 mt-2 rounded-xl font-bold text-lg hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/30 transform hover:-translate-y-0.5"
              >
                Update Password
              </button>
            </form>
          </div>
        )}

        {showAlert && (
          <Muialert
            message={alertMessage}
            severity={alertSeverity}
            onClose={() => setShowAlert(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ForgetPassword;