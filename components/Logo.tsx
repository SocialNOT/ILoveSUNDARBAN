
import React from 'react';

interface LogoProps {
  variant?: 'header' | 'footer';
  text?: string;
}

const Logo: React.FC<LogoProps> = ({ variant = 'footer', text = "I💚Sundarban" }) => {
  if (variant === 'header') {
    return (
      <div className="relative group cursor-default flex items-center select-none">
         {/* Glow effect behind the text */}
         <div className="absolute inset-0 bg-skin-accent/20 blur-xl rounded-full opacity-50 group-hover:opacity-80 transition-opacity"></div>
         
         <h1 className="relative z-10 text-xl md:text-2xl font-serif font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-skin-accent via-skin-accent to-skin-accent drop-shadow-sm truncate max-w-[200px] md:max-w-none">
            {text}
         </h1>
      </div>
    );
  }

  // Footer version (Larger, with underline and hover glow)
  return (
    <div className="mb-4 relative group cursor-default flex flex-col items-center select-none">
      <div className="absolute -inset-2 bg-skin-accent/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
      <h1 className="text-3xl font-serif font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-skin-accent via-skin-accent to-skin-accent drop-shadow-md">
        {text}
      </h1>
      <div className="h-[1px] w-12 mx-auto bg-gradient-to-r from-transparent via-skin-accent/50 to-transparent mt-2"></div>
    </div>
  );
};

export default Logo;
