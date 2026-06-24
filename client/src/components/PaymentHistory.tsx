import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

// Define the interface based on your updated Order schema
interface PaymentRecord {
  _id: string;
  orderId: string;
  planId: string;
  studentName: string;
  phone: string;
  amount: number;
  status: string;
  phonepeTransactionId?: string;
  createdAt: string;
}

const PaymentHistory = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API?.endsWith('/') 
            ? import.meta.env.VITE_API 
            : `${import.meta.env.VITE_API}/`;

        const response = await axios.get(`${apiUrl}api/payment/all-payments`);

        if (response.data.success) {
          setPayments(response.data.payments);
        }
      } catch (error) {
        console.error("Failed to fetch payment history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayments();
  }, []);

  // Helper function to render the correct status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Success</span>;
      case "FAILED":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Failed</span>;
      case "PENDING":
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-brand-orange">Pending</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20 px-4 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-extrabold text-brand-blue mb-2">
              Payment History
            </h1>
            <p className="text-gray-500">
              View all transactions, student enrollments, and statuses.
            </p>
          </div>
          <Link 
            to="/dashboard" 
            className="inline-flex items-center justify-center px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:text-brand-blue hover:border-brand-blue transition-colors shadow-sm"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-brand-blue font-bold">Loading records...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">No Payments Found</h3>
              <p className="text-gray-500">There are no transaction records in the database yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="p-5 font-bold">Order Details</th>
                    <th className="p-5 font-bold">Student Info</th>
                    <th className="p-5 font-bold">Amount</th>
                    <th className="p-5 font-bold">Status</th>
                    <th className="p-5 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map((payment) => (
                    <tr key={payment._id} className="hover:bg-slate-50 transition-colors duration-150">
                      
                      {/* Order Details */}
                      <td className="p-5">
                        <div className="font-bold text-brand-blue capitalize mb-1">
                          {payment.planId.replace(/-/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          ID: {payment.orderId}
                        </div>
                        {payment.phonepeTransactionId && (
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                            Txn: {payment.phonepeTransactionId}
                          </div>
                        )}
                      </td>

                      {/* Student Info */}
                      <td className="p-5">
                        <div className="font-bold text-gray-800 mb-1">
                          {payment.studentName || "N/A"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {payment.phone || "No phone provided"}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="p-5">
                        <div className="font-black text-brand-orange text-lg">
                          ₹{payment.amount}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-5">
                        {getStatusBadge(payment.status)}
                      </td>

                      {/* Date */}
                      <td className="p-5 text-sm text-gray-500 font-medium">
                        {new Date(payment.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PaymentHistory;