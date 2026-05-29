import { useState } from "react";
import { TextField, InputAdornment } from "@mui/material";
import { Lock, VpnKey } from "@mui/icons-material";

// Components
import Muialert from "./Muialert";

function ChangePassword() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Alert State
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"success" | "error">("error");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setAlertSeverity("error");
      setAlertMessage("New password and confirm password don't match.");
      setShowAlert(true);
      return;
    }

    // TODO: Insert your actual API call here to update the password!
    try {
      // Example placeholder logic:
      // const res = await fetch(`${import.meta.env.VITE_API}change-password`, { ... })
      
      console.log("Form submitted successfully.");
      
      setAlertSeverity("success");
      setAlertMessage("Password has been updated successfully!");
      setShowAlert(true);
      
      // Clear the form fields after success
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

    } catch (err) {
      setAlertSeverity("error");
      setAlertMessage("Failed to update password. Please try again.");
      setShowAlert(true);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-12 flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8">
        
        {/* Header Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <VpnKey className="text-brand-blue" sx={{ fontSize: 36 }} />
          </div>
          <h2 className="text-2xl font-display font-bold text-brand-blue">Change Password</h2>
          <p className="text-gray-500 text-center font-body mt-2">
            Secure your account with a new password.
          </p>
        </div>

        {/* Form Section */}
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {/* 🚨 FIX: Updated to slotProps */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Old Password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <VpnKey className="text-brand-blue" />
                  </InputAdornment>
                ),
              }
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />

          {/* 🚨 FIX: Updated to slotProps */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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

          {/* 🚨 FIX: Updated to slotProps */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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

        {/* Alerts */}
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
}

export default ChangePassword;