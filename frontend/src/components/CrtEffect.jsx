import './CrtEffect.css';

const CrtEffect = () => {
  return (
    <div className="crt-container">
      {/* Traits verticaux qui défilent de haut en bas */}
      <div className="vertical-scan-lines">
        {[...Array(20)].map((_, index) => {
          // Variation aléatoire de l'opacité entre 0.4 et 0.9
          const randomOpacity = 0.4 + Math.random() * 0.5;
          // Longueur aléatoire entre 60% et 100% de la hauteur
          const randomHeight = 60 + Math.random() * 40;
          return (
            <div 
              key={index} 
              className="scan-line"
              style={{ 
                animationDelay: `${index * 0.1}s`,
                left: `${index * 5}%`,
                opacity: randomOpacity,
                height: `${randomHeight}%`
              }}
            ></div>
          );
        })}
      </div>

      {/* Effet de scanlines horizontales */}
      <div className="horizontal-scanlines"></div>
      
      {/* Effet de phosphore (lueur résiduelle) */}
      <div className="phosphor-glow"></div>
    </div>
  );
};

export default CrtEffect;
