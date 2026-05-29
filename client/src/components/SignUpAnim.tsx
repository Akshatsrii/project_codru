import LottiePackage from 'lottie-react';
import signUpAnimData from '../assets/jsonFiles/signUpAnim.json';

const Lottie = (LottiePackage as any).default || LottiePackage;

const SignUpAnim = () => {
  return (
    // We use 'pointer-events-none' so the animation doesn't block clicks
    <div className="pointer-events-none flex justify-center items-center w-full h-full">
      <Lottie 
        animationData={signUpAnimData} 
        loop={true} 
        autoplay={true}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default SignUpAnim;