
import React from 'react';

interface ImageModalProps {
  imageUrl: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose }) => {
  const downloadImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `gemini-pulse-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 text-white/70 hover:text-white text-2xl p-2 transition-colors"
      >
        <i className="fas fa-times"></i>
      </button>

      <div className="relative max-w-4xl w-full flex flex-col items-center gap-6" onClick={e => e.stopPropagation()}>
        <img 
          src={imageUrl} 
          alt="Large preview" 
          className="max-h-[80vh] w-auto rounded-xl shadow-2xl border border-white/10"
        />
        
        <button 
          onClick={downloadImage}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
        >
          <i className="fas fa-download"></i>
          Download Artwork
        </button>
      </div>
    </div>
  );
};

export default ImageModal;
