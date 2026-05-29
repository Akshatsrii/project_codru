import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Lock, Person } from "@mui/icons-material";
import { TextField, InputAdornment } from "@mui/material";

// Components & Assets
import SignInAnim from "./SignInAnim";
import Muialert from "./Muialert";
import GoogleIcon from "../assets/google.svg?url";
import { UserData } from "../App";

interface SigninProps {
  userData: UserData;
  setUserData: React.Dispatch<React.SetStateAction<UserData>>;
}

function Signin({ setUserData }: SigninProps) {
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const navigate = useNavigate();

  const [value, setValue] = useState({
    username: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value: val } = e.target;
    setValue((prev) => ({ ...prev, [name]: val }));
  };

  const PostData = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${import.meta.env.VITE_API}signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    
    const data = await res.json();
    if (res.ok) {
      // 🚨 THE TYPESCRIPT FIX: 
      // Spread the previous state so we don't lose _id, and safely assign the strings!
      setUserData((prev) => ({
        ...prev,
        Photo: data.photo || "",
        Name: data.name || "",
        Role: data.role || "",
        isAdmin: !!data.isAdmin,
      }));

      localStorage.setItem("jwtoken", data.token);
      localStorage.setItem("Username", data.username);
      navigate("/");
    } else {
      setAlertMessage(data.error || "Failed to Sign In");
      setShowAlert(true);
    }
  };

  const sendMail = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!value.username) {
      setAlertMessage("Please enter your username to reset your password");
      setShowAlert(true);
      return;
    }

    const res = await fetch(`${import.meta.env.VITE_API}reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: value.username }),
    });

    if (res.ok) {
      setAlertMessage("Password reset link sent to your email");
      setShowAlert(true);
    } else {
      const data = await res.json();
      setAlertMessage(data.error || "Failed to send mail");
      setShowAlert(true);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-12 flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
        
        {/* Left Side: Animation */}
        <div className="md:w-1/2 bg-brand-blue p-12 flex flex-col justify-center items-center text-white">
          <div className="w-full max-w-xs mb-8">
            <SignInAnim />
          </div>
          <h1 className="text-3xl font-display font-bold mb-4 text-center">Welcome Back!</h1>
          <p className="text-blue-100 text-center font-body opacity-80 italic">
            "The important thing is not to stop questioning."
          </p>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-1/2 p-8 md:p-12">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-3xl font-display font-bold text-brand-blue">Sign In</h2>
            <p className="text-gray-500 mt-2 font-body">Good to see you again!</p>
          </div>

          <form onSubmit={PostData} className="flex flex-col gap-5">
            <TextField
              fullWidth
              variant="outlined"
              name="username"
              placeholder="Username"
              value={value.username}
              onChange={handleChange}
              required
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person className="text-brand-blue" />
                    </InputAdornment>
                  ),
                }
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />

            <div className="space-y-2">
              <TextField
                fullWidth
                variant="outlined"
                name="password"
                type="password"
                placeholder="Password"
                value={value.password}
                onChange={handleChange}
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
              <div className="flex justify-end px-1">
                <button 
                  type="button"
                  onClick={sendMail}
                  className="text-xs font-bold text-brand-orange hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-brand-blue text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 transform hover:-translate-y-0.5"
            >
              Sign In
            </button>
          </form>

          <p className="mt-8 text-center text-gray-500 font-body">
            New here? <NavLink to="/signup" className="text-brand-orange font-bold hover:underline">Create Account</NavLink>
          </p>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
            <div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-gray-400">Or</span></div>
          </div>

          {/* 🚨 THE NEW BIG GOOGLE BUTTON */}
          <button 
            type="button"
            onClick={() => window.location.href = `${import.meta.env.VITE_API}auth/google`}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 py-3.5 rounded-xl font-bold text-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-[0.98]"
          >
            <img src={GoogleIcon} alt="Google" className="w-6 h-6" />
            Continue with Google
          </button>
          
        </div>
      </div>

      {showAlert && <Muialert message={alertMessage} severity="error" onClose={() => setShowAlert(false)} />}
    </div>
  );
}

export default Signin;