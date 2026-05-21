import React, { useState, useRef, useEffect } from "react";
import {
  TextField, Radio, RadioGroup, FormControlLabel, FormControl,
  FormLabel, Checkbox, Button, Avatar, IconButton, Alert, Snackbar
} from "@mui/material";
import { PhotoCamera, Save, Add, Remove } from "@mui/icons-material";

// 🚨 IMPORT YOUR CUSTOM DATE PICKER HERE
import FunDatePicker from "./FunDatePicker";

const Profile = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 1. Centralized state for all form fields
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    photo: "",
    dob: "",
    gender: "male",
    phone: "",
    altPhone: "",
    address: "",
    classSemester: "",
    schoolCollege: "",
    subjects: [""], // 🚨 Changed to start with just 1 empty subject
    fatherName: "",
    fatherOcc: "",
    motherName: "",
    motherOcc: "",
    declaration: false,
    promoConsent: false, // 🚨 Added new optional consent state
    role: "", // 🚨 Added role to help hide fields for teachers
    Role: "", // Fallback just in case your DB uses uppercase 'Role'
  });

  const [alertInfo, setAlertInfo] = useState({ show: false, message: "", severity: "success" as "success" | "error" });

  // 2. Fetch existing data when the component loads
  useEffect(() => {
    const fetchProfileData = async () => {
      const token = localStorage.getItem("jwtoken");
      if (!token) return;

      try {
        const res = await fetch(`${import.meta.env.VITE_API}get-user-profile`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
          // Merge existing DB data with our default state
          // Ensure subjects is an array even if empty in DB
          const fetchedSubjects = data.subjects && data.subjects.length > 0 ? data.subjects : [""];
          setFormData(prev => ({ ...prev, ...data, subjects: fetchedSubjects }));
        }
      } catch (error) {
        console.error("Failed to fetch profile", error);
      }
    };

    fetchProfileData();
  }, []);

  // 3. Handle standard input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 4. Handle dynamic subjects array
  const handleSubjectChange = (index: number, value: string) => {
    const newSubjects = [...formData.subjects];
    newSubjects[index] = value;
    setFormData(prev => ({ ...prev, subjects: newSubjects }));
  };

  const addSubjectField = () => {
    setFormData(prev => ({ ...prev, subjects: [...prev.subjects, ""] }));
  };

  const removeSubjectField = (indexToRemove: number) => {
    setFormData(prev => ({ 
      ...prev, 
      subjects: prev.subjects.filter((_, index) => index !== indexToRemove) 
    }));
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const CLOUD_NAME = "da6jhcsmm"; 
    const UPLOAD_PRESET = "cute_profiles"; 

    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("upload_preset", UPLOAD_PRESET);

    try {
      setIsUploading(true);
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: uploadData }
      );

      const data = await response.json();

      if (response.ok) {
        setFormData(prev => ({ ...prev, photo: data.secure_url }));
        setAlertInfo({ show: true, message: "Looking sharp! Photo saved.", severity: "success" });
      } else {
        setAlertInfo({ show: true, message: `Cloudinary says: ${data.error.message}`, severity: "error" });
      }
    } catch (error) {
      console.error("Connection Error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // 5. Save the updated profile back to the database
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("jwtoken");

    try {
      const res = await fetch(`${import.meta.env.VITE_API}update-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setAlertInfo({ show: true, message: "Profile saved successfully!", severity: "success" });
      } else {
        setAlertInfo({ show: true, message: "Failed to save profile.", severity: "error" });
      }
    } catch (error) {
      setAlertInfo({ show: true, message: "Network error occurred.", severity: "error" });
    }
  };

  const inputStyles = { '& .MuiOutlinedInput-root': { borderRadius: '12px' } };
  
  // Safely check if the user is a teacher (checking both role and Role just in case)
  const isTeacher = formData.role?.toLowerCase() === "teacher" || formData.Role?.toLowerCase() === "teacher";

  return (
    <>
    <div className="animate-fade-in-up bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      
      {/* 🚨 UPDATED: Header with Orange branding and Logo */}
      <div className="bg-brand-blue text-white p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-center min-h-35">
  
        {/* LOGO */}
        {/* On mobile: relative (stacks normally). Decreased bottom margin to 'mb-2'. On desktop: absolute on the left! */}
        <div className="relative md:absolute md:left-8 z-10 mb-0 md:mb-0">
          <img 
            src="/logo.svg" 
            alt="Logo" 
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 object-contain drop-shadow-md" 
            draggable="false"
          />
        </div>

        {/* TEXT */}
        <div className="text-center relative z-10"> 
          <h1 className="text-lg sm:text-xl md:text-3xl font-display font-bold">
            Curious Team Learning Pvt. Ltd
          </h1>
        </div>
        
      </div>

      <div className="p-8 md:p-12">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 pb-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-display font-bold text-gray-800">Admission Profile</h2>
            <p className="text-gray-500 text-sm mt-1">Please fill out all required fields.</p>
          </div>

          {/* Avatar Section */} 
          <div className="mt-6 md:mt-0 flex flex-col items-center">
            <div className="relative">
              <Avatar 
                src={formData.photo || ""} 
                sx={{ 
                  width: 100, height: 100, border: '4px solid #f1f5f9',
                  opacity: isUploading ? 0.5 : 1, transition: 'opacity 0.3s'
                }} 
              />
              <IconButton
                color="primary" component="label" disabled={isUploading} 
                sx={{ 
                  position: 'absolute', bottom: -10, right: -10, 
                  backgroundColor: isUploading ? '#ccc' : '#ed7f23', 
                  color: 'white', '&:hover': { backgroundColor: '#d9701a' } 
                }}
              >
                <PhotoCamera fontSize="small" />
                <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
              </IconButton>
            </div>
            {isUploading && <p className="text-[10px] text-brand-orange mt-2 animate-pulse">Uploading...</p>}
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-8">
          
          {/* Section 1: Personal Details */}
          <div>
            <h3 className="text-lg font-bold text-brand-blue mb-4">Personal Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TextField label="Full Name" name="name" value={formData.name} onChange={handleChange} variant="outlined" fullWidth required sx={inputStyles} />
              <TextField label="Email Address" name="email" value={formData.email} onChange={handleChange} type="email" variant="outlined" fullWidth required disabled sx={inputStyles} /> 
              
              <div className="w-full [&>div]:w-full mt-1">
                <FunDatePicker 
                  value={formData.dob} 
                  onChange={(newDate: string | null) => setFormData(prev => ({ ...prev, dob: newDate || "" }))} 
                />
              </div>
              
              <FormControl component="fieldset">
                <FormLabel component="legend" className="text-sm">Gender</FormLabel>
                <RadioGroup row name="gender" value={formData.gender} onChange={handleChange}>
                  <FormControlLabel value="male" control={<Radio sx={{ color: '#1765a4', '&.Mui-checked': { color: '#1765a4' } }} />} label="Male" />
                  <FormControlLabel value="female" control={<Radio sx={{ color: '#1765a4', '&.Mui-checked': { color: '#1765a4' } }} />} label="Female" />
                  <FormControlLabel value="other" control={<Radio sx={{ color: '#1765a4', '&.Mui-checked': { color: '#1765a4' } }} />} label="Other" />
                </RadioGroup>
              </FormControl>

              <TextField label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} variant="outlined" fullWidth sx={inputStyles} />
              <TextField label="Alt Phone Number" name="altPhone" value={formData.altPhone} onChange={handleChange} variant="outlined" fullWidth sx={inputStyles} />
              <div className="md:col-span-2">
                <TextField label="Permanent Address" name="address" value={formData.address} onChange={handleChange} variant="outlined" multiline rows={3} fullWidth sx={inputStyles} />
              </div>
            </div>
          </div>

          {/* Section 2: Academic Details */}
          <div>
            <h3 className="text-lg font-bold text-brand-blue mb-4">Academic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <TextField label="School / College" name="schoolCollege" value={formData.schoolCollege} onChange={handleChange} variant="outlined" fullWidth sx={inputStyles} />
              
              {/* 🚨 HIDDEN FOR TEACHERS */}
              {!isTeacher && (
                <TextField label="Class / Semester" name="classSemester" value={formData.classSemester} onChange={handleChange} variant="outlined" fullWidth sx={inputStyles} />
              )}
              
              {/* 🚨 HIDDEN FOR TEACHERS: Dynamic Subjects */}
              {!isTeacher && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <FormLabel component="legend" className="text-sm">Chosen Subjects</FormLabel>
                    <Button 
                      size="small" 
                      onClick={addSubjectField} 
                      startIcon={<Add />} 
                      sx={{ color: '#1765a4', fontWeight: 'bold' }}
                    >
                      Add Subject
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {formData.subjects.map((subject, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <TextField 
                          value={subject}
                          onChange={(e) => handleSubjectChange(index, e.target.value)}
                          placeholder={`Subject ${index + 1}`} 
                          variant="outlined" 
                          size="small" 
                          fullWidth 
                          sx={inputStyles} 
                        />
                        {formData.subjects.length > 1 && (
                          <IconButton onClick={() => removeSubjectField(index)} size="small" color="error">
                            <Remove />
                          </IconButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Guardian Details */}
          <div>
            <h3 className="text-lg font-bold text-brand-blue mb-4">Guardian Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TextField label="Father's Name" name="fatherName" value={formData.fatherName} onChange={handleChange} variant="outlined" fullWidth sx={inputStyles} />
              <TextField label="Father's Occupation" name="fatherOcc" value={formData.fatherOcc} onChange={handleChange} variant="outlined" fullWidth sx={inputStyles} />
              <TextField label="Mother's Name" name="motherName" value={formData.motherName} onChange={handleChange} variant="outlined" fullWidth sx={inputStyles} />
              <TextField label="Mother's Occupation" name="motherOcc" value={formData.motherOcc} onChange={handleChange} variant="outlined" fullWidth sx={inputStyles} />
            </div>
          </div>

          {/* Declarations Section */}
          <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 mt-8 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-brand-orange">Declarations</h3>
            
            {/* Required Declaration */}
            <FormControlLabel
              control={
                <Checkbox 
                  required 
                  name="declaration"
                  checked={formData.declaration || false} 
                  onChange={(e) => setFormData(prev => ({ ...prev, declaration: e.target.checked }))}
                  sx={{ color: '#ed7f23', '&.Mui-checked': { color: '#ed7f23' } }} 
                />
              }
              label={<span className="text-sm text-gray-700">I confirm the information provided is accurate and agree to follow all platform rules (under penalty of account suspension). <strong>[Required]</strong></span>}
            />

            {/* 🚨 NEW Optional Promotion Consent */}
            <FormControlLabel
              control={
                <Checkbox 
                  name="promoConsent"
                  checked={formData.promoConsent || false} 
                  onChange={(e) => setFormData(prev => ({ ...prev, promoConsent: e.target.checked }))}
                  sx={{ color: '#1765a4', '&.Mui-checked': { color: '#1765a4' } }} 
                />
              }
              label={<span className="text-sm text-gray-700">I give consent to Curious Team Learning to use my name, face, and class recordings for promotional and educational purposes. <strong>[Optional]</strong></span>}
            />
          </div>

          {/* Submit Action */}
          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              variant="contained" 
              disabled={isUploading} 
              startIcon={<Save />} 
              sx={{ 
                backgroundColor: '#1765a4', 
                padding: '12px 32px', 
                borderRadius: '12px', 
                fontWeight: 'bold', 
                opacity: isUploading ? 0.7 : 1,
                '&:hover': { backgroundColor: '#124d7d' } 
              }}
            >
              {isUploading ? "Uploading Image..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </div>

      <Snackbar open={alertInfo.show} autoHideDuration={6000} onClose={() => setAlertInfo({ ...alertInfo, show: false })}>
        <Alert severity={alertInfo.severity} sx={{ width: '100%' }}>
          {alertInfo.message}
        </Alert>
      </Snackbar>
    </div>
    <div className="h-4 md:h-6 w-full shrink-0 pointer-events-none"></div>
    </>
  );
};

export default Profile;