import React, { useEffect, useMemo, useState } from "react";

const FOOD_EMOJIS = ["🥑", "🍏", "🥦", "🥝", "🥬", "🥒", "🥥", "🥕", "🍇", "🍓", "🍋", "🍃"];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

type Food = {
  emoji: string;
  startX: string;
  startY: string;
  endX: string;
  endY: string;
  rotX: string;
  rotY: string;
  endScale: number;
  finalOpacity: number;
  delay: string;
  duration: string;
};

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const [gone, setGone] = useState(false);

  const foods = useMemo<Food[]>(() => {
    return Array.from({ length: 18 }).map(() => ({
      emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)],
      startX: (Math.random() - 0.5) * 100 + "vw",
      startY: (Math.random() - 0.5) * 100 + "vh",
      endX: (Math.random() - 0.5) * 150 + "vw",
      endY: (Math.random() - 0.5) * 150 + "vh",
      rotX: Math.random() * 360 + "deg",
      rotY: Math.random() * 360 + "deg",
      endScale: Math.random() * 1.5 + 1,
      finalOpacity: Math.random() * 0.3 + 0.1,
      delay: Math.random() * 0.8 + "s",
      duration: Math.random() * 1.2 + 1.4 + "s",
    }));
  }, []);

  const handleSkip = () => {
    setGone(true);
    setTimeout(onDone, 300);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setGone(true);
      setTimeout(onDone, 400);
    }, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  // Exact 8 chars matching HTML structure (l-1..l-8). Brand: sar.sacn
  const chars = ["s", "a", "r", ".", "s", "a", "c", "n"];

  return (
    <div onClick={handleSkip} className={`intro-screen cursor-pointer ${gone ? "intro-fade" : ""}`}>
      <style>{`
        /* Reset e Configurações Base */
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap');

        .intro-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: #000000; /* Fundo escuro absoluto */
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            perspective: 2000px; /* Profundidade do 3D aumentada */
            font-family: 'Montserrat', 'Segoe UI', sans-serif;
        }

        .intro-fade {
            animation: fadeOutIntro 1.2s cubic-bezier(0.8, 0, 0.2, 1) forwards;
        }

        /* --- CAMADA DA TEMPESTADE DE ALIMENTOS 3D --- */
        .food-storm {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            transform-style: preserve-3d;
            pointer-events: none;
            z-index: 1;
        }

        .food-item {
            position: absolute;
            font-size: 3rem; /* Tamanho base dos alimentos */
            opacity: 0;
            /* Filtro radical monocromático */
            filter: grayscale(100%) brightness(1.5);
            transform-style: preserve-3d;
            animation: food-in-out var(--dur) ease-in-out var(--del) forwards;
        }

        /* --- ESTRUTURA DO TEXTO CENTRAL (Transformação 3D) --- */
        .logo-container {
            position: relative;
            z-index: 10;
            display: flex;
            align-items: baseline;
            font-size: 7.5rem;
            font-weight: 900;
            color: #ffffff;
            text-shadow: 0px 30px 60px rgba(0, 0, 0, 0.5);
            transform-style: preserve-3d;
            letter-spacing: -0.05em;
        }

        .char { display: inline-block; opacity: 0; transform-style: preserve-3d; }
        .dot { color: #ffffff !important; margin: 0 5px; text-shadow: 0px 0px 20px rgba(255, 255, 255, 0.6); }

        .underline {
            position: absolute; bottom: -15px; left: 0; height: 6px;
            background: linear-gradient(90deg, transparent, #ffffff, transparent);
            border-radius: 3px; width: 0%; left: 50%; transform: translateX(-50%); opacity: 0;
            animation: drawLineCenter 1s cubic-bezier(0.85, 0, 0.15, 1) 2.2s forwards, eraseLineCenter 0.8s cubic-bezier(0.85, 0, 0.15, 1) 4.5s forwards;
        }

        /* TRAJETÓRIAS DAS LETRAS (Dupla animação: IN aos 1s, OUT aos 4.8s) */
        .l-1 { animation: in-Left 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1.2s forwards, out-Z 1s cubic-bezier(0.55, 0.085, 0.68, 0.53) 4.9s forwards; }
        .l-2 { animation: in-Top 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1.4s forwards, out-Up 1s cubic-bezier(0.55, 0.085, 0.68, 0.53) 4.8s forwards; }
        .l-3 { animation: in-Bottom 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1.3s forwards, out-Down 1s cubic-bezier(0.55, 0.085, 0.68, 0.53) 5.0s forwards; }
        .l-4 { animation: in-Pop 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.5) 2.0s forwards, out-Pop 0.8s cubic-bezier(0.55, 0.085, 0.68, 0.53) 4.7s forwards; }
        .l-5 { animation: in-Diagonal 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1.5s forwards, out-Diagonal 1s cubic-bezier(0.55, 0.085, 0.68, 0.53) 4.9s forwards; }
        .l-6 { animation: in-Bottom 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1.7s forwards, out-Z 1s cubic-bezier(0.55, 0.085, 0.68, 0.53) 5.1s forwards; }
        .l-7 { animation: in-Flip 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1.6s forwards, out-Flip 1s cubic-bezier(0.55, 0.085, 0.68, 0.53) 4.8s forwards; }
        .l-8 { animation: in-Right 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) 1.8s forwards, out-Right 1s cubic-bezier(0.55, 0.085, 0.68, 0.53) 5.0s forwards; }

        /* --- KEYFRAMES DE ENTRADA DO TEXTO --- */
        @keyframes in-Left { 0% { transform: translate3d(-300px, 0, -500px) rotateY(-90deg) scale(0); opacity: 0; } 100% { transform: translate3d(0,0,0) rotateY(0) scale(1); opacity: 1; } }
        @keyframes in-Top { 0% { transform: translate3d(0, -300px, 200px) rotateX(90deg); opacity: 0; } 100% { transform: translate3d(0,0,0) rotateX(0); opacity: 1; } }
        @keyframes in-Bottom { 0% { transform: translate3d(0, 300px, -200px) rotateX(-90deg); opacity: 0; } 100% { transform: translate3d(0,0,0) rotateX(0); opacity: 1; } }
        @keyframes in-Pop { 0% { transform: scale(0) translateZ(-500px); opacity: 0; } 50% { transform: scale(1.4) translateZ(100px); opacity: 1; } 100% { transform: scale(1) translateZ(0); opacity: 1; } }
        @keyframes in-Diagonal { 0% { transform: translate3d(200px, -200px, 300px) rotateZ(45deg); opacity: 0; } 100% { transform: translate3d(0,0,0) rotateZ(0); opacity: 1; } }
        @keyframes in-Flip { 0% { transform: translateY(-150px) rotateX(180deg) rotateY(180deg); opacity: 0; } 100% { transform: translateY(0) rotateX(0) rotateY(0); opacity: 1; } }
        @keyframes in-Right { 0% { transform: translate3d(300px, 0, -500px) rotateY(90deg) scale(0); opacity: 0; } 100% { transform: translate3d(0,0,0) rotateY(0) scale(1); opacity: 1; } }
        @keyframes drawLineCenter { 0% { width: 0%; opacity: 0; } 100% { width: 110%; opacity: 1; } }

        /* --- KEYFRAMES DE SAÍDA DO TEXTO --- */
        @keyframes out-Z { to { transform: translateZ(1000px) rotateY(45deg); opacity: 0; } } 
        @keyframes out-Up { to { transform: translate3d(0, -600px, -300px) rotateX(-90deg); opacity: 0; } }
        @keyframes out-Down { to { transform: translate3d(0, 600px, 500px) rotateX(90deg) scale(2); opacity: 0; } }
        @keyframes out-Pop { 0% { transform: scale(1); opacity: 1; } to { transform: scale(0) translateZ(-1000px) rotateZ(180deg); opacity: 0; } } 
        @keyframes out-Diagonal { to { transform: translate3d(500px, -500px, 600px) rotateZ(90deg); opacity: 0; } }
        @keyframes out-Flip { to { transform: translate3d(0, 400px, 800px) rotateX(360deg) scale(2); opacity: 0; } }
        @keyframes out-Right { to { transform: translate3d(600px, 0, 300px) rotateY(-90deg) scale(0.5); opacity: 0; } }
        @keyframes eraseLineCenter { 0% { width: 110%; opacity: 1; } 100% { width: 0%; opacity: 0; } }

        /* --- KEYFRAMES DOS ALIMENTOS 3D --- */
        @keyframes food-in-out {
            0% { 
                transform: translate3d(var(--startX), var(--startY), -1500px) rotateX(0) rotateY(0) scale(0);
                opacity: 0;
            }
            20% { 
                opacity: var(--finalOpacity); 
            }
            80% { 
                opacity: var(--finalOpacity); 
            }
            100% { 
                /* Voam na direção da câmera e espalham-se */
                transform: translate3d(var(--endX), var(--endY), 800px) rotateX(var(--rotX)) rotateY(var(--rotY)) scale(var(--endScale));
                opacity: 0;
            }
        }

        /* Revela o site no final */
        @keyframes fadeOutIntro {
            0% { opacity: 1; visibility: visible; }
            100% { opacity: 0; visibility: hidden; pointer-events: none; }
        }

        @media (max-width: 768px) {
            .logo-container { font-size: 3.5rem !important; }
        }
      `}</style>

      <div className="food-storm">
        {foods.map((f, i) => (
          <span
            key={i}
            className="food-item"
            style={
              {
                fontSize: "3rem",
                ["--startX" as string]: f.startX,
                ["--startY" as string]: f.startY,
                ["--endX" as string]: f.endX,
                ["--endY" as string]: f.endY,
                ["--rotX" as string]: f.rotX,
                ["--rotY" as string]: f.rotY,
                ["--endScale" as string]: String(f.endScale),
                ["--finalOpacity" as string]: String(f.finalOpacity),
                ["--dur" as string]: f.duration,
                ["--del" as string]: f.delay,
              } as React.CSSProperties
            }
          >
            {f.emoji}
          </span>
        ))}
      </div>

      <div className="logo-container">
        {chars.map((ch, i) => {
          const isDot = ch === ".";
          return (
            <span key={i} className={`char l-${i + 1}${isDot ? " dot" : ""}`}>
              {ch}
            </span>
          );
        })}
        <div className="underline" />
      </div>
    </div>
  );
}
