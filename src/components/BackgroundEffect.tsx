/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import React, { useMemo } from 'react';

export default function BackgroundEffect() {
  // Generate stable random particles on component mounts
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 10 + 12,
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-deep-black -z-50 pointer-events-none">
      {/* 1. Underlying Deep Space Nebula */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(168,85,247,0.12)_0%,rgba(2,1,10,1)_80%)]" />
      <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-neon-violet/10 blur-[130px]" />
      <div className="absolute top-[40%] -right-[20%] w-[70%] h-[70%] rounded-full bg-electric-purple/10 blur-[150px]" />

      {/* 2. Cyberpunk Grid Overlay */}
      <div className="absolute inset-0 bg-grid opacity-75" />

      {/* 3. Volumetric Matrix Star-field Particles */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute bg-plasma-glow rounded-full shadow-[0_0_8px_rgba(192,132,252,0.8)]"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
            }}
            animate={{
              y: ['0px', '-180px', '0px'],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* 4. Plasma Pulse Core in Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-neon-violet/5 blur-[120px] rounded-full" />
    </div>
  );
}
