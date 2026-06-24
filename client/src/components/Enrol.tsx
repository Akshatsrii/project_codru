import React, { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface Plan {
    planId: string;
    name: string;
    price: number;
    billingCycle: string;
}

const EnrollPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const urlPlanId = searchParams.get('plan');
    
    // State Management
    const [plans, setPlans] = useState<Plan[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string>(urlPlanId || '');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isWhatsAppSame, setIsWhatsAppSame] = useState<boolean>(true);

    // Fetch plans from API
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API}api/payment/active-plans`);
                const data = await response.json();
                setPlans(data.plans);
                
                if (!urlPlanId && data.plans.length > 0) {
                    setSelectedPlanId(data.plans[0].planId);
                }
            } catch (error) {
                console.error("Failed to load plans", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlans();
    }, [urlPlanId]);

    const activePlan = plans.find(p => p.planId === selectedPlanId);

    const handleCheckout = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!activePlan) return;
        
        const formData = new FormData(e.currentTarget); 
        const phone = formData.get('phone') as string;
        const whatsapp = isWhatsAppSame ? phone : (formData.get('whatsapp') as string);
        
        try {
            const response = await fetch(`${import.meta.env.VITE_API}api/payment/create-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: localStorage.getItem("userId") || null, // Send null if logged out
                    planId: activePlan.planId,
                    studentName: formData.get('studentName'),
                    email: formData.get('email'),
                    phone: phone,
                    whatsapp: whatsapp
                })
            });

            const data = await response.json();

            if (data.success && data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else {
                alert("Payment initiation failed. Please try again.");
            }
        } catch (error) {
            console.error("Checkout Error:", error);
            alert("Unable to connect to the payment server.");
        }
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-brand-blue font-bold">Loading Plans...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 pt-24 pb-20 px-4 font-body flex justify-center">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
                
                <h1 className="text-2xl font-display font-bold text-brand-blue mb-6">
                    Enrollment Details
                </h1>
                
                <form onSubmit={handleCheckout} className="space-y-5">
                    
                    {/* Dynamic Dropdown */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Select Plan</label>
                        <select 
                            value={selectedPlanId}
                            onChange={(e) => setSelectedPlanId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition bg-white"
                        >
                            {plans.map((plan) => (
                                <option key={plan.planId} value={plan.planId}>
                                    {plan.name} - ₹{plan.price} {plan.billingCycle === 'MONTHLY' ? '/mo' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Student / Parent Name</label>
                        <input 
                            name="studentName" 
                            type="text" 
                            required 
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-blue outline-none transition"
                            placeholder="Enter full name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Email ID</label>
                        <input 
                            name="email" 
                            type="email" 
                            required 
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-blue outline-none transition"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number</label>
                        <input 
                            name="phone" 
                            type="tel" 
                            required 
                            pattern="[0-9]{10}"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-blue outline-none transition"
                            placeholder="10-digit mobile number"
                        />
                    </div>

                    {/* WhatsApp Toggle */}
                    <div className="flex items-center gap-2 mt-2">
                        <input 
                            type="checkbox" 
                            id="whatsappToggle" 
                            checked={isWhatsAppSame}
                            onChange={(e) => setIsWhatsAppSame(e.target.checked)}
                            className="w-4 h-4 text-brand-orange focus:ring-brand-orange border-gray-300 rounded"
                        />
                        <label htmlFor="whatsappToggle" className="text-sm text-gray-600 cursor-pointer">
                            This is also my WhatsApp number
                        </label>
                    </div>

                    {/* Conditional WhatsApp Field */}
                    {!isWhatsAppSame && (
                        <div className="animate-fade-in-up">
                            <label className="block text-sm font-bold text-gray-700 mb-1">WhatsApp Number <span className="text-gray-400 font-normal">(Optional)</span></label>
                            <input 
                                name="whatsapp" 
                                type="tel" 
                                pattern="[0-9]{10}"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-blue outline-none transition bg-green-50/50"
                                placeholder="10-digit WhatsApp number"
                            />
                        </div>
                    )}
                    
                    <button 
                        type="submit" 
                        className="w-full mt-8 py-4 bg-brand-orange text-white font-bold rounded-xl hover:bg-orange-600 transition shadow-lg transform hover:-translate-y-1">
                        Pay ₹{activePlan?.price || 0}
                    </button>
                </form>

            </div>
        </div>
    );
};

export default EnrollPage;