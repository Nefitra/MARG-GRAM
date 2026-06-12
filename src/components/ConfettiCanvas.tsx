/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface ConfettiRef {
  /**
   * Triggers a confetti burst.
   * @param intensity - "high" for high-level milestone claims (launches a double-fountain fireworks display), "medium" for regular.
   */
  trigger: (intensity?: 'high' | 'medium') => void;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  drift: number;
  driftSpeed: number;
  shape: 'rect' | 'circle' | 'triangle' | 'star';
}

const ConfettiCanvas = forwardRef<ConfettiRef, {}>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const colors = [
    '#a855f7', // Cyber Purple
    '#c084fc', // Bright Lavender
    '#10b981', // Emerald Matrix Green
    '#06b6d4', // Electric Turquoise
    '#f59e0b', // Solar Amber/Gold
    '#ec4899', // Plasma Neon Pink
    '#3b82f6', // Cobalt Blue
    '#ffffff', // Absolute Lucid White
  ];

  const trigger = (intensity: 'high' | 'medium' = 'medium') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    const count = intensity === 'high' ? 140 : 60;
    const newParticles: Particle[] = [];

    const shapes: Array<'rect' | 'circle' | 'triangle' | 'star'> = ['rect', 'circle', 'triangle', 'star'];

    if (intensity === 'high') {
      // Epic dual-fountain configuration emitting from both bottom corners upwards and inwards
      // Bottom Left launcher
      for (let i = 0; i < count / 2; i++) {
        const size = Math.random() * 8 + 6;
        newParticles.push({
          x: width * 0.05,
          y: height * 0.95,
          size,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: Math.random() * 12 + 6, // strong rightwards push
          vy: -(Math.random() * 18 + 14), // strong upwards push
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12,
          opacity: 1,
          drift: Math.random() * 2,
          driftSpeed: (Math.random() - 0.5) * 0.05,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
        });
      }

      // Bottom Right launcher
      for (let i = 0; i < count / 2; i++) {
        const size = Math.random() * 8 + 6;
        newParticles.push({
          x: width * 0.95,
          y: height * 0.95,
          size,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: -(Math.random() * 12 + 6), // strong leftwards push
          vy: -(Math.random() * 18 + 14), // strong upwards push
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12,
          opacity: 1,
          drift: Math.random() * 2,
          driftSpeed: (Math.random() - 0.5) * 0.05,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
        });
      }

      // Add small center burst of stars
      for (let i = 0; i < 20; i++) {
        newParticles.push({
          x: width * 0.5,
          y: height * 0.4,
          size: Math.random() * 10 + 8,
          color: '#f59e0b', // Gold stars
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 15,
          opacity: 1.2, // extra bright
          drift: 0,
          driftSpeed: 0,
          shape: 'star',
        });
      }
    } else {
      // Standard burst shooting from the middle lower-center upwards
      for (let i = 0; i < count; i++) {
        const size = Math.random() * 7 + 4;
        newParticles.push({
          x: width * 0.5,
          y: height * 0.85,
          size,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: (Math.random() - 0.5) * 14, // wide spread
          vy: -(Math.random() * 14 + 10), // moderate up shoot
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 8,
          opacity: 1,
          drift: Math.random() * 1.5,
          driftSpeed: (Math.random() - 0.5) * 0.03,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
        });
      }
    }

    particlesRef.current = [...particlesRef.current, ...newParticles];

    // Boot up requestAnimationFrame ticks if not actively looping
    if (animationFrameRef.current === null) {
      tick();
    }
  };

  useImperativeHandle(ref, () => ({
    trigger,
  }));

  const tick = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    if (particles.length === 0) {
      animationFrameRef.current = null;
      return;
    }

    const nextParticles: Particle[] = [];

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Update velocities with gravity and air drag
      p.x += p.vx + Math.sin(p.drift) * 0.5;
      p.y += p.vy;
      p.vy += 0.35; // gravity pull
      p.vx *= 0.975; // drag resistance
      p.vy *= 0.975; // drag resistance
      p.rotation += p.rotationSpeed;
      p.drift += p.driftSpeed;

      // Handle custom boundary fade parameters
      if (p.y > canvas.height * 0.45) {
        p.opacity -= 0.012; // slow fadeout below mid height
      }

      if (p.opacity > 0 && p.y < canvas.height + 20 && p.x > -30 && p.x < canvas.width + 30) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));
        ctx.fillStyle = p.color;

        if (p.shape === 'star') {
          // Render vector 5-point star
          ctx.beginPath();
          const spikes = 5;
          const outerRadius = p.size;
          const innerRadius = p.size / 2.2;
          let rot = (Math.PI / 2) * 3;
          let cx = 0;
          let cy = 0;
          const step = Math.PI / spikes;

          ctx.moveTo(0, -outerRadius);
          for (let s = 0; s < spikes; s++) {
            cx = Math.cos(rot) * outerRadius;
            cy = Math.sin(rot) * outerRadius;
            ctx.lineTo(cx, cy);
            rot += step;

            cx = Math.cos(rot) * innerRadius;
            cy = Math.sin(rot) * innerRadius;
            ctx.lineTo(cx, cy);
            rot += step;
          }
          ctx.lineTo(0, -outerRadius);
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'triangle') {
          // Render precise symmetric triangle
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size, p.size * 0.85);
          ctx.lineTo(-p.size, p.size * 0.85);
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'circle') {
          // Render elongated ellipses/circular dots
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size / 1.7, p.size, 0, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          // Render general rectangle confetti ribbon
          ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
        }

        ctx.restore();
        nextParticles.push(p);
      }
    }

    particlesRef.current = nextParticles;
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Match the sizing of the nearest relative block
        canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
        canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-50 select-none"
      id="milestone-confetti-canvas"
    />
  );
});

ConfettiCanvas.displayName = 'ConfettiCanvas';

export default ConfettiCanvas;
