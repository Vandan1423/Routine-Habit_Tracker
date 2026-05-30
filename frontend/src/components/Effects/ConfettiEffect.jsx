// src/components/ConfettiEffect.jsx
// Diwali-style firecracker burst on task completion.
// Usage: Mount it, it auto-unmounts after animation via onDone callback.

import { useEffect } from "react";

const COLORS = [
    "#2d9e63", // brand green
    "#f5c842", // gold
    "#ff6b6b", // red
    "#4ecdc4", // teal
    "#a78bfa", // violet
    "#f97316", // orange
    "#22d3ee", // cyan
    "#fb7185", // pink
];

const PARTICLE_COUNT = 60;

function randomBetween(a, b) {
    return a + Math.random() * (b - a);
}

export default function ConfettiEffect({ x, y, onDone }) {

    useEffect(() => {
        const particles = [];

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const el = document.createElement("div");
            const color = COLORS[Math.floor(Math.random() * COLORS.length)];
            const size = randomBetween(5, 11);
            const angle = randomBetween(0, 360);
            const distance = randomBetween(40, 160);
            const duration = randomBetween(600, 1100);
            const delay = randomBetween(0, 180);

            // Alternate between circles, rectangles, and diamonds
            const shape = Math.floor(Math.random() * 3);

            el.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                width: ${size}px;
                height: ${size * (shape === 1 ? 1.8 : 1)}px;
                background: ${color};
                border-radius: ${shape === 0 ? "50%" : shape === 1 ? "2px" : "0"};
                transform: ${shape === 2 ? "rotate(45deg)" : "rotate(0deg)"};
                pointer-events: none;
                z-index: 9999;
                opacity: 1;
                will-change: transform, opacity;
            `;

            const rad = (angle * Math.PI) / 180;
            const dx = Math.cos(rad) * distance;
            const dy = Math.sin(rad) * distance;

            document.body.appendChild(el);
            particles.push(el);

            // Animate using Web Animations API for performance
            el.animate(
                [
                    {
                        transform: `translate(0, 0) ${shape === 2 ? "rotate(45deg)" : ""} scale(1)`,
                        opacity: 1,
                    },
                    {
                        transform: `translate(${dx}px, ${dy - 30}px) ${shape === 2 ? "rotate(${randomBetween(45, 405)}deg)" : `rotate(${randomBetween(0, 360)}deg)`} scale(0.3)`,
                        opacity: 0,
                    },
                ],
                {
                    duration,
                    delay,
                    easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                    fill: "forwards",
                }
            );
        }

        const cleanup = setTimeout(() => {
            particles.forEach((p) => p.remove());
            onDone?.();
        }, 1400);

        return () => {
            clearTimeout(cleanup);
            particles.forEach((p) => p.remove());
        };
    }, [x, y, onDone]);

    return null; // DOM is manipulated directly for performance
}