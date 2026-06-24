import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";

const PaymentStatus = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("id");

  const [status, setStatus] = useState<"LOADING" | "COMPLETED" | "FAILED" | "CANCELLED">("LOADING");
  const [orderDetails, setOrderDetails] = useState<any>(null);
  
  // Ref to prevent spamming the auto-download if the component re-renders
  const hasDownloadedRef = useRef(false);

  // ==========================================
  // PDF GENERATION LOGIC
  // ==========================================
  const generateReceipt = (data: any, currentStatus: string) => {
    const doc = new jsPDF();

    // 1. Create the Full Brand-Orange Header Bar
    // Using Tailwind orange-600 RGB (234, 88, 12)
    doc.setFillColor(234, 88, 12); 
    doc.rect(0, 0, 210, 45, "F"); // 210mm is full A4 width

    // Define the Cloudinary URL (swapped to .png for jsPDF compatibility)
    const logoUrl = "https://res.cloudinary.com/da6jhcsmm/image/upload/v1772999280/logo_no_bg1_mfmk8x.png";
    
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Prevents CORS blocking
    img.src = logoUrl;

    // We wrap the PDF generation in the image onload so it waits for the logo to fetch
    // We wrap the PDF generation in the image onload so it waits for the logo to fetch
    img.onload = () => {
      // 🚨 DYNAMIC ASPECT RATIO FIX 🚨
      const imgRatio = img.width / img.height;
      const targetHeight = 26; // Set a fixed comfortable height
      const targetWidth = targetHeight * imgRatio; // Let the width scale naturally

      // 2. Add Logo (No more stretching!)
      doc.addImage(img, "PNG", 15, 9, targetWidth, targetHeight);

      // Dynamically push the text to the right based on how wide the logo is
      const textStartX = 15 + targetWidth + 6; 

      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255); // White text over orange
      doc.text("Curious Team Learning Pvt. Ltd.", textStartX, 22);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(255, 237, 213); // Soft orange-100 for subtext
      doc.text("Official Transaction Receipt", textStartX, 30);

      buildPdfBody(doc);
    };

    // Fallback just in case the user's network blocks the image
    img.onerror = () => {
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Curious Team Learning Pvt. Ltd.", 105, 22, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(255, 237, 213);
      doc.text("Official Transaction Receipt", 105, 30, { align: "center" });

      buildPdfBody(doc);
    };

    // Helper function for the rest of the PDF body
    const buildPdfBody = (doc: jsPDF) => {
      // 3. Status Badge Logic
      if (currentStatus === "COMPLETED") {
        doc.setTextColor(21, 128, 61); // Green
      } else if (currentStatus === "FAILED" || currentStatus === "CANCELLED") {
        doc.setTextColor(220, 38, 38); // Red
      } else {
        doc.setTextColor(234, 88, 12); // Orange
      }
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`STATUS: ${currentStatus}`, 105, 60, { align: "center" });

      // 4. Order Details Section
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      
      let yPos = 75; // Shifted down to account for the bigger header
      const lineHeight = 10;

      const addDetail = (label: string, value: string, isBold = false) => {
        doc.text(label, 20, yPos);
        if (isBold) doc.setFont("helvetica", "bold");
        doc.text(value, 60, yPos);
        if (isBold) doc.setFont("helvetica", "normal");
        yPos += lineHeight;
      };

      addDetail(`Order ID:`, `${data?.orderId || orderId}`, true);
      addDetail(`Date:`, `${new Date(data?.createdAt || Date.now()).toLocaleString()}`);
      addDetail(`Student Name:`, `${data?.studentName || 'N/A'}`);
      addDetail(`Plan Selected:`, `${data?.planId ? data.planId.replace(/-/g, ' ').toUpperCase() : 'N/A'}`);
      
      if (data?.paymentMode && data.paymentMode !== "UNKNOWN") {
          addDetail(`Payment Mode:`, `${data.paymentMode.replace(/_/g, ' ')}`);
      }

      addDetail(`Amount:`, `INR ${data?.amount || '0'}`, true);

      const displayTxnId = data?.bankReference || data?.phonepeTransactionId;
      if (displayTxnId && displayTxnId !== "N/A" && displayTxnId !== "TXN_NOT_PROVIDED") {
          addDetail(`Bank Txn ID:`, `${displayTxnId}`);
      }

      // 5. Footer
      doc.setDrawColor(200, 200, 200);
      doc.line(20, yPos + 10, 190, yPos + 10);
      
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("If you have any questions regarding this transaction, please contact our support.", 105, yPos + 20, { align: "center" });

      // 6. Trigger Download
      doc.save(`CuTe_Receipt_${data?.orderId || orderId}.pdf`);
    };
  };

  useEffect(() => {
    if (!orderId) {
      setStatus("FAILED");
      return;
    }

    const checkStatus = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API?.endsWith('/') 
            ? import.meta.env.VITE_API 
            : `${import.meta.env.VITE_API}/`;

        const response = await axios.get(`${apiUrl}api/payment/status/${orderId}`);
        const data = response.data;

        if (data.success) {
          setStatus(data.state); 
          setOrderDetails(data.order);

          // TRIGGER AUTO DOWNLOAD ONCE
          if (!hasDownloadedRef.current) {
            generateReceipt(data.order, data.state);
            hasDownloadedRef.current = true;
          }

        } else {
          setStatus("FAILED");
          if (!hasDownloadedRef.current) {
            generateReceipt({ orderId: orderId }, "FAILED");
            hasDownloadedRef.current = true;
          }
        }
      } catch (error) {
        console.error("Status Check Error:", error);
        setStatus("FAILED");
      }
    };

    setTimeout(checkStatus, 1500);
  }, [orderId]);

  // Extract clean ID token for rendering visibility
  const currentBankTxnId = orderDetails?.bankReference || orderDetails?.phonepeTransactionId;

  // ==========================================
  // UI: LOADING STATE
  // ==========================================
  if (status === "LOADING") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans px-4">
        <div className="w-16 h-16 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold text-brand-blue mb-2">Verifying Payment...</h2>
        <p className="text-gray-500 text-center max-w-md">
          Please do not close this window. We are securely communicating with the bank.
        </p>
      </div>
    );
  }

  // ==========================================
  // UI: SUCCESS STATE
  // ==========================================
  if (status === "COMPLETED") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans px-4 py-12">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600 shadow-lg shadow-green-100/50">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
        </div>
        
        <span className="text-sm font-bold uppercase tracking-widest text-green-600 mb-2">Transaction Successful</span>
        <h1 className="text-4xl md:text-5xl font-extrabold text-brand-blue mb-4 text-center">Welcome to the Team!</h1>
        
        <p className="text-lg text-gray-600 mb-8 max-w-lg text-center">
          Your payment was processed successfully. We have unlocked the curriculum in your dashboard!
        </p>

        {/* Visual Summary Block */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 w-full max-w-md mb-8 shadow-md">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-50 pb-2">Order Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Order ID</span>
              <span className="font-bold text-gray-900 font-mono">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Student Name</span>
              <span className="font-bold text-gray-900">{orderDetails?.studentName || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Plan Selected</span>
              <span className="font-bold text-brand-blue capitalize">{orderDetails?.planId ? orderDetails.planId.replace(/-/g, ' ') : "N/A"}</span>
            </div>
            {currentBankTxnId && currentBankTxnId !== "N/A" && currentBankTxnId !== "TXN_NOT_PROVIDED" && (
              <div className="flex justify-between">
                <span className="text-gray-500">Bank Txn ID</span>
                <span className="font-bold text-gray-700 font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{currentBankTxnId}</span>
              </div>
            )}
            <div className="pt-3 border-t border-dashed border-gray-100 flex justify-between items-center text-base">
              <span className="font-bold text-gray-900">Amount Paid</span>
              <span className="text-xl font-black text-brand-orange">₹{orderDetails?.amount || 0}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
          <Link to="/dashboard" className="px-8 py-4 bg-brand-orange text-white font-bold rounded-full hover:bg-orange-600 transition-all shadow-lg hover:-translate-y-1 text-center flex-1">
            Go to Dashboard
          </Link>
          <button 
            onClick={() => generateReceipt(orderDetails, status)}
            className="px-8 py-4 bg-white border-2 border-brand-blue text-brand-blue font-bold rounded-full hover:bg-brand-blue hover:text-white transition-all shadow-sm flex justify-center items-center gap-2 flex-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Receipt PDF
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // UI: FAILED / CANCELLED STATE
  // ==========================================
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans px-4 py-12 text-center">
      <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500 shadow-lg shadow-red-50/50">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
      </div>
      
      <span className="text-sm font-bold uppercase tracking-widest text-red-500 mb-2">
        {status === "CANCELLED" ? "Transaction Cancelled" : "Transaction Failed"}
      </span>
      <h1 className="text-4xl md:text-5xl font-extrabold text-brand-blue mb-4">Oops, something went wrong.</h1>
      
      <p className="text-lg text-gray-600 mb-6 max-w-lg">
        {status === "CANCELLED" 
          ? "You cancelled the payment process. Your account has not been charged."
          : "We couldn't process your payment. If money was deducted, it will be refunded by your bank within 3-5 business days."}
      </p>

      {/* On-screen details context for Error States */}
      <div className="bg-white border border-gray-100 rounded-3xl p-5 w-full max-w-md mb-8 text-left shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Reference Information</h3>
        <div className="space-y-2 text-xs font-medium">
          <div className="flex justify-between">
            <span className="text-gray-400">Order Reference</span>
            <span className="font-mono text-gray-900 font-bold">{orderId}</span>
          </div>
          {orderDetails?.studentName && (
            <div className="flex justify-between">
              <span className="text-gray-400">Student Profile</span>
              <span className="text-gray-900 font-bold">{orderDetails.studentName}</span>
            </div>
          )}
          {orderDetails?.amount && (
            <div className="flex justify-between">
              <span className="text-gray-400">Attempted Amount</span>
              <span className="text-gray-900 font-bold">₹{orderDetails.amount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
        <Link to="/enroll" className="px-8 py-4 bg-brand-blue text-white font-bold rounded-full hover:bg-blue-800 transition-all shadow-lg hover:-translate-y-1 text-center flex-1">
          Try Again
        </Link>
        <button 
            onClick={() => generateReceipt(orderDetails || { orderId: orderId }, status)}
            className="px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-full hover:bg-gray-50 transition-all shadow-sm flex justify-center items-center gap-2 flex-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Save PDF Report
        </button>
      </div>
    </div>
  );
};

export default PaymentStatus;