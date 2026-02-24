import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// Configure mermaid (you can change the theme to 'dark' or 'base')
mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
});

interface MermaidProps {
  chart: string;
}

const MermaidChart: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && chart) {
      // Clear previous chart before re-rendering
      ref.current.removeAttribute('data-processed');
      mermaid.contentLoaded();
    }
  }, [chart]);

  return (
    <div className="mermaid bg-slate-900 p-4 rounded-lg overflow-auto" ref={ref}>
      {chart}
    </div>
  );
};

export default MermaidChart;