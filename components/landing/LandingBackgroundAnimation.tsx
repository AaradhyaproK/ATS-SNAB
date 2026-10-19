import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface LandingBackgroundAnimationProps {
  isDark?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  color: string;
  pulseSpeed: number;
  pulsePhase: number;
}

export const LandingBackgroundAnimation: React.FC<LandingBackgroundAnimationProps> = ({ isDark = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number | null; y: number | null; radius: number }>({
    x: null,
    y: null,
    radius: 170,
  });

  // Neural Constellation Canvas Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const onMouseLeave = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave);

    // Color palettes for particles and links
    const darkColors = ['#10b981', '#06b6d4', '#6366f1', '#3b82f6', '#34d399'];
    const lightColors = ['#059669', '#0284c7', '#4f46e5', '#2563eb', '#10b981'];
    const activeColors = isDark ? darkColors : lightColors;

    // Responsive particle count (balanced for high-framerate performance)
    const particleCount = Math.min(Math.floor((width * height) / 18000), 75);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 1.8 + 1,
        baseAlpha: Math.random() * 0.4 + (isDark ? 0.25 : 0.15),
        color: activeColors[Math.floor(Math.random() * activeColors.length)],
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    const maxConnectionDistance = 140;
    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;
      const mouseRadius = mouseRef.current.radius;

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move particle
        p.x += p.vx;
        p.y += p.vy;

        // Bounce gently at screen boundaries
        if (p.x < 0) {
          p.x = 0;
          p.vx *= -1;
        } else if (p.x > width) {
          p.x = width;
          p.vx *= -1;
        }
        if (p.y < 0) {
          p.y = 0;
          p.vy *= -1;
        } else if (p.y > height) {
          p.y = height;
          p.vy *= -1;
        }

        // Mouse gentle repel / attraction effect
        if (mouseX !== null && mouseY !== null) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouseRadius && dist > 0) {
            const force = (mouseRadius - dist) / mouseRadius;
            p.x -= (dx / dist) * force * 1.2;
            p.y -= (dy / dist) * force * 1.2;
          }
        }

        // Pulsing glow
        const currentAlpha = p.baseAlpha + Math.sin(time * p.pulseSpeed * 50 + p.pulsePhase) * 0.15;
        const clampedAlpha = Math.max(0.08, Math.min(1, currentAlpha));

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = clampedAlpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = isDark ? 8 : 4;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Connect particles with neural synaptic lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectionDistance) {
            const linkAlpha = (1 - dist / maxConnectionDistance) * (isDark ? 0.22 : 0.12);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isDark ? '#10b981' : '#059669';
            ctx.globalAlpha = linkAlpha;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }

        // Connect to mouse if nearby
        if (mouseX !== null && mouseY !== null) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouseRadius) {
            const mouseAlpha = (1 - dist / mouseRadius) * (isDark ? 0.35 : 0.2);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouseX, mouseY);
            ctx.strokeStyle = isDark ? '#34d399' : '#10b981';
            ctx.globalAlpha = mouseAlpha;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [isDark]);

  // Ambient floating glowing dust motes (stardust)
  const stardust = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      x: `${(i * 19) % 100}%`,
      y: `${(i * 37) % 100}%`,
      size: (i % 3) + 2,
      duration: 12 + (i % 8) * 2,
      delay: (i % 5) * 1.5,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* ── 1. Floating Luminous Aurora Mesh Orbs (Hardware-Accelerated) ── */}
      <div className="absolute inset-0 overflow-hidden filter blur-[100px] sm:blur-[130px] opacity-70 dark:opacity-85">
        {/* Emerald Core Orb (Top Center/Left) */}
        <motion.div
          animate={{
            x: ['-20%', '15%', '-10%', '-20%'],
            y: ['0%', '25%', '-15%', '0%'],
            scale: [1, 1.25, 0.9, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -top-[10%] left-[20%] w-[550px] sm:w-[750px] h-[550px] sm:h-[750px] rounded-full bg-gradient-to-tr from-emerald-500/25 via-teal-400/20 to-transparent dark:from-emerald-500/30 dark:via-teal-400/20 dark:to-transparent"
        />

        {/* Electric Indigo/Purple Orb (Top Right) */}
        <motion.div
          animate={{
            x: ['10%', '-25%', '15%', '10%'],
            y: ['-10%', '20%', '10%', '-10%'],
            scale: [1.1, 0.85, 1.2, 1.1],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
          className="absolute -top-[5%] right-[5%] w-[500px] sm:w-[700px] h-[500px] sm:h-[700px] rounded-full bg-gradient-to-bl from-indigo-500/20 via-purple-500/15 to-transparent dark:from-indigo-600/25 dark:via-purple-600/20 dark:to-transparent"
        />

        {/* Cyan & Azure Surge Orb (Mid Center) */}
        <motion.div
          animate={{
            x: ['-15%', '20%', '-20%', '-15%'],
            y: ['35%', '50%', '30%', '35%'],
            scale: [0.95, 1.15, 0.85, 0.95],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 4,
          }}
          className="absolute top-[30%] left-[30%] w-[450px] sm:w-[650px] h-[450px] sm:h-[650px] rounded-full bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-emerald-400/10 dark:from-cyan-500/20 dark:via-blue-600/20 dark:to-emerald-400/15"
        />

        {/* Deep Violet Horizon Orb (Bottom Left) */}
        <motion.div
          animate={{
            x: ['0%', '-15%', '10%', '0%'],
            y: ['70%', '60%', '80%', '70%'],
            scale: [1, 1.3, 0.95, 1],
          }}
          transition={{
            duration: 24,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className="absolute bottom-[-10%] left-[-5%] w-[500px] sm:w-[680px] h-[500px] sm:h-[680px] rounded-full bg-gradient-to-tr from-violet-600/15 via-indigo-500/15 to-transparent dark:from-violet-700/25 dark:via-indigo-800/20 dark:to-transparent"
        />
      </div>

      {/* ── 2. Precision Cyber Matrix Grid ── */}
      <div
        className="absolute inset-0 bg-[radial-gradient(#80808018_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff0f_1px,transparent_1px)] bg-[size:32px_32px]"
        style={{
          maskImage: 'radial-gradient(ellipse 85% 65% at 50% 20%, #000 65%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 65% at 50% 20%, #000 65%, transparent 100%)',
        }}
      />

      {/* ── 3. Animated High-Speed Laser Cyber Beams ── */}
      <div className="absolute inset-0 opacity-40 dark:opacity-60 overflow-hidden">
        {/* Horizontal Laser 1 */}
        <motion.div
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: '200%', opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: 'easeInOut',
            repeatDelay: 5,
          }}
          className="absolute top-[18%] left-0 w-[350px] h-[1px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981]"
        />

        {/* Horizontal Laser 2 */}
        <motion.div
          initial={{ x: '200%', opacity: 0 }}
          animate={{ x: '-100%', opacity: [0, 0.9, 0.9, 0] }}
          transition={{
            duration: 8.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 3,
            repeatDelay: 6,
          }}
          className="absolute top-[48%] right-0 w-[420px] h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#06b6d4]"
        />

        {/* Vertical Pulse Beam */}
        <motion.div
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: '200%', opacity: [0, 0.8, 0.8, 0] }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 6,
            repeatDelay: 8,
          }}
          className="absolute top-0 left-[22%] w-[1px] h-[300px] bg-gradient-to-b from-transparent via-indigo-400 to-transparent shadow-[0_0_8px_#818cf8]"
        />
      </div>

      {/* ── 4. Interactive Neural Constellation Canvas ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 30%, #000 60%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 30%, #000 60%, transparent 100%)',
        }}
      />

      {/* ── 5. Ambient Floating Stardust & Shimmer Sparks ── */}
      <div className="absolute inset-0">
        {stardust.map((star) => (
          <motion.div
            key={star.id}
            initial={{ opacity: 0.1, y: 0 }}
            animate={{
              opacity: [0.15, 0.75, 0.2],
              y: [-15, 15, -15],
              scale: [0.9, 1.25, 0.9],
            }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
            }}
            className="rounded-full bg-emerald-400 dark:bg-emerald-300 shadow-[0_0_6px_#34d399]"
          />
        ))}
      </div>

      {/* ── 6. Ultra-Subtle Vignette Horizon Overlay for Perfect Typography Readability ── */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/30 dark:to-black/50 pointer-events-none" />
    </div>
  );
};

export default LandingBackgroundAnimation;
