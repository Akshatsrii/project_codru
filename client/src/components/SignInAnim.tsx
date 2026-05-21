// Import the package as a generic object
import LottiePackage from 'lottie-react';
import signInAnimData from '../assets/jsonFiles/signInAnim3.json';

// 🚨 BULLETPROOF FIX: Rips the function out of the object if Vite wrapped it!
const Lottie = (LottiePackage as any).default || LottiePackage;

function SignInAnim() {
  return (
    <div className="pointer-events-none flex justify-center items-center w-full h-full">
      <Lottie 
        animationData={signInAnimData} 
        loop={true} 
        autoplay={true}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default SignInAnim;