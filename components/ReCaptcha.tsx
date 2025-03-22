"use client";

import { useEffect, useState, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";

interface RecaptchaProps {
  onChange: (token: string | null) => void;
  size?: "normal" | "compact";
  className?: string;
}

const RecaptchaComponent = ({ onChange, size = "normal", className = "" }: RecaptchaProps) => {
  const [mounted, setMounted] = useState(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  
  useEffect(() => {
    setMounted(true);
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
    };
  }, []);
  
  if (!mounted) return null;
  
  return (
    <div className={className}>
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
        onChange={onChange}
        size={size === "compact" ? "compact" : "normal"}
        theme="dark"
      />
    </div>
  );
};

export default RecaptchaComponent; 